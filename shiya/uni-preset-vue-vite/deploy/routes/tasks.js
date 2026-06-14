/**
 * 任务管理 API 路由
 * 包含：任务拆解、任务 CRUD、Bingo 联动
 */

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { callDeepSeek, callDeepSeekStream } = require('../services/deepseek');
const { getSystemPrompt } = require('../prompts');

// 鉴权辅助：从多处提取用户ID
async function getUserId(req) {
  const SECRET_KEY = process.env.SECRET_KEY || 'shiya-secret';
  const token = req.headers.authorization?.split(' ')[1] || req.body.token;
  if (token) {
    try {
      const decoded = jwt.verify(token, SECRET_KEY);
      return decoded.id;
    } catch (e) {
      // token 无效
    }
  }
  // 无 token 时用默认用户（开发兼容）
  return req.body.userId || 3;
}

// 获取 MySQL 连接池（从 app.locals 获取）
function getPool(req) {
  return req.app.locals.pool;
}

/**
 * POST /api/tasks/split
 * AI 任务拆解：把大任务拆成 5-30 分钟的子任务
 */
router.post('/tasks/split', async (req, res) => {
  try {
    const userId = await getUserId(req);
    const { content, sessionId } = req.body;

    if (!content) {
      return res.status(400).json({ success: false, error: 'missing_content' });
    }

    const systemPrompt = getSystemPrompt('task-split');
    const aiResult = await callDeepSeek(systemPrompt, `用户输入: ${content}`);

    // 解析 AI 返回的 JSON
    let parsed;
    try {
      // 去除可能的 markdown 代码块包裹
      const cleaned = aiResult.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (e) {
      return res.status(500).json({
        success: false,
        error: 'parse_error',
        raw: aiResult,
      });
    }

    if (!parsed.data || !parsed.data.subTasks) {
      return res.json({
        success: true,
        type: 'TASK_SPLIT',
        data: {
          mainTask: parsed.data?.mainTask || { title: content, description: '' },
          subTasks: [],
        },
        note: 'no_split_needed',
      });
    }

    res.json({
      success: true,
      type: 'TASK_SPLIT',
      data: parsed.data,
    });
  } catch (error) {
    console.error('[Tasks] split error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/tasks
 * 获取任务列表，可按 session_id 筛选
 */
router.get('/tasks', async (req, res) => {
  try {
    const userId = await getUserId(req);
    const pool = getPool(req);
    const { sessionId, status } = req.query;

    let sql = 'SELECT * FROM agent_tasks WHERE user_id = ?';
    const params = [userId];

    if (sessionId) {
      sql += ' AND session_id = ?';
      params.push(sessionId);
    }
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    sql += ' ORDER BY sort_order ASC, created_at DESC';

    const [tasks] = await pool.query(sql, params);

    res.json({ success: true, data: tasks });
  } catch (error) {
    console.error('[Tasks] list error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/tasks
 * 创建任务（可批量创建子任务）
 */
router.post('/tasks', async (req, res) => {
  try {
    const userId = await getUserId(req);
    const pool = getPool(req);
    const { sessionId, parentId, title, description, estimatedMinutes, priority, ddlDate, bingoGridId, tasks } = req.body;

    // 批量创建
    if (Array.isArray(tasks)) {
      const results = [];
      for (const t of tasks) {
        const [result] = await pool.query(
          `INSERT INTO agent_tasks (user_id, session_id, parent_id, title, description, estimated_minutes, priority, ddl_date, bingo_grid_id, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            userId,
            t.sessionId || sessionId || 'default',
            t.parentId || parentId || null,
            t.title,
            t.description || '',
            t.estimatedMinutes || 30,
            t.priority || 3,
            t.ddlDate || ddlDate || null,
            t.bingoGridId || bingoGridId || null,
            t.sortOrder || 0,
          ]
        );
        // 记录历史
        await pool.query(
          'INSERT INTO agent_task_history (task_id, user_id, action) VALUES (?, ?, ?)',
          [result.insertId, userId, 'created']
        );
        results.push({ id: result.insertId, ...t });
      }
      return res.json({ success: true, data: results });
    }

    // 单个创建
    const [result] = await pool.query(
      `INSERT INTO agent_tasks (user_id, session_id, parent_id, title, description, estimated_minutes, priority, ddl_date, bingo_grid_id, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        sessionId || 'default',
        parentId || null,
        title,
        description || '',
        estimatedMinutes || 30,
        priority || 3,
        ddlDate || null,
        bingoGridId || null,
        0,
      ]
    );

    await pool.query(
      'INSERT INTO agent_task_history (task_id, user_id, action) VALUES (?, ?, ?)',
      [result.insertId, userId, 'created']
    );

    res.json({ success: true, data: { id: result.insertId } });
  } catch (error) {
    console.error('[Tasks] create error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/tasks/:id
 * 更新任务（状态、内容等）
 */
router.put('/tasks/:id', async (req, res) => {
  try {
    const userId = await getUserId(req);
    const pool = getPool(req);
    const { id } = req.params;
    const { status, title, description, estimatedMinutes, priority, ddlDate, bingoGridId, sortOrder } = req.body;

    const updates = [];
    const params = [];

    if (status !== undefined) {
      updates.push('status = ?');
      params.push(status);
    }
    if (title !== undefined) {
      updates.push('title = ?');
      params.push(title);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }
    if (estimatedMinutes !== undefined) {
      updates.push('estimated_minutes = ?');
      params.push(estimatedMinutes);
    }
    if (priority !== undefined) {
      updates.push('priority = ?');
      params.push(priority);
    }
    if (ddlDate !== undefined) {
      updates.push('ddl_date = ?');
      params.push(ddlDate);
    }
    if (bingoGridId !== undefined) {
      updates.push('bingo_grid_id = ?');
      params.push(bingoGridId);
    }
    if (sortOrder !== undefined) {
      updates.push('sort_order = ?');
      params.push(sortOrder);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'no_fields_to_update' });
    }

    params.push(id, userId);
    await pool.query(
      `UPDATE agent_tasks SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`,
      params
    );

    // 记录历史
    const actionMap = { pending: 'created', in_progress: 'started', completed: 'completed', failed: 'failed' };
    await pool.query(
      'INSERT INTO agent_task_history (task_id, user_id, action, details) VALUES (?, ?, ?, ?)',
      [id, userId, actionMap[status] || 'updated', JSON.stringify(req.body)]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('[Tasks] update error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/tasks/:id
 * 删除任务
 */
router.delete('/tasks/:id', async (req, res) => {
  try {
    const userId = await getUserId(req);
    const pool = getPool(req);
    const { id } = req.params;

    await pool.query(
      'INSERT INTO agent_task_history (task_id, user_id, action) VALUES (?, ?, ?)',
      [id, userId, 'deleted']
    );
    await pool.query('DELETE FROM agent_tasks WHERE id = ? AND user_id = ?', [id, userId]);

    res.json({ success: true });
  } catch (error) {
    console.error('[Tasks] delete error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/tasks/bingo-pool
 * 获取适合 Bingo 任务池的任务（拆解后的子任务），按优先级+DDL排序
 */
router.get('/tasks/bingo-pool', async (req, res) => {
  try {
    const userId = await getUserId(req);
    const pool = getPool(req);

    const [tasks] = await pool.query(
      `SELECT * FROM agent_tasks
       WHERE user_id = ? AND status = 'pending' AND parent_id IS NOT NULL
       ORDER BY priority ASC, ddl_date ASC, created_at DESC
       LIMIT 50`,
      [userId]
    );

    // 转换为 Bingo 任务格式
    const bingoPool = tasks.map(t => ({
      id: `agent_${t.id}`,
      text: t.title,
      description: t.description,
      estimatedTime: t.estimated_minutes,
      priority: t.priority <= 2 ? 'urgent' : t.priority <= 3 ? 'normal' : 'low',
      difficulty: t.estimated_minutes <= 10 ? 'easy' : t.estimated_minutes <= 25 ? 'medium' : 'hard',
      urgency: (6 - t.priority) * 2, // 1->10, 5->2
      ddlDate: t.ddl_date,
      estimatedMinutes: t.estimated_minutes,
    }));

    res.json({ success: true, data: bingoPool });
  } catch (error) {
    console.error('[Tasks] bingo-pool error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/tasks/save-from-bingo
 * Bingo 完成时保存任务完成状态，并回写日程
 */
router.post('/tasks/save-from-bingo', async (req, res) => {
  try {
    const userId = await getUserId(req);
    const pool = getPool(req);
    const { completedTasks } = req.body;

    if (!Array.isArray(completedTasks)) {
      return res.status(400).json({ success: false, error: 'invalid_tasks' });
    }

    const completedTaskIds = []

    for (const t of completedTasks) {
      // 从 Bingo ID 中提取真实 task ID
      const match = t.id?.match(/^agent_(\d+)$/);
      if (match) {
        const taskId = parseInt(match[1]);
        await pool.query(
          'UPDATE agent_tasks SET status = ? WHERE id = ? AND user_id = ?',
          ['completed', taskId, userId]
        );
        await pool.query(
          'INSERT INTO agent_task_history (task_id, user_id, action, details) VALUES (?, ?, ?, ?)',
          [taskId, userId, 'completed', JSON.stringify({ source: 'bingo' })]
        );
        completedTaskIds.push(taskId)
      }
    }

    // 回写日程：Bingo 完成的 agent_task → 标记对应日程为已完成
    if (completedTaskIds.length > 0) {
      try {
        const [rows] = await pool.query(
          'SELECT content FROM user_data WHERE user_id = ? AND data_type = ?',
          [userId, 'todos']
        )
        if (rows.length > 0) {
          let todos = typeof rows[0].content === 'string'
            ? JSON.parse(rows[0].content)
            : rows[0].content

          let updated = false
          todos = todos.map(t => {
            if (t.taskId && completedTaskIds.includes(t.taskId) && !t.completed) {
              updated = true
              return { ...t, completed: true, updatedAt: Date.now() }
            }
            return t
          })

          if (updated) {
            await pool.query(
              'UPDATE user_data SET content = ? WHERE user_id = ? AND data_type = ?',
              [JSON.stringify(todos), userId, 'todos']
            )
            console.log(`[Bingo回写] 已标记 ${completedTaskIds.length} 条日程为完成`)
          }
        }
      } catch (e) {
        console.error('[Bingo回写-日程] 失败:', e.message)
      }
    }

    res.json({ success: true, scheduleUpdated: true });
  } catch (error) {
    console.error('[Tasks] save-from-bingo error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 经典小任务池（常驻，随机抽取，可重复出现） ====================
const CLASSIC_MICRO_TASKS = [
  { id: 'micro_hydrate', title: '喝一杯水', description: '补充水分，保持身体活力', estimatedMinutes: 2, difficulty: 'easy', category: '健康' },
  { id: 'micro_stand', title: '起身走动', description: '站起来活动，促进血液循环', estimatedMinutes: 5, difficulty: 'easy', category: '健康' },
  { id: 'micro_eyes', title: '眼保健操', description: '闭眼休息，转动眼球，缓解眼疲劳', estimatedMinutes: 3, difficulty: 'easy', category: '健康' },
  { id: 'micro_breathe', title: '深呼吸练习', description: '深吸慢呼，放松身心', estimatedMinutes: 2, difficulty: 'easy', category: '正念' },
  { id: 'micro_stretch', title: '全身拉伸', description: '伸展手臂、背部、腿部', estimatedMinutes: 5, difficulty: 'easy', category: '健康' },
  { id: 'micro_posture', title: '矫正坐姿', description: '检查并调整坐姿，挺直腰背', estimatedMinutes: 1, difficulty: 'easy', category: '健康' },
  { id: 'micro_desk', title: '整理桌面', description: '花几分钟整理工作区域', estimatedMinutes: 5, difficulty: 'easy', category: '效率' },
  { id: 'micro_snack', title: '健康加餐', description: '吃一份水果或坚果', estimatedMinutes: 5, difficulty: 'easy', category: '健康' },
  { id: 'micro_walk', title: '户外快走', description: '到户外走一走，呼吸新鲜空气', estimatedMinutes: 10, difficulty: 'medium', category: '健康' },
  { id: 'micro_meditate', title: '冥想5分钟', description: '闭眼静坐，专注呼吸', estimatedMinutes: 5, difficulty: 'medium', category: '正念' },
  { id: 'micro_read', title: '阅读10分钟', description: '读几页书或文章', estimatedMinutes: 10, difficulty: 'medium', category: '学习' },
  { id: 'micro_review', title: '快速复盘', description: '回顾今天完成的事，记录收获', estimatedMinutes: 5, difficulty: 'medium', category: '效率' },
  { id: 'micro_plan', title: '明日计划', description: '列出明天最重要的3件事', estimatedMinutes: 5, difficulty: 'medium', category: '效率' },
  { id: 'micro_gratitude', title: '感恩日记', description: '写下今天让你感恩的3件事', estimatedMinutes: 3, difficulty: 'easy', category: '正念' },
  { id: 'micro_squats', title: '深蹲20个', description: '做20个深蹲，激活下肢', estimatedMinutes: 3, difficulty: 'medium', category: '健康' },
  { id: 'micro_music', title: '听一首歌', description: '放松心情，享受音乐', estimatedMinutes: 5, difficulty: 'easy', category: '放松' },
  { id: 'micro_window', title: '远眺窗外', description: '看看远处的风景，放松眼睛', estimatedMinutes: 3, difficulty: 'easy', category: '健康' },
  { id: 'micro_journal', title: '写3句话日记', description: '记录今天的心情和想法', estimatedMinutes: 5, difficulty: 'easy', category: '正念' },
  { id: 'micro_clean', title: '清洁小区域', description: '擦拭桌面或整理一个抽屉', estimatedMinutes: 10, difficulty: 'easy', category: '效率' },
  { id: 'micro_stairs', title: '爬楼梯', description: '走楼梯上下几层，活动筋骨', estimatedMinutes: 3, difficulty: 'medium', category: '健康' },
  { id: 'micro_tea', title: '泡杯茶', description: '泡一杯喜欢的茶，慢慢品', estimatedMinutes: 5, difficulty: 'easy', category: '放松' },
  { id: 'micro_photo', title: '拍张照片', description: '随手拍一张身边的风景或物件', estimatedMinutes: 2, difficulty: 'easy', category: '放松' },
];

// 数组洗牌
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * POST /api/tasks/ddl-pool
 * DDL库：根据用户可用时间，生成Bingo棋盘任务
 * 规则：
 *   1. 日程占可用时间的 ~70%，微任务始终占 ~30%（避免全是长任务挫败感）
 *   2. 日程按 priority 升序（紧急优先）塞入 70% 时间预算
 *   3. 剩余 30% 时间用经典小任务填满（可重复）
 *   4. 时间很短（< 10分钟）时全用微任务
 */
router.post('/tasks/ddl-pool', async (req, res) => {
  try {
    const userId = await getUserId(req);
    const pool = getPool(req);
    const { availableMinutes } = req.body;

    const availMin = Math.max(1, parseInt(availableMinutes) || 30);

    // ========== 1. 加载个人日程 ==========
    const [rows] = await pool.query(
      'SELECT content FROM user_data WHERE user_id = ? AND data_type = ?',
      [userId, 'todos']
    );

    let todos = [];
    if (rows.length > 0) {
      todos = typeof rows[0].content === 'string'
        ? JSON.parse(rows[0].content)
        : rows[0].content;
    }

    const toNumPriority = (p) => {
      if (typeof p === 'number') return p;
      if (p === 'urgent') return 1;
      return 3;
    };

    // 过滤：未完成 + 有标题 + 耗时不超过可用时间
    const allSchedules = (todos || [])
      .filter(t => !t.completed && (t.text || t.title))
      .filter(t => (t.estimatedMinutes || 30) <= availMin)
      .map(t => ({
        id: `ddl_${t.id}`,
        text: t.text || t.title,
        title: t.text || t.title,
        description: t.details || t.description || '',
        estimatedMinutes: t.estimatedMinutes || t.estimatedTime || 30,
        priority: toNumPriority(t.priority),
        difficulty: t.difficulty || 'medium',
        startDate: t.startDate,
        endDate: t.endDate,
        taskId: t.taskId,
        originalId: t.id,
      }));

    // 按紧急度排序（priority 越小越紧急）
    allSchedules.sort((a, b) => a.priority - b.priority);

    // ========== 2. 时间预算：日程70% + 微任务30% ==========
    // 短时间（< 10分钟）全给微任务
    const useMicroOnly = availMin < 10;
    const scheduleTimeBudget = useMicroOnly ? 0 : Math.floor(availMin * 0.7);
    const microTimeBudget = availMin - scheduleTimeBudget;

    // ========== 3. 日程贪心填充 70% 预算 ==========
    const selectedSchedules = [];
    let scheduleTimeUsed = 0;

    for (const sched of allSchedules) {
      if (scheduleTimeUsed + sched.estimatedMinutes <= scheduleTimeBudget) {
        selectedSchedules.push(sched);
        scheduleTimeUsed += sched.estimatedMinutes;
      }
    }

    // 日程没花完的预算，归入微任务池
    const remainingMicroTime = microTimeBudget + (scheduleTimeBudget - scheduleTimeUsed);

    // ========== 4. 微任务填充 30% + 剩余预算 ==========
    const eligibleMicros = CLASSIC_MICRO_TASKS.filter(
      t => t.estimatedMinutes <= availMin
    );
    const selectedMicros = [];
    let microTimeUsed = 0;

    if (remainingMicroTime > 0 && eligibleMicros.length > 0) {
      const shuffledMicros = shuffle([...eligibleMicros]);
      let mi = 0;
      const MAX_MICROS = 30;
      while (remainingMicroTime - microTimeUsed >= 1 && selectedMicros.length < MAX_MICROS) {
        const micro = shuffledMicros[mi % shuffledMicros.length];
        if (micro.estimatedMinutes <= remainingMicroTime - microTimeUsed) {
          selectedMicros.push({
            ...micro,
            id: `micro_${Date.now()}_${selectedMicros.length}`,
            urgency: 0,
          });
          microTimeUsed += micro.estimatedMinutes;
        }
        mi++;
        if (mi > eligibleMicros.length * 3) break; // 兜底
      }
    }

    // ========== 5. 交替排列 + 凑满9张卡片 ==========
    const result = [];
    let si = 0, mi = 0;
    const MAX_CARDS = 9;

    while (result.length < MAX_CARDS && (si < selectedSchedules.length || mi < selectedMicros.length)) {
      // 放 1-2 个日程
      let scheduleInRow = 0;
      while (si < selectedSchedules.length && scheduleInRow < (mi > 0 ? 2 : 2)) {
        result.push({
          ...selectedSchedules[si],
          urgency: (6 - selectedSchedules[si].priority) * 2,
        });
        si++;
        scheduleInRow++;
        // 如果微任务该插入了，暂停日程
        if (mi < selectedMicros.length && (result.length % 3 === 2)) break;
      }
      // 放 1 个微任务
      if (mi < selectedMicros.length) {
        result.push(selectedMicros[mi]);
        mi++;
      }
      // 日程取完 → 全放微任务（但不超上限）
      if (si >= selectedSchedules.length) {
        while (mi < selectedMicros.length && result.length < MAX_CARDS) {
          result.push(selectedMicros[mi]);
          mi++;
        }
        break;
      }
      // 微任务取完 → 全放日程（但不超上限）
      if (mi >= selectedMicros.length) {
        while (si < selectedSchedules.length && result.length < MAX_CARDS) {
          result.push({
            ...selectedSchedules[si],
            urgency: (6 - selectedSchedules[si].priority) * 2,
          });
          si++;
        }
        break;
      }
    }

    const totalMinutes = scheduleTimeUsed + microTimeUsed;

    // 兜底：不足9张用微任务补齐（确保始终显示完整九宫格）
    if (result.length < MAX_CARDS && eligibleMicros.length > 0) {
      const shuffledMicros = shuffle([...eligibleMicros]);
      let padIdx = 0;
      while (result.length < 9 && padIdx < shuffledMicros.length * 2) {
        const micro = shuffledMicros[padIdx % shuffledMicros.length];
        result.push({
          ...micro,
          id: `micro_pad_${Date.now()}_${result.length}`,
          urgency: 0,
          isPadding: true,  // 标记为补齐卡片，不计入时间统计
        });
        padIdx++;
      }
    }

    console.log(`[DDL库] 时间=${availMin}分钟 | 日程${selectedSchedules.length}个(${scheduleTimeUsed}min) + 微任务${selectedMicros.length}个(${microTimeUsed}min) = 总${totalMinutes}min | 棋盘共${result.length}张`);

    res.json({
      success: true,
      data: result,
      stats: {
        scheduleCount: selectedSchedules.length,
        microCount: selectedMicros.length,
        availableMinutes: availMin,
        scheduleTimeUsed,
        microTimeUsed,
        totalMinutes,
      }
    });
  } catch (error) {
    console.error('[DDL库] 错误:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/tasks/ddl-complete
 * DDL库：Bingo卡片完成时，回写日程完成状态
 */
router.post('/tasks/ddl-complete', async (req, res) => {
  try {
    const userId = await getUserId(req);
    const pool = getPool(req);
    const { taskId } = req.body; // 格式: "ddl_{originalId}"

    if (!taskId || !taskId.startsWith('ddl_')) {
      return res.json({ success: false, error: 'invalid_task_id' });
    }

    const originalId = taskId.replace('ddl_', '');
    const [rows] = await pool.query(
      'SELECT content FROM user_data WHERE user_id = ? AND data_type = ?',
      [userId, 'todos']
    );

    if (rows.length > 0) {
      let todos = typeof rows[0].content === 'string'
        ? JSON.parse(rows[0].content)
        : rows[0].content;

      let updated = false;
      todos = todos.map(t => {
        if (String(t.id) === originalId && !t.completed) {
          updated = true;
          return { ...t, completed: true, updatedAt: Date.now() };
        }
        return t;
      });

      if (updated) {
        await pool.query(
          'UPDATE user_data SET content = ? WHERE user_id = ? AND data_type = ?',
          [JSON.stringify(todos), userId, 'todos']
        );
        console.log(`[DDL完成] 日程 id=${originalId} 已标记完成`);
        return res.json({ success: true, scheduleUpdated: true });
      }
    }

    res.json({ success: true, scheduleUpdated: false });
  } catch (error) {
    console.error('[DDL完成] 错误:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 成就墙 API ====================

/**
 * GET /tasks/achievements
 * 获取用户的 Bingo 成就列表（从服务端数据库）
 */
router.get('/tasks/achievements', async (req, res) => {
  try {
    const userId = await getUserId(req);
    const pool = getPool(req);
    const [rows] = await pool.query(
      'SELECT content FROM user_data WHERE user_id = ? AND data_type = ?',
      [userId, 'achievements']
    );
    if (rows.length > 0) {
      const achievements = typeof rows[0].content === 'string'
        ? JSON.parse(rows[0].content)
        : rows[0].content;
      return res.json({ success: true, data: achievements || [] });
    }
    res.json({ success: true, data: [] });
  } catch (error) {
    console.error('[成就获取] 错误:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /tasks/achievements
 * 保存/更新用户的 Bingo 成就列表（全量替换）
 */
router.post('/tasks/achievements', async (req, res) => {
  try {
    const userId = await getUserId(req);
    const pool = getPool(req);
    const { achievements } = req.body;
    if (!Array.isArray(achievements)) {
      return res.json({ success: false, error: 'invalid_data' });
    }
    const [rows] = await pool.query(
      'SELECT id FROM user_data WHERE user_id = ? AND data_type = ?',
      [userId, 'achievements']
    );
    if (rows.length > 0) {
      await pool.query(
        'UPDATE user_data SET content = ?, updated_at = NOW() WHERE user_id = ? AND data_type = ?',
        [JSON.stringify(achievements), userId, 'achievements']
      );
    } else {
      await pool.query(
        'INSERT INTO user_data (user_id, data_type, content, updated_at) VALUES (?, ?, ?, NOW())',
        [userId, 'achievements', JSON.stringify(achievements)]
      );
    }
    res.json({ success: true });
  } catch (error) {
    console.error('[成就保存] 错误:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

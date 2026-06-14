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
 * Bingo 完成时保存任务完成状态
 */
router.post('/tasks/save-from-bingo', async (req, res) => {
  try {
    const userId = await getUserId(req);
    const pool = getPool(req);
    const { completedTasks } = req.body;

    if (!Array.isArray(completedTasks)) {
      return res.status(400).json({ success: false, error: 'invalid_tasks' });
    }

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
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[Tasks] save-from-bingo error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

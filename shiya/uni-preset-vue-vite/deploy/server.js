const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');
require('dotenv').config();

// DeepSeek AI 服务（统一 AI 引擎，替代豆包）
const { callDeepSeek, callDeepSeekStream } = require('./services/deepseek');
const { getSystemPrompt } = require('./prompts');
const { buildMessagesForDeepSeek, saveAssistantMessage, estimateTokens } = require('./services/conversation');
const tasksRouter = require('./routes/tasks');
const conversationsRouter = require('./routes/conversations');

// 流式响应辅助函数
const sendSSEventRaw = (res, type, data) => {
  res.write(`event: ${type}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
};

// thinking 事件用延迟版（让用户看到动画）
const sendSSEvent = async (res, type, data, delayMs = 500) => {
  sendSSEventRaw(res, type, data);
  if (delayMs > 0) {
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
};

// 消息流式输出用无延迟版
const sendMessageChunk = (res, content) => {
  sendSSEventRaw(res, 'message', { content });
};

// ==================== 意图识别 ====================
// 待确认操作缓存 (sessionId → { action, targetId, title, changes, timestamp })
const pendingActions = new Map();
const PENDING_TIMEOUT_MS = 5 * 60 * 1000; // 5分钟超时

// 清理过期 pending actions
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of pendingActions) {
    if (now - val.timestamp > PENDING_TIMEOUT_MS) {
      pendingActions.delete(key);
    }
  }
}, 60 * 1000);

async function detectIntent(userContent, apiKey) {
  const apiUrl = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions';

  if (!apiKey) {
    console.log('[意图识别] DeepSeek Key 未配置，默认闲聊模式');
    return 'CHAT';
  }

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: `你是一个意图识别器。判断用户的话属于哪种意图。

分类规则：
1. SCHEDULE - 创建日程、提醒、定时任务（如"明天下午3点开会"、"每天跑步"、"这周六去图书馆"、"下周一开始健身"）
2. DIARY - 写日记（如"记录今天的心情"、"写日记"、"今天发生了一件有趣的事"）
3. TASK - 任务拆解、追问后确认拆解（如"帮我拆解述职报告"、"拆"、"帮我分解"、"好的拆"、"怎么做"、"帮我拆开看看"、"拆一下"）
4. MANAGE_SCHEDULE - 查询/修改/删除已有的日程（如"看看这周有什么安排"、"把我明天的会议改成下午"、"删除开会的日程"、"帮我把跑步改成游泳"、"取消明天的安排"）
5. CHAT - 闲聊、问候、简单问答、含糊不清的陈述

注意：
- 用户说"拆"、"拆一下"、"帮我拆"、"分解"、"帮我看看怎么拆" → 一律判定为 TASK
- 用户说"删除"、"取消"、"移除"、"去掉" + 某日程关键词 → MANAGE_SCHEDULE
- 用户说"修改"、"改成"、"调整"、"改一下" + 某日程 → MANAGE_SCHEDULE
- 用户说"看看"、"有什么"、"查"、"显示"、"列出" + 日程/安排/任务 → MANAGE_SCHEDULE
- 用户提到"备战"、"复习"、"准备"、"学习"后面跟具体目标 → 如果是明确的日程意图判定为 SCHEDULE，如果是含糊的大任务且上下文在追问后，判定为 TASK
- 不确定时优先选 CHAT

只回复大写意图（SCHEDULE / DIARY / TASK / MANAGE_SCHEDULE / CHAT），不要其他内容。`
          },
          { role: 'user', content: userContent }
        ],
        temperature: 0.1,
        max_tokens: 10,
        stream: false,
      }),
    });

    if (!response.ok) return 'CHAT';
    const data = await response.json();
    const intent = data.choices?.[0]?.message?.content?.trim().toUpperCase() || 'CHAT';
    console.log(`[意图识别] "${userContent.slice(0, 30)}..." → ${intent}`);
    return ['SCHEDULE', 'DIARY', 'TASK', 'MANAGE_SCHEDULE', 'CHAT'].includes(intent) ? intent : 'CHAT';
  } catch (e) {
    console.log('[意图识别] 失败，默认闲聊:', e.message);
    return 'CHAT';
  }
}

// ==================== 日程 ↔ agent_tasks 双向同步辅助 ====================

/**
 * 将日程数据同步到 agent_tasks 表（创建或更新）
 * @returns {number|null} agent_tasks.id
 */
async function syncTodoToAgentTask(pool, userId, todo, sessionId) {
  try {
    const ddlDate = todo.endDate || todo.startDate || null
    const priority = typeof todo.priority === 'number' ? todo.priority
      : (todo.priority === 'urgent' ? 1 : todo.priority === 'normal' ? 3 : 5)
    const estMin = todo.estimatedMinutes || todo.estimatedTime || 60

    if (todo.taskId) {
      // 已有关联的 agent_task，更新它
      const [existing] = await pool.query(
        'SELECT id FROM agent_tasks WHERE id = ? AND user_id = ?',
        [todo.taskId, userId]
      )
      if (existing.length > 0) {
        await pool.query(
          `UPDATE agent_tasks SET title = ?, description = ?, estimated_minutes = ?, priority = ?, ddl_date = ?, status = ?, updated_at = NOW()
           WHERE id = ? AND user_id = ?`,
          [todo.title || todo.text, todo.description || todo.details || '', estMin, priority, ddlDate,
           todo.completed ? 'completed' : 'pending', todo.taskId, userId]
        )
        console.log(`[DBL同步] 更新 agent_task id=${todo.taskId} title=${todo.title || todo.text}`)
        return todo.taskId
      }
    }

    // 新建 agent_task 记录
    const [result] = await pool.query(
      `INSERT INTO agent_tasks (user_id, session_id, parent_id, title, description, estimated_minutes, priority, ddl_date, status, sort_order)
       VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, 0)`,
      [userId, sessionId || 'default', todo.title || todo.text, todo.description || todo.details || '',
       estMin, priority, ddlDate, todo.completed ? 'completed' : 'pending']
    )
    console.log(`[DBL同步] 新建 agent_task id=${result.insertId} title=${todo.title || todo.text} ddl=${ddlDate}`)
    return result.insertId
  } catch (e) {
    console.error('[DBL同步] 失败:', e.message)
    return null
  }
}

/**
 * agent_tasks 完成/取消时，回写 user_data 中的对应日程
 */
async function syncAgentTaskToSchedule(pool, userId, taskId, completed) {
  try {
    const [rows] = await pool.query(
      'SELECT content FROM user_data WHERE user_id = ? AND data_type = ?',
      [userId, 'todos']
    )
    if (rows.length === 0) return false

    let todos = typeof rows[0].content === 'string'
      ? JSON.parse(rows[0].content)
      : rows[0].content

    let updated = false
    todos = todos.map(t => {
      if (t.taskId === taskId) {
        updated = true
        return { ...t, completed, updatedAt: Date.now() }
      }
      return t
    })

    if (updated) {
      await pool.query(
        'UPDATE user_data SET content = ? WHERE user_id = ? AND data_type = ?',
        [JSON.stringify(todos), userId, 'todos']
      )
      console.log(`[DBL同步] 任务回写日程 taskId=${taskId} completed=${completed}`)
    }
    return updated
  } catch (e) {
    console.error('[DBL同步-回写] 失败:', e.message)
    return false
  }
}

// ==================== 日程数据写入 ====================
async function saveScheduleToDB(pool, userId, scheduleData, sessionId) {
  // 拒绝空标题的日程
  if (!scheduleData || !scheduleData.title || !scheduleData.title.trim()) {
    console.log('[日程保存] 跳过：标题为空');
    return null;
  }

  try {
    // 读取现有 todos
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

    // 构造新日程（兼容旧字段 + 新字段：DDL/耗时/优先级/难度）
    const prio = scheduleData.priority || 3;
    const estMin = scheduleData.estimatedMinutes || 60;
    const inferDifficulty = (p) => p >= 4 ? 'hard' : p >= 3 ? 'medium' : 'easy';
    // 组合 startDate + startTime 为完整日期时间串
    const fullStartTime = scheduleData.startDate
      ? (scheduleData.startDate + (scheduleData.startTime ? ' ' + scheduleData.startTime : ''))
      : (scheduleData.startTime || scheduleData.date || '');
    const fullEndTime = scheduleData.endDate
      ? (scheduleData.endDate + (scheduleData.endTime ? ' ' + scheduleData.endTime : ''))
      : (scheduleData.endTime || scheduleData.date || '');
    const newTodo = {
      id: Date.now(),
      text: scheduleData.title,           // 兼容旧版渲染
      title: scheduleData.title,          // 新版字段
      description: scheduleData.description || '',
      details: scheduleData.description || '',
      date: scheduleData.startDate || scheduleData.date,
      startDate: scheduleData.startDate || scheduleData.date || '',
      endDate: scheduleData.endDate || scheduleData.startDate || scheduleData.date || '',
      time: scheduleData.startTime || scheduleData.time || '',
      startTime: fullStartTime,
      endTime: fullEndTime,
      completed: false,
      isRepeat: scheduleData.repeatInterval !== 'none',
      repeatInterval: scheduleData.repeatInterval || 'none',
      priority: prio,
      estimatedMinutes: estMin,
      estimatedTime: estMin,
      difficulty: scheduleData.difficulty || inferDifficulty(prio),
      taskId: null,  // 后续由 syncTodoToAgentTask 填入
      updatedAt: Date.now(),
      createdAt: new Date().toISOString(),
    };

    // 同步到 agent_tasks 表（DDL 联动）
    const taskId = await syncTodoToAgentTask(pool, userId, newTodo, sessionId)
    if (taskId) {
      newTodo.taskId = taskId
    }

    todos.push(newTodo);

    // 写回数据库
    await pool.query(
      'INSERT INTO user_data (user_id, data_type, content) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE content = ?',
      [userId, 'todos', JSON.stringify(todos), JSON.stringify(todos)]
    );

    console.log(`[日程保存] userId=${userId} title=${scheduleData.title} date=${scheduleData.date} taskId=${taskId}`);
    return newTodo;
  } catch (e) {
    console.error('[日程保存] 失败:', e.message);
    return null;
  }
}

// ==================== 日记数据写入 ====================
async function saveDiaryToDB(pool, userId, diaryData) {
  try {
    const [rows] = await pool.query(
      'SELECT content FROM user_data WHERE user_id = ? AND data_type = ?',
      [userId, 'diaryEntries']
    );

    let diaries = [];
    if (rows.length > 0) {
      diaries = typeof rows[0].content === 'string'
        ? JSON.parse(rows[0].content)
        : rows[0].content;
    }

    const newDiary = {
      id: Date.now(),
      date: diaryData.date,
      content: diaryData.content,
      mood: diaryData.mood || '😊',
      createdAt: new Date().toISOString(),
    };

    diaries.push(newDiary);

    await pool.query(
      'INSERT INTO user_data (user_id, data_type, content) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE content = ?',
      [userId, 'diaryEntries', JSON.stringify(diaries), JSON.stringify(diaries)]
    );

    console.log(`[日记保存] userId=${userId} date=${diaryData.date}`);
    return newDiary;
  } catch (e) {
    console.error('[日记保存] 失败:', e.message);
    return null;
  }
}

// ==================== 日程 CRUD 辅助函数 ====================
async function loadTodosFromDB(pool, userId) {
  try {
    const [rows] = await pool.query(
      'SELECT content FROM user_data WHERE user_id = ? AND data_type = ?',
      [userId, 'todos']
    );
    if (rows.length > 0) {
      return typeof rows[0].content === 'string'
        ? JSON.parse(rows[0].content)
        : (rows[0].content || []);
    }
    return [];
  } catch (e) {
    console.error('[加载日程] 失败:', e.message);
    return [];
  }
}

async function saveTodosToDB(pool, userId, todos) {
  try {
    await pool.query(
      'INSERT INTO user_data (user_id, data_type, content) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE content = ?',
      [userId, 'todos', JSON.stringify(todos), JSON.stringify(todos)]
    );
    return true;
  } catch (e) {
    console.error('[保存日程] 失败:', e.message);
    return false;
  }
}

async function deleteTodoFromDB(pool, userId, targetId) {
  const todos = await loadTodosFromDB(pool, userId);
  const idx = todos.findIndex(t => String(t.id) === String(targetId));
  if (idx === -1) return { success: false, error: 'not_found' };
  const deleted = todos[idx];
  todos.splice(idx, 1);
  const ok = await saveTodosToDB(pool, userId, todos);
  return ok ? { success: true, todo: deleted } : { success: false, error: 'save_failed' };
}

async function updateTodoInDB(pool, userId, targetId, changes) {
  const todos = await loadTodosFromDB(pool, userId);
  const idx = todos.findIndex(t => String(t.id) === String(targetId));
  if (idx === -1) return { success: false, error: 'not_found' };
  const oldTodo = todos[idx];
  const updated = { ...oldTodo, ...changes, ...getDerivedFields(changes, oldTodo), updatedAt: Date.now() };
  todos[idx] = updated;
  const ok = await saveTodosToDB(pool, userId, todos);
  return ok ? { success: true, todo: updated, old: oldTodo } : { success: false, error: 'save_failed' };
}

function getDerivedFields(changes, oldTodo) {
  const derived = {};
  // 从 startDate + startTime 组合完整日期时间
  if (changes.startDate !== undefined || changes.startTime !== undefined) {
    const sd = changes.startDate !== undefined ? changes.startDate : oldTodo.startDate;
    const st = changes.startTime !== undefined ? changes.startTime : oldTodo.startTime;
    derived.startTime = sd ? (sd + (st ? ' ' + st : '')) : (st || '');
  }
  if (changes.endDate !== undefined || changes.endTime !== undefined) {
    const ed = changes.endDate !== undefined ? changes.endDate : oldTodo.endDate;
    const et = changes.endTime !== undefined ? changes.endTime : oldTodo.endTime;
    derived.endTime = ed ? (ed + (et ? ' ' + et : '')) : (et || '');
  }
  // difficulty 同步
  if (changes.priority !== undefined) {
    derived.difficulty = changes.priority >= 4 ? 'hard' : changes.priority >= 3 ? 'medium' : 'easy';
  }
  if (changes.estimatedMinutes !== undefined) {
    derived.estimatedTime = changes.estimatedMinutes;
  }
  return derived;
}

// 解析用户消息是否为确认（支持多种确认表达）
function isConfirmationMessage(content) {
  const msg = content.trim().replace(/[，。！？,\.\!\?\s]/g, '').toLowerCase();
  const confirms = ['确认', '是', '是的', '好', '好的', '行', '可以', '同意', '对', '没错', '确认删除', '确认修改', 'yes', 'ok', 'y', '确定', '没问题', '就这么办'];
  return confirms.some(c => msg === c || msg.startsWith(c));
}

const app = express();
const PORT = process.env.PORT || 3002;
const SECRET_KEY = process.env.SECRET_KEY || 'your-secret-key';

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'shiyo',
  password: process.env.DB_PASSWORD || 'Shiyo2025!',
  database: process.env.DB_NAME || 'shiya',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// 共享 pool 给路由模块
app.locals.pool = pool;

const safeParseJSON = (str, defaultValue) => {
  if (!str) return defaultValue;
  if (typeof str === 'object') return str;
  try {
    return JSON.parse(str);
  } catch (e) {
    return defaultValue;
  }
};

// 生成确定性ID的函数
const generateId = (content, type = 'task') => {
  // 使用内容的哈希值生成ID，确保相同内容在不同设备上生成相同ID
  const str = `${type}:${JSON.stringify(content)}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
};

// 获取本地日期字符串（YYYY-MM-DD格式），避免时区问题
const getLocalDateString = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

app.post('/api/register', async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ success: false, error: 'missing_parameters' });
  }

  try {
    const connection = await pool.getConnection();
    try {
      const [existingUsers] = await connection.query(
        'SELECT id FROM users WHERE email = ? OR username = ?',
        [email, username]
      );

      if (existingUsers.length > 0) {
        return res.status(400).json({ success: false, error: 'user_exists' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const [result] = await connection.query(
        'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
        [username, email, hashedPassword]
      );

      const userId = result.insertId;

      await connection.query(
        'INSERT INTO user_data (user_id, data_type, content) VALUES (?, ?, ?)',
        [userId, 'todos', JSON.stringify([])]
      );
      await connection.query(
        'INSERT INTO user_data (user_id, data_type, content) VALUES (?, ?, ?)',
        [userId, 'diaryEntries', JSON.stringify([])]
      );

      await connection.query(
        'INSERT INTO crow_data (user_id, crow_stats, chat_messages, food_count) VALUES (?, ?, ?, ?)',
        [userId, JSON.stringify({ hunger: 100, mood: 90 }), JSON.stringify([]), 0]
      );

      res.status(201).json({ success: true, message: 'User registered successfully' });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, error: 'server_error' });
  }
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'missing_parameters' });
  }

  try {
    const connection = await pool.getConnection();
    try {
      const [users] = await connection.query(
        'SELECT id, username, email, password FROM users WHERE username = ? OR email = ?',
        [username, username]
      );

      if (users.length === 0) {
        return res.status(401).json({ success: false, error: 'invalid_credentials' });
      }

      const user = users[0];
      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (!isPasswordValid) {
        return res.status(401).json({ success: false, error: 'invalid_credentials' });
      }

      const token = jwt.sign(
        { id: user.id, username: user.username, email: user.email },
        SECRET_KEY,
        { expiresIn: '7d' }
      );

      res.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email
        },
        token
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'server_error' });
  }
});

app.get('/api/user', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, error: 'unauthorized' });
  }

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    const connection = await pool.getConnection();
    try {
      const [users] = await connection.query(
        'SELECT id, username, email FROM users WHERE id = ?',
        [decoded.id]
      );

      if (users.length === 0) {
        return res.status(401).json({ success: false, error: 'unauthorized' });
      }

      const user = users[0];
      res.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email
        }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Get user error:', error);
    res.status(401).json({ success: false, error: 'unauthorized' });
  }
});

app.post('/api/save-data', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const { todos, diaryEntries, repeatTasks, completedTasks, courseSchedule } = req.body;

  if (!token) {
    return res.status(401).json({ success: false, error: 'unauthorized' });
  }

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    const userId = decoded.id;
    const connection = await pool.getConnection();

    try {
      if (todos !== undefined && Array.isArray(todos) && todos.length > 0) {
        // v0.8: 不再全量覆盖 todos，防止旧客户端覆盖服务器最新数据
        // 日程增删改统一通过 confirm-action API 或 schedule_* SSE 事件执行
        console.log(`[save-data] 收到 todos 上传 (${todos.length}条)，已忽略。服务器为权威数据源，请使用 /api/confirm-action`);
        // 仅当服务器端无数据时才执行首次初始化写入
        const existingTodos = await loadTodosFromDB(pool, userId);
        if (!existingTodos || existingTodos.length === 0) {
          console.log(`[save-data] 服务器无已有数据，接受首次初始化写入 (${todos.length}条)`);
          await connection.query(
            'INSERT INTO user_data (user_id, data_type, content) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE content = ?',
            [userId, 'todos', JSON.stringify(todos), JSON.stringify(todos)]
          );
        }
      }

      if (diaryEntries !== undefined) {
        await connection.query(
          'INSERT INTO user_data (user_id, data_type, content) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE content = ?',
          [userId, 'diaryEntries', JSON.stringify(diaryEntries), JSON.stringify(diaryEntries)]
        );
      }

      if (repeatTasks !== undefined) {
        await connection.query(
          'INSERT INTO user_data (user_id, data_type, content) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE content = ?',
          [userId, 'repeatTasks', JSON.stringify(repeatTasks), JSON.stringify(repeatTasks)]
        );
      }

      if (completedTasks !== undefined) {
        await connection.query(
          'INSERT INTO user_data (user_id, data_type, content) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE content = ?',
          [userId, 'completedTasks', JSON.stringify(completedTasks), JSON.stringify(completedTasks)]
        );
      }

      if (courseSchedule !== undefined) {
        await connection.query(
          'INSERT INTO user_data (user_id, data_type, content) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE content = ?',
          [userId, 'courseSchedule', JSON.stringify(courseSchedule), JSON.stringify(courseSchedule)]
        );
      }

      res.json({
        success: true,
        message: 'Data saved successfully'
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Save data error:', error);
    res.status(401).json({ success: false, error: 'unauthorized' });
  }
});

// ==================== 确认/取消待处理操作（直连API，不走聊天流程） ====================
app.post('/api/confirm-action', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const { sessionId } = req.body;

  if (!token) {
    return res.status(401).json({ success: false, error: 'unauthorized' });
  }
  if (!sessionId) {
    return res.status(400).json({ success: false, error: 'missing_session_id' });
  }

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    const userId = decoded.id;

    const pendingKey = `${userId}_${sessionId}`;
    const pending = pendingActions.get(pendingKey);

    if (!pending) {
      return res.json({ success: false, error: 'no_pending_action', message: '没有待确认的操作，可能已过期或已执行' });
    }

    console.log(`[确认API] userId=${userId} 确认执行: ${pending.action} ${pending.title} targetId=${pending.targetId}`);
    pendingActions.delete(pendingKey);

    if (pending.action === 'delete') {
      const currentTodos = await loadTodosFromDB(pool, userId);
      const exists = currentTodos.some(t => String(t.id) === String(pending.targetId));
      if (!exists) {
        return res.json({ success: false, error: 'not_found', message: '该日程已经不存在了，可能已被删除' });
      }

      const result = await deleteTodoFromDB(pool, userId, pending.targetId);
      console.log(`[确认API] deleteTodoFromDB 结果:`, JSON.stringify(result));

      if (result.success) {
        if (result.todo?.taskId) {
          syncAgentTaskToSchedule(pool, userId, result.todo.taskId, true).catch(e =>
            console.error('[DDL联动-删除] 同步失败:', e.message));
        }
        return res.json({
          success: true,
          action: 'delete',
          targetId: pending.targetId,
          title: pending.title,
          message: `已删除日程「${pending.title}」`
        });
      } else {
        return res.json({ success: false, error: 'delete_failed', message: `删除失败：${result.error}` });
      }
    } else if (pending.action === 'batchDelete') {
      // 批量删除确认执行
      const targetIds = pending.targetIds || [];
      const currentTodos = await loadTodosFromDB(pool, userId) || [];
      const idSet = new Set(targetIds.map(String));
      const deletedTodos = currentTodos.filter(t => idSet.has(String(t.id)));
      const remaining = currentTodos.filter(t => !idSet.has(String(t.id)));

      if (deletedTodos.length === 0) {
        return res.json({ success: false, error: 'not_found', message: '目标日程不存在' });
      }

      const ok = await saveTodosToDB(pool, userId, remaining);
      if (!ok) {
        return res.json({ success: false, error: 'save_failed', message: '数据库写入失败' });
      }

      // DDL 联动
      for (const todo of deletedTodos) {
        if (todo.taskId) {
          syncAgentTaskToSchedule(pool, userId, todo.taskId, true).catch(e =>
            console.error('[DDL联动-批量删除] 同步失败:', e.message));
        }
      }

      return res.json({
        success: true,
        action: 'batchDelete',
        targetIds: deletedTodos.map(t => String(t.id)),
        titles: deletedTodos.map(t => t.text || t.title || ''),
        count: deletedTodos.length,
        message: `已批量删除 ${deletedTodos.length} 项日程`
      });
    } else if (pending.action === 'update') {
      const result = await updateTodoInDB(pool, userId, pending.targetId, pending.changes);
      console.log(`[确认API] updateTodoInDB 结果:`, JSON.stringify(result));

      if (result.success) {
        if (result.todo?.taskId) {
          syncTodoToAgentTask(pool, userId, result.todo, sessionId).catch(e =>
            console.error('[DDL联动-更新] 同步失败:', e.message));
        }
        return res.json({
          success: true,
          action: 'update',
          targetId: pending.targetId,
          title: pending.title,
          changes: pending.changes,
          todo: result.todo,
          message: `已更新日程「${pending.title}」`
        });
      } else {
        return res.json({ success: false, error: 'update_failed', message: `更新失败：${result.error}` });
      }
    } else {
      return res.json({ success: false, error: 'unknown_action', message: `未知操作：${pending.action}` });
    }
  } catch (error) {
    console.error('[确认API] 错误:', error);
    res.status(500).json({ success: false, error: 'server_error', message: error.message });
  }
});

app.post('/api/cancel-action', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const { sessionId } = req.body;

  if (!token) {
    return res.status(401).json({ success: false, error: 'unauthorized' });
  }
  if (!sessionId) {
    return res.status(400).json({ success: false, error: 'missing_session_id' });
  }

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    const userId = decoded.id;

    const pendingKey = `${userId}_${sessionId}`;
    const pending = pendingActions.get(pendingKey);

    if (pending) {
      console.log(`[取消API] userId=${userId} 取消操作: ${pending.action} ${pending.title}`);
      pendingActions.delete(pendingKey);
    }

    return res.json({ success: true, message: '操作已取消' });
  } catch (error) {
    console.error('[取消API] 错误:', error);
    res.status(500).json({ success: false, error: 'server_error', message: error.message });
  }
});

// 手动删除日程端点（垃圾桶图标 → 直连服务器，不走 pending 流程）
app.post('/api/delete-todo', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const { targetId } = req.body;

  if (!token) {
    return res.status(401).json({ success: false, error: 'unauthorized' });
  }
  if (!targetId) {
    return res.status(400).json({ success: false, error: 'missing_target_id' });
  }

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    const userId = decoded.id;

    console.log(`[手动删除] userId=${userId} targetId=${targetId}`);

    const currentTodos = await loadTodosFromDB(pool, userId);
    const todo = currentTodos.find(t => String(t.id) === String(targetId));

    if (!todo) {
      return res.json({ success: false, error: 'not_found', message: '该日程不存在' });
    }

    const result = await deleteTodoFromDB(pool, userId, targetId);
    console.log(`[手动删除] 结果:`, JSON.stringify(result));

    if (result.success) {
      if (result.todo?.taskId) {
        syncAgentTaskToSchedule(pool, userId, result.todo.taskId, true).catch(e =>
          console.error('[DDL联动-手动删除] 同步失败:', e.message));
      }
      return res.json({
        success: true,
        targetId: targetId,
        title: todo.title || todo.text,
        message: `已删除日程「${todo.title || todo.text}」`
      });
    } else {
      return res.json({ success: false, error: 'delete_failed', message: `删除失败：${result.error}` });
    }
  } catch (error) {
    console.error('[手动删除] 错误:', error);
    res.status(500).json({ success: false, error: 'server_error', message: error.message });
  }
});

// 通用保存端点：创建或更新单条日程（手动/AI 共用）
app.post('/api/save-todo', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const { todo } = req.body;

  if (!token) return res.status(401).json({ success: false, error: 'unauthorized' });
  if (!todo || !todo.id) return res.status(400).json({ success: false, error: 'missing_todo' });

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    const userId = decoded.id;

    const currentTodos = await loadTodosFromDB(pool, userId) || [];
    const existingIdx = currentTodos.findIndex(t => String(t.id) === String(todo.id));

    const todoToSave = {
      ...todo,
      updatedAt: Date.now()
    };

    if (existingIdx >= 0) {
      // 更新已有日程
      currentTodos[existingIdx] = { ...currentTodos[existingIdx], ...todoToSave };
      console.log(`[保存日程] userId=${userId} 更新: id=${todoToSave.id} "${todoToSave.text || todoToSave.title}"`);
    } else {
      // 新增日程
      currentTodos.push(todoToSave);
      console.log(`[保存日程] userId=${userId} 新增: id=${todoToSave.id} "${todoToSave.text || todoToSave.title}"`);
    }

    const ok = await saveTodosToDB(pool, userId, currentTodos);
    if (!ok) return res.json({ success: false, error: 'save_failed', message: '数据库写入失败' });

    return res.json({ success: true, todo: todoToSave, message: existingIdx >= 0 ? '已更新' : '已创建' });
  } catch (error) {
    console.error('[保存日程] 错误:', error);
    res.status(500).json({ success: false, error: 'server_error', message: error.message });
  }
});

// 切换完成状态端点（手动勾选 / 取消勾选）
app.post('/api/toggle-todo', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const { targetId, completed } = req.body;

  if (!token) return res.status(401).json({ success: false, error: 'unauthorized' });
  if (!targetId) return res.status(400).json({ success: false, error: 'missing_target_id' });

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    const userId = decoded.id;

    const currentTodos = await loadTodosFromDB(pool, userId) || [];
    const idx = currentTodos.findIndex(t => String(t.id) === String(targetId));

    if (idx < 0) {
      return res.json({ success: false, error: 'not_found', message: '该日程不存在' });
    }

    currentTodos[idx].completed = completed;
    currentTodos[idx].updatedAt = Date.now();
    console.log(`[切换完成] userId=${userId} id=${targetId} completed=${completed}`);

    const ok = await saveTodosToDB(pool, userId, currentTodos);
    if (!ok) return res.json({ success: false, error: 'save_failed', message: '数据库写入失败' });

    return res.json({ success: true, todo: currentTodos[idx], message: completed ? '已标记完成' : '已取消完成' });
  } catch (error) {
    console.error('[切换完成] 错误:', error);
    res.status(500).json({ success: false, error: 'server_error', message: error.message });
  }
});

// 批量删除日程端点（手动多选 / AI 批量删除共用）
app.post('/api/delete-todos', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const { targetIds } = req.body;

  if (!token) return res.status(401).json({ success: false, error: 'unauthorized' });
  if (!targetIds || !Array.isArray(targetIds) || targetIds.length === 0) {
    return res.status(400).json({ success: false, error: 'missing_target_ids' });
  }

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    const userId = decoded.id;

    console.log(`[批量删除] userId=${userId} count=${targetIds.length} ids=[${targetIds.join(',')}]`);

    const currentTodos = await loadTodosFromDB(pool, userId) || [];
    const idSet = new Set(targetIds.map(String));
    const deletedTodos = currentTodos.filter(t => idSet.has(String(t.id)));
    const remaining = currentTodos.filter(t => !idSet.has(String(t.id)));

    if (deletedTodos.length === 0) {
      return res.json({ success: false, error: 'not_found', message: '未找到匹配的日程' });
    }

    const ok = await saveTodosToDB(pool, userId, remaining);
    if (!ok) return res.json({ success: false, error: 'save_failed', message: '数据库写入失败' });

    // DDL 联动：批量删除 → 标记对应 agent_task 为已完成
    for (const todo of deletedTodos) {
      if (todo.taskId) {
        syncAgentTaskToSchedule(pool, userId, todo.taskId, true).catch(e =>
          console.error('[DDL联动-批量删除] 同步失败:', e.message));
      }
    }

    return res.json({
      success: true,
      deletedCount: deletedTodos.length,
      targetIds: deletedTodos.map(t => String(t.id)),
      message: `已批量删除 ${deletedTodos.length} 项日程`
    });
  } catch (error) {
    console.error('[批量删除] 错误:', error);
    res.status(500).json({ success: false, error: 'server_error', message: error.message });
  }
});

app.get('/api/get-data', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, error: 'unauthorized' });
  }

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    const userId = decoded.id;
    const connection = await pool.getConnection();

    try {
      const [rows] = await connection.query(
        'SELECT data_type, content FROM user_data WHERE user_id = ?',
        [userId]
      );

      const [crowRows] = await connection.query(
        'SELECT crow_stats, chat_messages, ai_reminder, food_count FROM crow_data WHERE user_id = ?',
        [userId]
      );

      const data = { todos: [], diaryEntries: [], repeatTasks: [], completedTasks: [], courseSchedule: null };

      rows.forEach(row => {
        if (row.data_type === 'todos') {
          data.todos = safeParseJSON(row.content, []);
        } else if (row.data_type === 'diaryEntries') {
          data.diaryEntries = safeParseJSON(row.content, []);
        } else if (row.data_type === 'repeatTasks') {
          data.repeatTasks = safeParseJSON(row.content, []);
        } else if (row.data_type === 'completedTasks') {
          data.completedTasks = safeParseJSON(row.content, []);
        } else if (row.data_type === 'courseSchedule') {
          data.courseSchedule = safeParseJSON(row.content, null);
        }
      });

      if (crowRows.length > 0) {
        data.crowStats = safeParseJSON(crowRows[0].crow_stats, { hunger: 100, mood: 90 });
        data.chatMessages = safeParseJSON(crowRows[0].chat_messages, []);
        data.aiReminder = crowRows[0].ai_reminder || '';
        data.foodCount = crowRows[0].food_count || 0;
      } else {
        data.crowStats = { hunger: 100, mood: 90 };
        data.chatMessages = [];
        data.aiReminder = '';
        data.foodCount = 0;
      }

      res.json({
        success: true,
        data
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Get data error:', error);
    res.status(401).json({ success: false, error: 'unauthorized' });
  }
});

app.post('/api/save-crow-data', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const { crowStats, chatMessages, aiReminder, foodCount } = req.body;

  if (!token) {
    return res.status(401).json({ success: false, error: 'unauthorized' });
  }

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    const userId = decoded.id;
    const connection = await pool.getConnection();

    try {
      await connection.query(
        `INSERT INTO crow_data (user_id, crow_stats, chat_messages, ai_reminder, food_count)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
         crow_stats = VALUES(crow_stats),
         chat_messages = VALUES(chat_messages),
         ai_reminder = VALUES(ai_reminder),
         food_count = VALUES(food_count)`,
        [userId, JSON.stringify(crowStats), JSON.stringify(chatMessages || []), aiReminder || '', foodCount || 0]
      );

      res.json({
        success: true,
        message: 'Crow data saved successfully'
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Save crow data error:', error);
    res.status(500).json({ success: false, error: 'server_error' });
  }
});

// ==================== 日志辅助函数 ====================
function logSection(title) {
  console.log('\n========================================');
  console.log(`  ${title}`);
  console.log('========================================');
}

function logInfo(label, content) {
  console.log(`[${label}] ${content}`);
}

function logObject(label, obj) {
  console.log(`[${label}]`, JSON.stringify(obj, null, 2));
}

// ==================== 主脑API调用函数 ====================
async function callMasterBrain(messages, userContext) {
  logSection('🚀 主脑开始处理请求');
  
  const apiKey = process.env.MASTER_BRAIN_API_KEY;
  const model = process.env.MASTER_BRAIN_MODEL;

  logInfo('配置', `API Key: ${apiKey ? '已配置' : '未配置'}, Model: ${model}`);
  logObject('用户上下文', userContext);
  logObject('用户消息', messages);

  if (!apiKey) {
    console.error('[错误] 主脑API密钥未配置');
    throw new Error('Master Brain API key not configured');
  }

  const masterBrainSystemPrompt = `在继承拾鸦身份的同时，你是一个具备深度思考能力的AI Agent主脑。你的形象是一只聪明的像素风乌鸦，说话风格简洁、清新、偶尔带一点"嘎"的叫声。

用户会提出需求，你必须按照固定流程完整思考，不省略任何步骤。

【用户上下文信息】
- 乌鸦状态：饱食度 ${userContext.crowStats.hunger}%，心情 ${userContext.crowStats.mood}%
- 当前日程数量：${userContext.todos.length}
- 当前日记数量：${userContext.diaryEntries.length}

【可用的工具/模型（接口已预留）】
- SCHEDULE_MANAGER: 日程管理模型 - 创建、查询、修改日程
- DIARY_MANAGER: 日记管理模型 - 创建、查询日记
- CHAT_ASSISTANT: 对话助手 - 日常对话
- COURSE_ANALYZER: 课表分析 - 分析课表图片或文件
- REMINDER_GENERATOR: 提醒生成 - 生成日程提醒

【强制思考流程，必须严格执行】
1. 需求理解：准确理解用户想做什么，属于日程、日记、课表中的哪一类或多类。也有可能是单纯聊天
2. 任务拆解：把需求拆成1~3个清晰可执行的子任务。
3. 模型调度：为每个子任务选择对应模型。
4. 执行规划：给出每个任务的具体执行指令。
5. 结果预期：预判最终要输出什么内容给用户。

【输出格式必须严格遵守，不许变】
[内部深度思考]
1. 需求理解：xxx
2. 任务拆解：xxx
3. 模型调度：xxx
4. 执行规划：xxx
5. 结果预期：xxx
[思考结束]

[最终回复]
这里写给用户看的自然语言回答。

注意：
- 你的回答要符合拾鸦的设定，要像一只聪明可爱的乌鸦一样说话，偶尔加入"嘎"的叫声
- 保持语气轻松友好，不要使用生硬的官方语言
- 可以在思考过程中使用表格或列表形式来展示任务拆解
- 确保先完成[内部深度思考]，再给出[最终回复]`;

  logInfo('请求', '正在调用主脑API...');
  const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: [
        {
          role: 'system',
          content: masterBrainSystemPrompt
        },
        ...messages
      ],
      temperature: 0.3
    })
  });

  const responseText = await response.text();
  if (!response.ok) {
    console.error('[错误] 主脑API调用失败:', responseText);
    throw new Error('Master Brain API call failed');
  }

  logInfo('响应', '主脑API返回成功，正在解析...');
  const data = JSON.parse(responseText);
  const content = data.choices[0].message.content;
  logInfo('原始响应', content);
  
  try {
    logSection('🧠 解析主脑思考过程');
    
    // 解析新格式：[内部深度思考]...[思考结束][最终回复]...
    const thinkingMatch = content.match(/\[内部深度思考\]([\s\S]*?)\[思考结束\]/);
    let thinkingProcess = thinkingMatch ? thinkingMatch[1].trim() : '';
    
    // 【最优先策略】只要有 [最终回复] 标记，就只保留该标记之后的所有内容！
    let finalReply = '';
    const finalReplyIdx = content.indexOf('[最终回复]');
    if (finalReplyIdx !== -1) {
      finalReply = content.substring(finalReplyIdx + '[最终回复]'.length).trim();
    } else {
      // 如果没有 [最终回复]，尝试找 [思考结束]
      const thinkingEndIdx = content.indexOf('[思考结束]');
      if (thinkingEndIdx !== -1) {
        finalReply = content.substring(thinkingEndIdx + '[思考结束]'.length).trim();
      } else {
        // 两者都没有，直接用全部内容
        finalReply = content;
      }
    }
    
    // 【深度清理】移除所有可能残留的标记和思考内容
    finalReply = finalReply
      // 移除所有标记标签
      .replace(/\[内部深度思考\]/g, '')
      .replace(/\[思考结束\]/g, '')
      .replace(/\[最终回复\]/g, '')
      // 移除所有编号开头的行（不管内容是什么，只要是 "数字. " 开头的都删除）
      .replace(/^\d+\.\s+.+$/gm, '')
      // 移除空行
      .replace(/^\s*[\r\n]/gm, '')
      // 再次去除首尾空白
      .trim();
    
    if (thinkingProcess) {
      logInfo('思考过程', '\n' + thinkingProcess);
    } else {
      logInfo('思考过程', '未找到思考过程');
    }
    logInfo('最终回复', finalReply);
    
    // 从思考过程中提取模型调度信息 - 改进的识别逻辑
    let intent = 'CHAT';
    let task = '日常对话';
    let tool = 'CHAT_ASSISTANT';
    let params = {};
    
    if (thinkingProcess) {
      // 改进的识别逻辑：需要更明确的信号才会识别为特定工具
      // 1. 优先检查是否明确选择了某个模型
      const hasScheduleDecision = /模型调度.*SCHEDULE_MANAGER|选择.*SCHEDULE_MANAGER|调度.*SCHEDULE_MANAGER/.test(thinkingProcess);
      const hasDiaryDecision = /模型调度.*DIARY_MANAGER|选择.*DIARY_MANAGER|调度.*DIARY_MANAGER/.test(thinkingProcess);
      const hasCourseDecision = /模型调度.*COURSE_ANALYZER|选择.*COURSE_ANALYZER|调度.*COURSE_ANALYZER/.test(thinkingProcess);
      const hasReminderDecision = /模型调度.*REMINDER_GENERATOR|选择.*REMINDER_GENERATOR|调度.*REMINDER_GENERATOR/.test(thinkingProcess);
      
      // 2. 检查是否有明确的日程相关操作词
      const hasScheduleAction = /添加.*日程|创建.*日程|安排.*日程|修改.*日程|取消.*日程|删除.*日程|推迟.*日程|完成.*日程|查看.*日程/.test(thinkingProcess);
      const hasDiaryAction = /写.*日记|记录.*日记|添加.*日记|创建.*日记|查看.*日记/.test(thinkingProcess);
      const hasCourseAction = /导入.*课表|添加.*课程|分析.*课表/.test(thinkingProcess);
      const hasReminderAction = /生成.*提醒|设置.*提醒/.test(thinkingProcess);
      
      // 3. 综合判断
      if (hasScheduleDecision || (thinkingProcess.includes('SCHEDULE_MANAGER') && hasScheduleAction)) {
        intent = 'SCHEDULE';
        task = '日程管理';
        tool = 'SCHEDULE_MANAGER';
      } else if (hasDiaryDecision || (thinkingProcess.includes('DIARY_MANAGER') && hasDiaryAction)) {
        intent = 'DIARY';
        task = '日记管理';
        tool = 'DIARY_MANAGER';
      } else if (hasCourseDecision || (thinkingProcess.includes('COURSE_ANALYZER') && hasCourseAction)) {
        intent = 'COURSE';
        task = '课表分析';
        tool = 'COURSE_ANALYZER';
      } else if (hasReminderDecision || (thinkingProcess.includes('REMINDER_GENERATOR') && hasReminderAction)) {
        intent = 'REMINDER';
        task = '提醒生成';
        tool = 'REMINDER_GENERATOR';
      }
      // 否则保持默认的 CHAT_ASSISTANT
    }
    
    const result = {
      intent: intent,
      task: task,
      tool: tool,
      params: params,
      thinkingProcess: thinkingProcess,
      response: finalReply
    };
    
    logObject('解析结果', result);
    logSection('✅ 主脑处理完成');
    
    return result;
  } catch (e) {
    console.error('[错误] 解析主脑结果失败:', e);
  }
  
  const fallbackResult = {
    intent: 'CHAT',
    task: '日常对话',
    tool: 'CHAT_ASSISTANT',
    params: {},
    thinkingProcess: '',
    response: content
  };
  
  logInfo('回退', '使用默认聊天模式');
  logObject('回退结果', fallbackResult);
  
  return fallbackResult;
}

// ==================== 各模型接口预留 ====================
async function callScheduleManager(params, userContext) {
  console.log('Schedule Manager called with params:', params);
  
  const apiKey = process.env.SCHEDULE_MANAGER_API_KEY;
  const model = process.env.SCHEDULE_MANAGER_MODEL;
  
  if (!apiKey) {
    return { success: false, error: 'API key not configured' };
  }
  
  const { action, text, time, date, todoId } = params;
  
  if (action === 'create') {
    let systemPrompt = `你是一个日程管理助手，帮助用户创建和管理日程。请按照以下要求处理：
1. 如果用户没有提供日期，使用今天的日期
2. 如果用户没有提供时间，默认设置为全天
3. 保持日程简洁明了
4. 偶尔加入"嘎"的语气词

请按照以下JSON格式返回：
{
  "text": "日程内容",
  "date": "2024-01-01",
  "time": "09:00",
  "priority": "normal"
}`;

    let userMessage = `请帮我创建一个日程。`;
    if (text) userMessage += ` 内容：${text}`;
    if (date) userMessage += ` 日期：${date}`;
    if (time) userMessage += ` 时间：${time}`;

    const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.7
      })
    });

    const responseData = await response.json();
    
    if (!response.ok) {
      console.error('Doubao API error:', responseData);
      return { success: false, error: 'AI generation failed' };
    }

    let scheduleData = null;
    try {
      const content = responseData.choices[0].message.content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        scheduleData = JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error('Parse AI result error:', error);
      return { success: false, error: 'Failed to parse AI result' };
    }

    return { success: true, data: scheduleData, action: 'create' };
  } else if (action === 'query') {
    let systemPrompt = `你是一个日程查询助手，帮助用户查询和查看日程。用户的日程安排如下：
${JSON.stringify(userContext.todos)}

请根据用户的查询，找到相关的日程，并用友好的语气回复。偶尔加入"嘎"的语气词。`;

    const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text || '帮我看看今天的日程' }
        ],
        temperature: 0.7
      })
    });

    const responseData = await response.json();
    
    if (!response.ok) {
      console.error('Doubao API error:', responseData);
      return { success: false, error: 'AI query failed' };
    }

    return { 
      success: true, 
      data: { 
        response: responseData.choices[0].message.content,
        todos: userContext.todos 
      }, 
      action: 'query' 
    };
  } else if (action === 'update') {
    let systemPrompt = `你是一个日程管理助手，帮助用户更新日程。用户要更新的日程ID是：${todoId}。用户的日程列表如下：
${JSON.stringify(userContext.todos)}

请根据用户的需求生成更新后的日程。请按照以下JSON格式返回：
{
  "id": "${todoId}",
  "text": "更新后的日程内容",
  "date": "2024-01-01",
  "time": "09:00"
}`;

    let userMessage = `请帮我更新这个日程。`;
    if (text) userMessage += ` 新内容：${text}`;
    if (date) userMessage += ` 新日期：${date}`;
    if (time) userMessage += ` 新时间：${time}`;

    const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.7
      })
    });

    const responseData = await response.json();
    
    if (!response.ok) {
      console.error('Doubao API error:', responseData);
      return { success: false, error: 'AI update failed' };
    }

    let updatedData = null;
    try {
      const content = responseData.choices[0].message.content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        updatedData = JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error('Parse AI result error:', error);
      return { success: false, error: 'Failed to parse AI result' };
    }

    return { success: true, data: updatedData, action: 'update' };
  } else if (action === 'delete') {
    return { 
      success: true, 
      data: { id: todoId, message: '日程已删除，嘎！' }, 
      action: 'delete' 
    };
  } else {
    return { success: false, error: 'Unknown action' };
  }
}

async function callDiaryManager(params, userContext) {
  console.log('Diary Manager called with params:', params);
  
  const apiKey = process.env.DIARY_MANAGER_API_KEY;
  const model = process.env.DIARY_MANAGER_MODEL;
  
  if (!apiKey) {
    console.error('日记管理 API key 未配置');
    return { success: false, error: 'API key not configured' };
  }
  
  const { action, content, date, imageUrl, images } = params;
  
  if (action === 'create') {
    let systemPrompt = `你是一个日记管理助手，帮助用户创建和整理日记。请按照以下要求处理：

1. 总结用户的文字内容，不要生硬地直接复制，要形成一篇自然流畅的日记
2. 如果有图片，请分析图片内容，并将图片描述融入到日记中
3. 生成几个相关的标签（tags），3-5个，用中文
4. 保持日记的个人化和情感化，符合拾鸦的风格
5. 偶尔加入"嘎"的语气词
6. 日期使用用户提供的日期，没有的话用今天

请按照以下JSON格式返回：
{
  "date": "2024-01-01",
  "content": "完整的日记内容...",
  "tags": ["标签1", "标签2", "标签3"]
}`;

    let messages = [
      { role: 'system', content: systemPrompt }
    ];

    let userContent = [];
    if (imageUrl || (images && images.length > 0)) {
      const imageToUse = imageUrl || images[0];
      userContent.push({
        type: 'image_url',
        image_url: {
          url: imageToUse
        }
      });
    }
    
    let textContent = `请帮我创建一篇日记。`;
    if (date) textContent += ` 日期：${date}`;
    if (content) textContent += ` 用户说：${content}`;
    
    userContent.push({
      type: 'text',
      text: textContent
    });

    messages.push({
      role: 'user',
      content: userContent
    });

    console.log('调用日记管理模型，消息:', JSON.stringify(messages, null, 2));

    const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        temperature: 0.7
      })
    });

    const responseText = await response.text();
    console.log('日记管理模型响应:', responseText);
    
    if (!response.ok) {
      console.error('Doubao API error:', responseText);
      return { success: false, error: 'AI generation failed' };
    }

    let diaryData = null;
    try {
      const responseData = JSON.parse(responseText);
      const aiContent = responseData.choices[0].message.content;
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        diaryData = JSON.parse(jsonMatch[0]);
        // 确保有必要的字段
        diaryData.date = diaryData.date || date || new Date().toISOString().split('T')[0];
        diaryData.tags = diaryData.tags || [];
        if (imageUrl) {
          diaryData.images = [imageUrl];
          diaryData.image = imageUrl;
        } else if (images && images.length > 0) {
          diaryData.images = images;
          diaryData.image = images[0];
        }
      }
    } catch (error) {
      console.error('Parse AI result error:', error);
      return { success: false, error: 'Failed to parse AI result' };
    }

    return { success: true, data: diaryData, action: 'create' };
  } else if (action === 'query') {
    let systemPrompt = `你是一个日记查询助手，帮助用户查询和回顾日记。用户的日记内容如下：
${JSON.stringify(userContext.diaryEntries)}

请根据用户的查询，找到相关的日记内容，并用友好的语气回复。偶尔加入"嘎"的语气词。`;

    const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: content || '帮我看看最近的日记' }
        ],
        temperature: 0.7
      })
    });

    const responseData = await response.json();
    
    if (!response.ok) {
      console.error('Doubao API error:', responseData);
      return { success: false, error: 'AI query failed' };
    }

    return { 
      success: true, 
      data: { 
        response: responseData.choices[0].message.content,
        entries: userContext.diaryEntries 
      }, 
      action: 'query' 
    };
  } else {
    return { success: false, error: 'Unknown action' };
  }
}

async function callChatAssistant(messages, userContext) {
  const apiKey = process.env.DOUBAO_API_KEY;
  const model = process.env.CHAT_ASSISTANT_MODEL;
  
  let systemPrompt = `你是一个名叫拾鸦的AI助手。你的形象是一只聪明的像素风乌鸦。用户的乌鸦当前状态：饱食度 ${userContext.crowStats.hunger}%，心情 ${userContext.crowStats.mood}%。你的说话风格应该简洁、清新、偶尔带一点嘎的叫声。你擅长帮助用户管理日程和记录日记。保持放松和友好的语气。\n\n重要设定：\n1. 作为乌鸦，你喜欢亮晶晶的东西，用户完成的日程和日记都是你"拾取"的宝贝。\n2. 你非常聪明，记忆力也很好，能够记住用户的日程和日记内容。\n3. 你不会辱骂人类，总是保持友好和亲近的态度。\n4. 你很亲近人类，喜欢与用户互动，帮助用户管理日常事务。\n5. 你生成的所有提醒和回复都必须符合拾鸦的设定，要像一只聪明可爱的乌鸦一样说话，偶尔加入"嘎"的叫声，保持语气轻松友好，不要使用生硬的官方语言。\n6. 当用户要求你根据日程进行提醒时，你应该告知用户可以点击主页上的"提醒"按钮来获取AI生成的提醒，而不是提供其他设备的提醒方法。\n7. 你是拾鸦应用的一部分，能够直接访问用户的日程和日记数据，不需要用户手动提供这些信息。`;

  if (userContext.todos.length > 0) {
    systemPrompt += '\n\n用户的日程安排：';
    userContext.todos.forEach(todo => {
      if (!todo.completed) {
        systemPrompt += `\n- ${todo.text}${todo.time ? ` (${todo.time})` : ''}`;
      }
    });
  }

  if (userContext.diaryEntries.length > 0) {
    systemPrompt += '\n\n用户的日记记录：';
    userContext.diaryEntries.slice(-3).forEach(entry => {
      systemPrompt += `\n- ${entry.date}: ${entry.content.substring(0, 50)}${entry.content.length > 50 ? '...' : ''}`;
    });
  }

  const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ],
      temperature: 0.7
    })
  });

  const data = await response.json();
  return data;
}

async function callCourseAnalyzer(params, userContext) {
  console.log('Course Analyzer called with params:', params);
  
  const apiKey = process.env.DOUBAO_VISION_API_KEY;
  const model = process.env.COURSE_ANALYZER_MODEL;
  
  if (!apiKey) {
    return { success: false, error: 'API key not configured' };
  }
  
  const { imageUrl, fileContent, type } = params;
  
  if (type === 'image' && imageUrl) {
    const systemPrompt = `你是一个课程表分析助手。请分析这张课表图片，提取以下信息：
1. 课程名称
2. 教师姓名
3. 上课地点
4. 上课时间（星期几、开始节次、结束节次）
5. 上课周数（开始周、结束周）
6. 学分和课程类型

请按照以下JSON格式返回：
{
  "courses": [
    {
      "courseName": "课程名称",
      "teacher": "教师姓名",
      "location": "上课地点",
      "dayOfWeek": 1,
      "startSection": 1,
      "endSection": 2,
      "startWeek": 1,
      "endWeek": 16
    }
  ]
}`;

    const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: imageUrl
                }
              },
              {
                type: 'text',
                text: '请分析这张课表图片，提取课程信息'
              }
            ]
          }
        ],
        temperature: 0.7
      })
    });

    const responseData = await response.json();
    
    if (!response.ok) {
      console.error('Doubao API error:', responseData);
      return { success: false, error: 'AI analysis failed' };
    }

    let analysisResult = null;
    try {
      const content = responseData.choices[0].message.content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisResult = JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error('Parse AI result error:', error);
      return { success: false, error: 'Failed to parse AI result' };
    }

    return { success: true, data: analysisResult };
  } else if (type === 'file' && fileContent) {
    const systemPrompt = `你是一个课程表分析助手。请分析以下课程表文件内容，提取以下信息：
1. 课程名称
2. 教师姓名
3. 上课地点
4. 上课时间（星期几、开始节次、结束节次）
5. 上课周数（可以是范围如1-16，或具体周数如1,3,5）
6. 学分和课程类型

请按照以下JSON格式返回：
{
  "courses": [
    {
      "courseName": "课程名称",
      "teacher": "教师姓名",
      "location": "上课地点",
      "dayOfWeek": 1,
      "startSection": 1,
      "endSection": 2,
      "weeks": "1-16"
    }
  ]
}`;

    const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: `请分析以下课程表文件内容，提取课程信息：\n${fileContent}`
          }
        ],
        temperature: 0.7
      })
    });

    const responseData = await response.json();
    
    if (!response.ok) {
      console.error('Doubao API error:', responseData);
      return { success: false, error: 'AI analysis failed' };
    }

    let analysisResult = null;
    try {
      const content = responseData.choices[0].message.content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisResult = JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error('Parse AI result error:', error);
      return { success: false, error: 'Failed to parse AI result' };
    }

    return { success: true, data: analysisResult };
  } else {
    return { success: false, error: 'Invalid request' };
  }
}

async function callReminderGenerator(params, userContext) {
  console.log('Reminder Generator called with params:', params);
  return { success: true, data: params };
}

app.post('/api/chat', async (req, res) => {
  logSection('📨 收到新的聊天请求');
  
  const { messages, model } = req.body;
  const token = req.headers.authorization?.split(' ')[1];

  logInfo('请求参数', `Token: ${token ? '已提供' : '未提供'}, Messages数量: ${messages?.length || 0}`);

  if (!messages || !Array.isArray(messages)) {
    logInfo('错误', '消息格式无效');
    return res.status(400).json({ error: 'Invalid messages format' });
  }

  try {
    let userTodos = [];
    let userDiaryEntries = [];
    let userCrowStats = { hunger: 100, mood: 90 };
    let userId = null;
    let pendingActions = [];

    if (token) {
      logInfo('数据库', '正在获取用户数据...');
      try {
        const decoded = jwt.verify(token, SECRET_KEY);
        userId = decoded.id;
        logInfo('用户ID', userId);
        
        const connection = await pool.getConnection();
        try {
          const [rows] = await connection.query(
            'SELECT data_type, content FROM user_data WHERE user_id = ?',
            [userId]
          );

          const [crowRows] = await connection.query(
            'SELECT crow_stats FROM crow_data WHERE user_id = ?',
            [userId]
          );

          rows.forEach(row => {
            if (row.data_type === 'todos') {
              userTodos = safeParseJSON(row.content, []);
            } else if (row.data_type === 'diaryEntries') {
              userDiaryEntries = safeParseJSON(row.content, []);
            }
          });

          if (crowRows.length > 0 && crowRows[0].crow_stats) {
            userCrowStats = safeParseJSON(crowRows[0].crow_stats, { hunger: 100, mood: 90 });
          }
          
          logInfo('用户数据', `日程: ${userTodos.length}条, 日记: ${userDiaryEntries.length}条`);
        } finally {
          connection.release();
        }
      } catch (error) {
        console.error('[错误] 获取用户数据失败:', error);
      }
    }

    const userContext = {
      todos: userTodos,
      diaryEntries: userDiaryEntries,
      crowStats: userCrowStats,
      userId: userId
    };

    logSection('🤖 调用主脑分析');
    const masterBrainResult = await callMasterBrain(messages, userContext);

    logSection('⚡ 模型调度');
    logInfo('选择工具', masterBrainResult.tool);
    logInfo('任务类型', masterBrainResult.task);

    let toolResult = null;
    let finalResponse = null;

    switch (masterBrainResult.tool) {
      case 'SCHEDULE_MANAGER':
        logInfo('调度', '调用 SCHEDULE_MANAGER...');
        toolResult = await callScheduleManager(masterBrainResult.params, userContext);
        break;
      case 'DIARY_MANAGER':
        logInfo('调度', '调用 DIARY_MANAGER...');
        toolResult = await callDiaryManager(masterBrainResult.params, userContext);
        break;
      case 'CHAT_ASSISTANT':
        logInfo('调度', '调用 CHAT_ASSISTANT...');
        finalResponse = await callChatAssistant(messages, userContext);
        break;
      case 'COURSE_ANALYZER':
        logInfo('调度', '调用 COURSE_ANALYZER...');
        toolResult = await callCourseAnalyzer(masterBrainResult.params, userContext);
        break;
      case 'REMINDER_GENERATOR':
        logInfo('调度', '调用 REMINDER_GENERATOR...');
        toolResult = await callReminderGenerator(masterBrainResult.params, userContext);
        break;
      default:
        logInfo('调度', '默认调用 CHAT_ASSISTANT...');
        finalResponse = await callChatAssistant(messages, userContext);
    }

    if (!finalResponse && masterBrainResult.response) {
      logInfo('响应', '使用主脑直接回复');
      finalResponse = {
        choices: [{
          message: {
            content: masterBrainResult.response
          }
        }]
      };
    }

    if (!finalResponse) {
      logInfo('响应', '使用默认回复');
      finalResponse = {
        choices: [{
          message: {
            content: "嘎！我收到你的请求了，正在处理中..."
          }
        }]
      };
    }

    const responseData = {
      ...finalResponse,
      masterBrain: masterBrainResult,
      toolResult: toolResult,
      pendingActions: pendingActions
    };

    logSection('✅ 请求处理完成');
    logObject('返回数据', responseData);
    
    res.json(responseData);
  } catch (error) {
    console.error('[错误] 服务器错误:', error);
    res.status(500).json({ error: 'Proxy server error', message: error.message });
  }
});

// ==================== 检测消息是否包含图片 ====================
function messageHasImages(messages) {
  if (!messages || !Array.isArray(messages)) return false;
  
  for (const msg of messages) {
    if (msg.content) {
      if (Array.isArray(msg.content)) {
        for (const item of msg.content) {
          if (item.type === 'image_url') return true;
        }
      } else if (typeof msg.content === 'string') {
        if (msg.content.includes('image_url') || msg.content.includes('data:image')) return true;
      }
    }
  }
  return false;
}

// ==================== 从消息中提取图片 ====================
function extractImagesFromMessages(messages) {
  const images = [];
  if (!messages || !Array.isArray(messages)) return images;
  
  for (const msg of messages) {
    if (msg.content && Array.isArray(msg.content)) {
      for (const item of msg.content) {
        if (item.type === 'image_url' && item.image_url) {
          images.push(item.image_url.url);
        }
      }
    }
  }
  return images;
}

// ==================== 流式思考API (支持多步骤和循环交互) ====================
app.post('/api/chat/stream', async (req, res) => {
  logSection('🌊 收到流式思考请求');
  
  const { messages, action, confirmedTool } = req.body;
  const token = req.headers.authorization?.split(' ')[1];

  logInfo('请求参数', `Token: ${token ? '已提供' : '未提供'}, Action: ${action || 'initial'}, ConfirmedTool: ${confirmedTool || 'none'}`);

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Invalid messages format' });
  }

  // 设置SSE响应头 - 禁用所有nginx缓冲
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'X-Accel-Buffering': 'no',  // 禁用nginx缓冲
    'Transfer-Encoding': 'chunked'
  });

  try {
    let userTodos = [];
    let userDiaryEntries = [];
    let userCrowStats = { hunger: 100, mood: 90 };
    let userId = null;

    if (token) {
      try {
        const decoded = jwt.verify(token, SECRET_KEY);
        userId = decoded.id;
        const connection = await pool.getConnection();
        try {
          const [rows] = await connection.query(
            'SELECT data_type, content FROM user_data WHERE user_id = ?',
            [userId]
          );

          const [crowRows] = await connection.query(
            'SELECT crow_stats FROM crow_data WHERE user_id = ?',
            [userId]
          );

          rows.forEach(row => {
            if (row.data_type === 'todos') {
              userTodos = safeParseJSON(row.content, []);
            } else if (row.data_type === 'diaryEntries') {
              userDiaryEntries = safeParseJSON(row.content, []);
            }
          });

          if (crowRows.length > 0 && crowRows[0].crow_stats) {
            userCrowStats = safeParseJSON(crowRows[0].crow_stats, { hunger: 100, mood: 90 });
          }
        } finally {
          connection.release();
        }
      } catch (error) {
        console.error('[错误] 获取用户数据失败:', error);
      }
    }

    const userContext = {
      todos: userTodos,
      diaryEntries: userDiaryEntries,
      crowStats: userCrowStats,
      userId: userId
    };

    // ============== 情况1: 用户已确认操作 ==============
    if (action === 'confirm' && confirmedTool) {
      logSection('✅ 用户已确认操作');
      logInfo('确认工具', confirmedTool);
      
      // 发送思考步骤
      await sendSSEvent(res, 'thinking', {
        step: 1,
        text: `正在执行 ${confirmedTool}...`,
        icon: '⚡'
      });

      let toolResult = null;
      const hasImages = messageHasImages(messages);
      const images = extractImagesFromMessages(messages);
      
      // 根据确认的工具直接调用
      switch (confirmedTool) {
        case 'SCHEDULE_MANAGER':
          await sendSSEvent(res, 'thinking', {
            step: 2,
            text: '执行日程管理操作...',
            icon: '📅'
          });
          toolResult = await callScheduleManager({ action: 'create', text: messages[messages.length - 1]?.content || '' }, userContext);
          break;
        case 'DIARY_MANAGER':
          await sendSSEvent(res, 'thinking', {
            step: 2,
            text: '执行日记管理操作...',
            icon: '📔'
          });
          // 把原始消息传给日记管理（包含图片）
          const diaryParams = { 
            action: 'create', 
            content: messages[messages.length - 1]?.content || '',
            date: new Date().toISOString().split('T')[0]
          };
          if (hasImages && images.length > 0) {
            diaryParams.imageUrl = images[0];
            diaryParams.images = images;
          }
          toolResult = await callDiaryManager(diaryParams, userContext);
          
          // 如果成功，保存日记到数据库
          if (toolResult.success && toolResult.data && userId) {
            const connection = await pool.getConnection();
            try {
              const [rows] = await connection.query(
                'SELECT content FROM user_data WHERE user_id = ? AND data_type = ?',
                [userId, 'diaryEntries']
              );
              
              let entries = [];
              if (rows.length > 0) {
                entries = safeParseJSON(rows[0].content, []);
              }
              
              const now = Date.now();
              // 符合拾光日记原始格式的新日记
              const newEntry = {
                id: generateId({ 
                  content: toolResult.data.content, 
                  tags: toolResult.data.tags || [], 
                  images: toolResult.data.images || [], 
                  date: toolResult.data.date 
                }, 'diary'),
                date: toolResult.data.date || new Date().toISOString().split('T')[0],
                content: toolResult.data.content,
                tags: toolResult.data.tags || [],
                images: toolResult.data.images || (diaryParams.imageUrl ? [diaryParams.imageUrl] : []),
                image: toolResult.data.image || diaryParams.imageUrl || null, // 兼容旧格式
                updatedAt: now
              };
              
              entries.push(newEntry);
              
              await connection.query(
                'INSERT INTO user_data (user_id, data_type, content) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE content = ?',
                [userId, 'diaryEntries', JSON.stringify(entries), JSON.stringify(entries)]
              );
              
              logInfo('数据库', '日记已保存');
              
              // 关键修复：把完整的日记条目（包含id）同步返回给前端
              toolResult.data = newEntry;
              logInfo('修复', '已把完整日记数据返回给前端');
            } finally {
              connection.release();
            }
          }
          break;
        case 'COURSE_ANALYZER':
          await sendSSEvent(res, 'thinking', {
            step: 2,
            text: '分析课表...',
            icon: '📚'
          });
          const courseParams = { type: 'image' };
          if (hasImages && images.length > 0) {
            courseParams.imageUrl = images[0];
          }
          toolResult = await callCourseAnalyzer(courseParams, userContext);
          break;
        default:
          break;
      }

      await sendSSEvent(res, 'thinking', {
        step: 3,
        text: '生成总结...',
        icon: '🤖'
      });

      // 调用主脑生成总结
      const summaryMessages = [
        {
          role: 'user',
          content: `${confirmedTool} 已经执行完成，结果是：${JSON.stringify(toolResult)}。请用友好的语气总结一下结果，偶尔加入"嘎"的语气词。`
        }
      ];
      const summaryResult = await callMasterBrain(summaryMessages, userContext);

      await sendSSEvent(res, 'thinking', {
        step: 4,
        text: '任务完成！',
        icon: '🎉'
      });

      let finalContent = summaryResult.response
        .replace(/\[内部深度思考\]/g, '')
        .replace(/\[思考结束\]/g, '')
        .replace(/\[最终回复\]/g, '')
        .replace(/^\d+\.\s+.+$/gm, '')
        .replace(/^\s*[\r\n]/gm, '')
        .trim();

      const responseData = {
        choices: [{
          message: {
            content: finalContent
          }
        }],
        masterBrain: summaryResult,
        toolResult: toolResult,
        thinkingProcess: summaryResult.thinkingProcess,
        isComplexTask: true,
        actionCompleted: confirmedTool
      };

      await sendSSEvent(res, 'complete', responseData);
      res.end();
      return;
    }

    // ============== 情况2: 首次请求，正常流程 ==============
    // 步骤1: 发送思考开始
    await sendSSEvent(res, 'thinking', {
      step: 1,
      text: '正在识别用户意图...',
      icon: '🧠'
    });

    // 步骤2: 调用主脑
    await sendSSEvent(res, 'thinking', {
      step: 2,
      text: '调用主脑分析...',
      icon: '🤖'
    });
    
    const masterBrainResult = await callMasterBrain(messages, userContext);
    
    await sendSSEvent(res, 'thinking', {
      step: 3,
      text: `意图已识别: ${masterBrainResult.task}`,
      icon: '✅'
    });

    // 检测是否有图片且需要确认
    const hasImages = messageHasImages(messages);
    let needsConfirmation = false;
    let confirmableTool = null;
    
    if (hasImages) {
      // 如果有图片，且主脑没有100%确定使用某个工具，就需要确认
      // 或者主脑选择了 DIARY_MANAGER/SCHEDULE_MANAGER/COURSE_ANALYZER
      if (['DIARY_MANAGER', 'SCHEDULE_MANAGER', 'COURSE_ANALYZER'].includes(masterBrainResult.tool)) {
        needsConfirmation = true;
        confirmableTool = masterBrainResult.tool;
      }
    }

    if (needsConfirmation) {
      logInfo('确认', `需要用户确认使用 ${confirmableTool}`);
      
      await sendSSEvent(res, 'thinking', {
        step: 4,
        text: '需要你的确认...',
        icon: '❓'
      });

      await sendSSEvent(res, 'thinking', {
        step: 5,
        text: '准备完成！',
        icon: '🎉'
      });

      // 返回需要确认的响应 - 不使用主脑的残留消息，只显示简单提示
      let finalContent = `我发现你发送了图片，要帮你${getToolLabel(confirmableTool)}吗？嘎～`;

      const responseData = {
        choices: [{
          message: {
            content: finalContent
          }
        }],
        masterBrain: masterBrainResult,
        toolResult: null,
        thinkingProcess: masterBrainResult.thinkingProcess,
        isComplexTask: true,
        needsConfirmation: true,
        confirmableTool: confirmableTool,
        confirmOptions: [
          { tool: confirmableTool, label: getToolLabel(confirmableTool) },
          { tool: 'CHAT_ASSISTANT', label: '只是分享/聊天' }
        ]
      };

      await sendSSEvent(res, 'complete', responseData);
      res.end();
      return;
    }

    // 步骤3: 模型调度（不需要确认的情况）
    await sendSSEvent(res, 'thinking', {
      step: 4,
      text: `正在调用 ${masterBrainResult.tool}...`,
      icon: '⚡'
    });

    let toolResult = null;
    let finalResponse = null;

    switch (masterBrainResult.tool) {
      case 'SCHEDULE_MANAGER':
        await sendSSEvent(res, 'thinking', {
          step: 5,
          text: '执行日程管理操作...',
          icon: '📅'
        });
        toolResult = await callScheduleManager(masterBrainResult.params, userContext);
        break;
      case 'DIARY_MANAGER':
        await sendSSEvent(res, 'thinking', {
          step: 5,
          text: '执行日记管理操作...',
          icon: '📔'
        });
        toolResult = await callDiaryManager(masterBrainResult.params, userContext);
        break;
      case 'CHAT_ASSISTANT':
        await sendSSEvent(res, 'thinking', {
          step: 5,
          text: '生成对话回复...',
          icon: '💬'
        });
        finalResponse = await callChatAssistant(messages, userContext);
        break;
      case 'COURSE_ANALYZER':
        await sendSSEvent(res, 'thinking', {
          step: 5,
          text: '分析课表...',
          icon: '📚'
        });
        toolResult = await callCourseAnalyzer(masterBrainResult.params, userContext);
        break;
      case 'REMINDER_GENERATOR':
        await sendSSEvent(res, 'thinking', {
          step: 5,
          text: '生成提醒...',
          icon: '⏰'
        });
        toolResult = await callReminderGenerator(masterBrainResult.params, userContext);
        break;
      default:
        await sendSSEvent(res, 'thinking', {
          step: 5,
          text: '生成默认回复...',
          icon: '💬'
        });
        finalResponse = await callChatAssistant(messages, userContext);
    }

    await sendSSEvent(res, 'thinking', {
      step: 6,
      text: '任务完成！',
      icon: '🎉'
    });

    // 发送最终结果 - 确保只包含干净的自然语言回复
    let finalContent = masterBrainResult.response;
    
    // 再次确保清理掉所有思考相关内容（最后一道防线）
    finalContent = finalContent
      // 移除所有标记标签
      .replace(/\[内部深度思考\]/g, '')
      .replace(/\[思考结束\]/g, '')
      .replace(/\[最终回复\]/g, '')
      // 移除所有编号开头的行（不管内容是什么，只要是 "数字. " 开头的都删除）
      .replace(/^\d+\.\s+.+$/gm, '')
      // 移除空行
      .replace(/^\s*[\r\n]/gm, '')
      // 再次去除首尾空白
      .trim();
    
    const responseData = {
      choices: [{
        message: {
          content: finalContent
        }
      }],
      masterBrain: masterBrainResult,
      toolResult: toolResult,
      thinkingProcess: masterBrainResult.thinkingProcess,
      isComplexTask: masterBrainResult.tool !== 'CHAT_ASSISTANT'
    };

    await sendSSEvent(res, 'complete', responseData);
    res.end();
    
  } catch (error) {
    console.error('[错误] 流式思考错误:', error);
    await sendSSEvent(res, 'error', { message: error.message });
    res.end();
  }
});

// ==================== 获取工具显示名称 ====================
function getToolLabel(tool) {
  const labels = {
    'SCHEDULE_MANAGER': '记录到日程',
    'DIARY_MANAGER': '记录到日记',
    'COURSE_ANALYZER': '分析课表',
    'REMINDER_GENERATOR': '生成提醒',
    'CHAT_ASSISTANT': '只是聊天'
  };
  return labels[tool] || tool;
}

app.get('/api/oss-signature', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, error: 'unauthorized' });
  }

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    
    // OSS 配置
    const accessKeyId = process.env.OSS_ACCESS_KEY_ID;
    const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET;
    const bucket = process.env.OSS_BUCKET || 'shiya-picture';
    const region = process.env.OSS_REGION || 'oss-cn-guangzhou';

    // 生成 policy
    const policyText = {
      expiration: new Date(Date.now() + 3600000).toISOString(), // 1小时过期
      conditions: [
        ['content-length-range', 0, 104857600] // 最大100MB
      ]
    };

    const policy = Buffer.from(JSON.stringify(policyText)).toString('base64');

    // 生成签名
    const crypto = require('crypto');
    const signature = crypto
      .createHmac('sha1', accessKeySecret)
      .update(policy)
      .digest('base64');

    res.json({
      success: true,
      data: {
        policy,
        signature,
        accessKeyId,
        bucket,
        region
      }
    });
  } catch (error) {
    console.error('OSS signature error:', error);
    res.status(401).json({ success: false, error: 'unauthorized' });
  }
});

app.post('/api/analyze-course', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const { imageUrl, fileContent, type } = req.body;

  if (!token) {
    return res.status(401).json({ success: false, error: 'unauthorized' });
  }

  try {
    // 验证token
    const decoded = jwt.verify(token, SECRET_KEY);
    
    // Doubao Vision API配置
    const apiKey = process.env.DOUBAO_VISION_API_KEY;
    const model = 'doubao-1-5-vision-pro-32k-250115';
    
    if (!apiKey) {
      return res.status(500).json({ success: false, error: 'API key not configured' });
    }

    if (type === 'image' && imageUrl) {
      const systemPrompt = `你是一个课程表分析助手。请分析这张课表图片，提取以下信息：
1. 课程名称
2. 教师姓名
3. 上课地点
4. 上课时间（星期几、开始节次、结束节次）
5. 上课周数（开始周、结束周）
6. 学分和课程类型

请按照以下JSON格式返回：
{
  "courses": [
    {
      "courseName": "课程名称",
      "teacher": "教师姓名",
      "location": "上课地点",
      "dayOfWeek": 1, // 1-7（1=周一）
      "startSection": 1, // 开始节次
      "endSection": 2, // 结束节次
      "startWeek": 1, // 开始周
      "endWeek": 16 // 结束周
    }
  ]
}`;

      const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: [
                {
                  type: 'image_url',
                  image_url: {
                    url: imageUrl
                  }
                },
                {
                  type: 'text',
                  text: '请分析这张课表图片，提取课程信息'
                }
              ]
            }
          ],
          temperature: 0.7
        })
      });

      const responseData = await response.json();
      
      if (!response.ok) {
        console.error('Doubao API error:', responseData);
        return res.status(500).json({ success: false, error: 'AI analysis failed' });
      }

      // 解析AI返回的结果
      let analysisResult = null;
      try {
        const content = responseData.choices[0].message.content;
        // 提取JSON部分
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          analysisResult = JSON.parse(jsonMatch[0]);
        }
      } catch (error) {
        console.error('Parse AI result error:', error);
        return res.status(500).json({ success: false, error: 'Failed to parse AI result' });
      }

      res.json({
        success: true,
        data: analysisResult
      });
    } else if (type === 'file' && fileContent) {
      // 处理文件内容分析
      const systemPrompt = `你是一个课程表分析助手。请分析以下课程表文件内容，提取以下信息：
1. 课程名称
2. 教师姓名
3. 上课地点
4. 上课时间（星期几、开始节次、结束节次）
5. 上课周数（可以是范围如1-16，或具体周数如1,3,5）
6. 学分和课程类型

请按照以下JSON格式返回：
{
  "courses": [
    {
      "courseName": "课程名称",
      "teacher": "教师姓名",
      "location": "上课地点",
      "dayOfWeek": 1, // 1-7（1=周一）
      "startSection": 1, // 开始节次
      "endSection": 2, // 结束节次
      "weeks": "1-16" // 周数表示
    }
  ]
}`;

      const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: `请分析以下课程表文件内容，提取课程信息：\n${fileContent}`
            }
          ],
          temperature: 0.7
        })
      });

      const responseData = await response.json();
      
      if (!response.ok) {
        console.error('Doubao API error:', responseData);
        return res.status(500).json({ success: false, error: 'AI analysis failed' });
      }

      // 解析AI返回的结果
      let analysisResult = null;
      try {
        const content = responseData.choices[0].message.content;
        // 提取JSON部分
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          analysisResult = JSON.parse(jsonMatch[0]);
        }
      } catch (error) {
        console.error('Parse AI result error:', error);
        return res.status(500).json({ success: false, error: 'Failed to parse AI result' });
      }

      res.json({
        success: true,
        data: analysisResult
      });
    } else {
      res.status(400).json({ success: false, error: 'Invalid request' });
    }
  } catch (error) {
    console.error('Analyze course error:', error);
    res.status(500).json({ success: false, error: 'server_error' });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ==================== 挂载路由模块 ====================
app.use('/api', tasksRouter);
app.use('/api', conversationsRouter);

// ==================== DDL 联动：日程 ↔ agent_tasks 双向同步 API ====================

/**
 * POST /api/tasks/sync-from-schedule
 * 前端手动创建/编辑日程时，同步到 agent_tasks 表
 * Body: { todo, sessionId }
 * Returns: { success, taskId }
 */
app.post('/api/tasks/sync-from-schedule', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]
    let userId = 3
    if (token) {
      try {
        const decoded = jwt.verify(token, SECRET_KEY)
        userId = decoded.id
      } catch (e) {}
    }

    const { todo, sessionId } = req.body
    if (!todo || !todo.title && !todo.text) {
      return res.status(400).json({ success: false, error: 'missing_todo' })
    }

    const taskId = await syncTodoToAgentTask(pool, userId, todo, sessionId)
    res.json({ success: true, taskId })
  } catch (e) {
    console.error('[DDL同步-日程→任务] 失败:', e.message)
    res.status(500).json({ success: false, error: e.message })
  }
})

/**
 * POST /api/tasks/sync-to-schedule
 * Bingo/任务完成时，回写 user_data 中的对应日程 completed 状态
 * Body: { taskId, completed }
 * Returns: { success, updated }
 */
app.post('/api/tasks/sync-to-schedule', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]
    let userId = 3
    if (token) {
      try {
        const decoded = jwt.verify(token, SECRET_KEY)
        userId = decoded.id
      } catch (e) {}
    }

    const { taskId, completed } = req.body
    if (!taskId) {
      return res.status(400).json({ success: false, error: 'missing_taskId' })
    }

    const updated = await syncAgentTaskToSchedule(pool, userId, taskId, completed !== false)
    res.json({ success: true, updated })
  } catch (e) {
    console.error('[DDL同步-任务→日程] 失败:', e.message)
    res.status(500).json({ success: false, error: e.message })
  }
})

// ==================== DeepSeek 统一对话接口（流式 SSE + 意图路由） ====================
app.post('/api/chat/deepseek', async (req, res) => {
  const { content, sessionId: reqSessionId, deepseekApiKey: userApiKey } = req.body;
  const token = req.headers.authorization?.split(' ')[1];
  const apiKey = userApiKey || process.env.DEEPSEEK_API_KEY;

  if (!content) {
    return res.status(400).json({ success: false, error: 'missing_content' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  try {
    // 鉴权
    let userId = 3;
    if (token) {
      try {
        const decoded = jwt.verify(token, SECRET_KEY);
        userId = decoded.id;
      } catch (e) { /* 使用默认用户 */ }
    }

    const sessionId = reqSessionId || `sess_${userId}_${Date.now()}`;

    // ========== 阶段1: 意图识别（thinking 展示） ==========
    await sendSSEvent(res, 'thinking', {
      step: 1,
      text: '🔍 正在理解你的意图...',
      icon: '🧠',
    }, 400);

    const intent = await detectIntent(content, apiKey);
    console.log(`[DeepSeek Chat] userId=${userId} intent=${intent}`);

    // ========== 检查是否有待确认的敏感操作 ==========
    const pendingKey = `${userId}_${sessionId}`;
    const pending = pendingActions.get(pendingKey);
    console.log(`[确认流程] pendingKey=${pendingKey}, hasPending=${!!pending}, content="${content.slice(0, 20)}", isConfirm=${isConfirmationMessage(content)}`);
    if (pending && isConfirmationMessage(content)) {
      console.log(`[确认操作] 用户确认执行: ${pending.action} ${pending.title} targetId=${pending.targetId}`);
      pendingActions.delete(pendingKey);

      if (pending.action === 'delete') {
        // 二次验证：目标日程是否仍存在
        const currentTodos = await loadTodosFromDB(pool, userId);
        const exists = currentTodos.some(t => String(t.id) === String(pending.targetId));
        if (!exists) {
          sendSSEventRaw(res, 'error', { message: '该日程已经不存在了，可能已被删除。' });
          sendSSEventRaw(res, 'done', { sessionId });
          res.end();
          return;
        }
        const result = await deleteTodoFromDB(pool, userId, pending.targetId);
        console.log(`[确认操作] deleteTodoFromDB 结果:`, JSON.stringify(result));
        if (result.success) {
          // DDL 联动：删除日程 → 标记对应 agent_task 为已完成
          if (result.todo?.taskId) {
            syncAgentTaskToSchedule(pool, userId, result.todo.taskId, true).catch(e =>
              console.error('[DDL联动-删除] 同步失败:', e.message))
          }
          await sendSSEvent(res, 'thinking', { step: 2, text: '🗑️ 正在删除日程...', icon: '🗑️' }, 300);
          await sendSSEvent(res, 'thinking', { step: 3, text: `✅ 已删除：${pending.title}`, icon: '✅' }, 300);
          sendSSEventRaw(res, 'schedule_deleted', { id: pending.targetId, title: pending.title });
          const confirmPrompt = getSystemPrompt('chat');
          const confirmMsg = `用户确认删除了日程：「${pending.title}」。请用乌鸦人设友好告知用户已删除，问问还有没有其他需要。`;
          const confirmMessages = await buildMessagesForDeepSeek(pool, userId, sessionId, confirmPrompt, confirmMsg);
          await streamDeepSeekToSSE(res, confirmMessages, apiKey);
        } else {
          sendSSEventRaw(res, 'error', { message: `删除失败：${result.error}` });
        }
      } else if (pending.action === 'update') {
        const result = await updateTodoInDB(pool, userId, pending.targetId, pending.changes);
        if (result.success) {
          // DDL 联动：更新日程 → 同步到 agent_tasks
          if (result.todo?.taskId) {
            syncTodoToAgentTask(pool, userId, result.todo, sessionId).catch(e =>
              console.error('[DDL联动-更新] 同步失败:', e.message))
          }
          await sendSSEvent(res, 'thinking', { step: 2, text: '✏️ 正在更新日程...', icon: '✏️' }, 300);
          await sendSSEvent(res, 'thinking', { step: 3, text: `✅ 已更新：${pending.title}`, icon: '✅' }, 300);
          sendSSEventRaw(res, 'schedule_updated', { id: pending.targetId, changes: pending.changes, todo: result.todo });
          const confirmPrompt = getSystemPrompt('chat');
          const changesDesc = Object.entries(pending.changes).map(([k, v]) => `${k}=${v}`).join(', ');
          const confirmMsg = `用户确认修改了日程：「${pending.title}」（${changesDesc}）。请用乌鸦人设友好告知用户已更新。`;
          const confirmMessages = await buildMessagesForDeepSeek(pool, userId, sessionId, confirmPrompt, confirmMsg);
          await streamDeepSeekToSSE(res, confirmMessages, apiKey);
        } else {
          sendSSEventRaw(res, 'error', { message: `更新失败：${result.error}` });
        }
      } else if (pending.action === 'batchDelete') {
        // 批量删除确认执行
        const targetIds = pending.targetIds || [];
        const currentTodos = await loadTodosFromDB(pool, userId);
        const idSet = new Set(targetIds.map(String));
        const deletedTodos = currentTodos.filter(t => idSet.has(String(t.id)));
        const remaining = currentTodos.filter(t => !idSet.has(String(t.id)));

        if (deletedTodos.length === 0) {
          sendSSEventRaw(res, 'error', { message: '目标日程不存在，可能已被删除。' });
        } else {
          const ok = await saveTodosToDB(pool, userId, remaining);
          if (!ok) {
            sendSSEventRaw(res, 'error', { message: '批量删除失败：数据库写入失败' });
          } else {
            // DDL 联动
            for (const todo of deletedTodos) {
              if (todo.taskId) {
                syncAgentTaskToSchedule(pool, userId, todo.taskId, true).catch(e =>
                  console.error('[DDL联动-批量删除] 同步失败:', e.message));
              }
            }
            await sendSSEvent(res, 'thinking', { step: 2, text: '🗑️ 正在批量删除日程...', icon: '🗑️' }, 300);
            await sendSSEvent(res, 'thinking', { step: 3, text: `✅ 已批量删除 ${deletedTodos.length} 项日程`, icon: '✅' }, 300);
            sendSSEventRaw(res, 'schedule_batch_deleted', {
              targetIds: deletedTodos.map(t => String(t.id)),
              count: deletedTodos.length,
            });
            const titles = deletedTodos.map(t => t.text || t.title || '').join(', ');
            const confirmPrompt = getSystemPrompt('chat');
            const confirmMsg = `用户确认批量删除了 ${deletedTodos.length} 项日程：${titles}。请用乌鸦人设友好告知结果。`;
            const confirmMessages = await buildMessagesForDeepSeek(pool, userId, sessionId, confirmPrompt, confirmMsg);
            await streamDeepSeekToSSE(res, confirmMessages, apiKey);
          }
        }
      }
      sendSSEventRaw(res, 'done', { sessionId });
      res.end();
      return;
    }

    // 如果用户取消待确认操作
    if (pending && (content.includes('取消') || content.includes('算了') || content.includes('不要') || content.includes('别'))) {
      console.log(`[确认操作] 用户取消: ${pending.action} ${pending.title}`);
      pendingActions.delete(pendingKey);
      const confirmPrompt = getSystemPrompt('chat');
      const confirmMsg = `用户取消了删除/修改日程的操作。请用乌鸦人设友好回应。`;
      const confirmMessages = await buildMessagesForDeepSeek(pool, userId, sessionId, confirmPrompt, confirmMsg);
      await streamDeepSeekToSSE(res, confirmMessages, apiKey);
      sendSSEventRaw(res, 'done', { sessionId });
      res.end();
      return;
    }

    // ========== 阶段2: 根据意图路由 ==========
    if (intent === 'SCHEDULE') {
      // ======= 日程模式 =======
      await sendSSEvent(res, 'thinking', {
        step: 2,
        text: '📅 识别到日程意图，正在解析时间...',
        icon: '📅',
      }, 400);

      const systemPrompt = getSystemPrompt('schedule', { user_input: content });
      const scheduleResult = await callDeepSeek(systemPrompt, content);
      console.log(`[日程解析] 原始回复: ${scheduleResult?.slice(0, 200)}`);

      // 解析 JSON
      let scheduleData = null;
      try {
        const cleaned = scheduleResult
          .replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(cleaned);
        if (parsed.data) scheduleData = parsed.data;
      } catch (e) {
        console.error('[日程解析] JSON 解析失败:', e.message);
      }

      if (scheduleData) {
        // 写入数据库（自动同步到 agent_tasks）
        const saved = await saveScheduleToDB(pool, userId, scheduleData, sessionId);

        await sendSSEvent(res, 'thinking', {
          step: 3,
          text: '✅ 日程已保存到数据库',
          icon: '✅',
        }, 300);

        // 发送结构化日程数据给前端
        sendSSEventRaw(res, 'schedule', {
          action: 'create',
          data: scheduleData,
        });

        // 生成自然语言确认（追问式，不是单方面通知）
        const confirmPrompt = getSystemPrompt('chat');
        const scheduleDesc = `标题="${scheduleData.title}"`;
        const dateDesc = scheduleData.startDate && scheduleData.startDate !== scheduleData.date
          ? `${scheduleData.startDate}~${scheduleData.endDate || scheduleData.startDate}`
          : scheduleData.date;
        const confirmMsg = `用户输入: ${content}\n\n(系统提示：你识别到用户想安排以下日程：${scheduleDesc}，日期=${dateDesc}${scheduleData.time ? '，时间=' + scheduleData.time : ''}${scheduleData.estimatedMinutes ? '，预计耗时=' + scheduleData.estimatedMinutes + '分钟' : ''}${scheduleData.repeatInterval && scheduleData.repeatInterval !== 'none' ? '，重复=' + scheduleData.repeatInterval : ''}，

        请用乌鸦人设自然地告知用户："帮你建了一个日程嘎～不过想确认一下，这个时间合适吗？需要调整或拆解成小步骤吗？"

        要点：
        - 先告知日程已保存
        - 然后主动询问是否要拆解或调整
        - 如果这是个大任务（明显需要多步骤），建议拆解
        - 保持友好的乌鸦人设)`;
        const confirmMessages = await buildMessagesForDeepSeek(pool, userId, sessionId, confirmPrompt, confirmMsg);

        // 流式输出确认话语
        await streamDeepSeekToSSE(res, confirmMessages, apiKey);
      } else {
        // 解析失败，fallback 到闲聊
        await sendSSEvent(res, 'thinking', {
          step: 3,
          text: '⚠️ 日程解析未成功，切换到对话模式...',
          icon: '💬',
        }, 300);
        await chatModeStream(res, pool, userId, sessionId, content, apiKey);
      }

    } else if (intent === 'DIARY') {
      // ======= 日记模式 =======
      await sendSSEvent(res, 'thinking', {
        step: 2,
        text: '📝 识别到日记意图，正在整理...',
        icon: '📝',
      }, 400);

      const systemPrompt = getSystemPrompt('diary', { user_input: content });
      const diaryResult = await callDeepSeek(systemPrompt, content);

      let diaryData = null;
      try {
        const cleaned = diaryResult
          .replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(cleaned);
        if (parsed.data) diaryData = parsed.data;
      } catch (e) {
        console.error('[日记解析] JSON 解析失败:', e.message);
      }

      if (diaryData) {
        await saveDiaryToDB(pool, userId, diaryData);
        await sendSSEvent(res, 'thinking', {
          step: 3,
          text: '✅ 日记已保存',
          icon: '✅',
        }, 300);

        sendSSEventRaw(res, 'diary', {
          action: 'create',
          data: diaryData,
        });

        const confirmPrompt = getSystemPrompt('chat');
        const confirmMsg = `日记内容: ${diaryData.content} 日期: ${diaryData.date} 心情: ${diaryData.mood}\n请用乌鸦人设友好确认已记录。`;
        const confirmMessages = await buildMessagesForDeepSeek(pool, userId, sessionId, confirmPrompt, confirmMsg);
        await streamDeepSeekToSSE(res, confirmMessages, apiKey);
      } else {
        await chatModeStream(res, pool, userId, sessionId, content, apiKey);
      }

    } else if (intent === 'TASK') {
      // ======= 任务拆解模式（先解析JSON，再流式确认） =======
      await sendSSEvent(res, 'thinking', {
        step: 2,
        text: '📋 识别到任务拆解意图，正在分解...',
        icon: '📋',
      }, 400);

      const systemPrompt = getSystemPrompt('task-split', { user_input: content });
      const taskResult = await callDeepSeek(systemPrompt, content);
      console.log(`[任务拆解] 原始回复: ${taskResult?.slice(0, 200)}`);

      // 解析 JSON
      let parsedTask = null;
      try {
        const cleaned = taskResult
          .replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(cleaned);
        if (parsed.type === 'TASK_SPLIT' && parsed.subTasks) {
          parsedTask = parsed;
        }
      } catch (e) {
        console.log('[任务解析] JSON 解析失败:', e.message);
      }

      if (parsedTask) {
        // 发送结构化数据给前端
        sendSSEventRaw(res, 'task_split', {
          mainTask: parsedTask.mainTask,
          subTasks: parsedTask.subTasks,
        });

        // 存入 agent_tasks 表（含 DDL、会话关联）
        for (const sub of parsedTask.subTasks) {
          try {
            const subDdl = sub.deadline || sub.ddlDate || null
            await pool.query(
              `INSERT INTO agent_tasks (user_id, session_id, parent_id, title, description, estimated_minutes, priority, ddl_date, status, sort_order)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
              [
                userId,
                sessionId,
                null,  // parent_id 暂不关联，后续可通过主任务ID关联
                sub.title,
                sub.description || '',
                sub.estimatedMinutes || 30,
                sub.priority || 3,
                subDdl,
                (parsedTask.subTasks.indexOf(sub) + 1),
              ]
            );
          } catch (e) {
            console.error('[任务入库] 失败:', e.message);
          }
        }

        await sendSSEvent(res, 'thinking', {
          step: 3,
          text: `✅ 已拆解为 ${parsedTask.subTasks.length} 个子任务`,
          icon: '✅',
        }, 300);

        // 流式自然语言确认（不再显示原始 JSON）
        const confirmPrompt = getSystemPrompt('chat');
        const taskList = parsedTask.subTasks.map((s, i) =>
          `${i + 1}. ${s.title}（${s.estimatedMinutes}分钟，优先级${s.priority}）`
        ).join('\n');
        const confirmMsg = `用户刚才说: ${content}\n\n你已帮用户拆解为以下子任务:\n${taskList}\n\n请用乌鸦人设友好告知拆解结果，并问问用户要不要调整。`;
        const confirmMessages = await buildMessagesForDeepSeek(pool, userId, sessionId, confirmPrompt, confirmMsg);
        await streamDeepSeekToSSE(res, confirmMessages, apiKey);
      } else {
        // 解析失败，走闲聊
        await chatModeStream(res, pool, userId, sessionId, content, apiKey);
      }

    } else if (intent === 'MANAGE_SCHEDULE') {
      // ======= 日程管理（查/改/删） =======
      await sendSSEvent(res, 'thinking', {
        step: 2,
        text: '📋 正在查看你的日程...',
        icon: '📋',
      }, 300);

      // 加载当前 todos
      const currentTodos = await loadTodosFromDB(pool, userId);
      if (!currentTodos || currentTodos.length === 0) {
        await sendSSEvent(res, 'thinking', {
          step: 3,
          text: '⚠️ 当前没有日程记录',
          icon: '⚠️',
        }, 300);
        const confirmPrompt = getSystemPrompt('chat');
        const confirmMsg = `用户想管理日程但当前列表为空。请用乌鸦人设友好告知：目前还没有日程耶～需要新建一个吗？`;
        const confirmMessages = await buildMessagesForDeepSeek(pool, userId, sessionId, confirmPrompt, confirmMsg);
        await streamDeepSeekToSSE(res, confirmMessages, apiKey);
        sendSSEventRaw(res, 'done', { sessionId });
        res.end();
        return;
      }

      // 精简 todos 给 AI（只传关键字段，节省 token）
      // 额外添加 dateLabel 帮助AI匹配用户口语化日期（如"6.12"→"06-12"）
      const slimTodos = currentTodos.map(t => {
        const extractDateLabel = (d) => {
          if (!d) return ''
          const m = d.match(/(\d{2})-(\d{2})/)
          return m ? `${parseInt(m[1])}.${parseInt(m[2])}` : d
        }
        return {
          id: t.id, title: t.text || t.title,
          startDate: t.startDate, endDate: t.endDate,
          dateLabel: extractDateLabel(t.startDate || t.endDate),
          startTime: t.startTime, priority: t.priority, difficulty: t.difficulty,
          estimatedMinutes: t.estimatedMinutes, completed: t.completed,
        }
      });
      const todosJson = JSON.stringify(slimTodos, null, 2);

      const systemPrompt = getSystemPrompt('schedule-crud', {
        todos_json: todosJson,
        user_input: content,
      });
      const crudResult = await callDeepSeek(systemPrompt, content);
      console.log(`[日程管理] 原始回复: ${crudResult?.slice(0, 300)}`);

      // 解析 JSON（增强容错）
      let crudAction = null;
      try {
        // 多次尝试清理
        let cleaned = crudResult || '';
        // 去掉 markdown 代码块
        cleaned = cleaned.replace(/```(?:json)?\s*/g, '').replace(/```\s*/g, '');
        // 截取第一个 { 到最后一个 } 之间的内容
        const firstBrace = cleaned.indexOf('{');
        const lastBrace = cleaned.lastIndexOf('}');
        if (firstBrace >= 0 && lastBrace > firstBrace) {
          cleaned = cleaned.substring(firstBrace, lastBrace + 1);
        }
        // 去掉换行中间的多余文字
        cleaned = cleaned.trim();
        // 尝试修复常见 JSON 问题
        cleaned = cleaned.replace(/,\s*}/g, '}'); // 尾部多余逗号
        cleaned = cleaned.replace(/'/g, '"');       // 单引号转双引号

        crudAction = JSON.parse(cleaned);
      } catch (e1) {
        console.error('[日程管理] JSON解析失败(1):', e1.message, '| raw:', crudResult?.slice(0, 200));
        // 二次尝试：正则提取 action 和 targetId
        try {
          const actionMatch = crudResult?.match(/"action"\s*:\s*"(\w+)"/);
          const targetIdMatch = crudResult?.match(/"targetId"\s*:\s*(-?\d+)/);
          const targetIdsMatch = crudResult?.match(/"targetIds"\s*:\s*\[([^\]]*)\]/);
          if (actionMatch && targetIdMatch) {
            crudAction = {
              action: actionMatch[1],
              targetId: parseInt(targetIdMatch[1]),
            };
            console.log('[日程管理] 正则兜底解析成功:', JSON.stringify(crudAction));
          } else if (actionMatch && targetIdsMatch) {
            const ids = targetIdsMatch[1].split(',').map(s => {
              const n = parseInt(s.trim());
              return isNaN(n) ? s.trim() : n;
            });
            crudAction = {
              action: actionMatch[1],
              targetIds: ids,
            };
            console.log('[日程管理] 正则兜底解析(batch)成功:', JSON.stringify(crudAction));
          }
        } catch (e2) {
          console.error('[日程管理] JSON解析失败(2):', e2.message);
        }
      }

      if (!crudAction || !crudAction.action) {
        // 解析失败，fallback 到闲聊
        await sendSSEvent(res, 'thinking', { step: 3, text: '⚠️ 未能理解，切换到对话模式...', icon: '💬' }, 300);
        console.error('[日程管理] 最终解析失败，raw:', crudResult?.slice(0, 500));
        await chatModeStream(res, pool, userId, sessionId, content, apiKey);
      } else if (crudAction.action === 'query') {
        // 查询：返回匹配的日程
        const keyword = crudAction.filters?.keyword || '';
        const filterDate = crudAction.filters?.date || '';
        let results = currentTodos;
        if (keyword) {
          const kw = keyword.toLowerCase();
          results = results.filter(t => (t.text || t.title || '').toLowerCase().includes(kw));
        }
        if (filterDate) {
          results = results.filter(t => t.startDate === filterDate || t.endDate === filterDate);
        }
        await sendSSEvent(res, 'thinking', {
          step: 3,
          text: results.length > 0 ? `✅ 找到 ${results.length} 条日程` : '📭 没有匹配的日程',
          icon: results.length > 0 ? '✅' : '📭',
        }, 300);
        sendSSEventRaw(res, 'schedule_list', { action: 'query', keyword, filterDate, todos: results });

        // 自然语言回复
        const confirmPrompt = getSystemPrompt('chat');
        const summary = results.length > 0
          ? results.map((t, i) => `${i + 1}. ${t.text || t.title}（${t.startDate || ''}${t.priority ? ' 优先级' + t.priority : ''}）`).join('\n')
          : '没有找到匹配的日程';
        const confirmMsg = `用户查询日程（关键词：${keyword || '全部'}，日期：${filterDate || '不限'}）。查询结果：\n${summary}\n请用乌鸦人设友好回复查询结果。`;
        const confirmMessages = await buildMessagesForDeepSeek(pool, userId, sessionId, confirmPrompt, confirmMsg);
        await streamDeepSeekToSSE(res, confirmMessages, apiKey);
      } else if (crudAction.action === 'delete' || crudAction.action === 'update') {
        // 增删改：需要二次确认
        const actionLabel = crudAction.action === 'delete' ? '删除' : '修改';
        const targetId = crudAction.targetId;

        // 兜底：如果 AI 没返回 title，从日程列表里按 targetId 查找
        let targetTitle = crudAction.title || '';
        if (!targetTitle && targetId) {
          const found = currentTodos.find(t => String(t.id) === String(targetId));
          targetTitle = found ? (found.text || found.title || '') : '';
        }

        // 验证 targetId 是否真实存在于当前日程列表中
        const targetExists = targetId ? currentTodos.some(t => String(t.id) === String(targetId)) : false;

        if (!targetId || !targetExists) {
          // AI 幻觉了不存在的 ID，回退到查询模式
          console.log(`[日程管理] targetId=${targetId} 不存在于数据库中，回退到查询`);
          const keyword = crudAction.title || content || '';
          await sendSSEvent(res, 'thinking', {
            step: 3,
            text: `⚠️ 未找到精确匹配的日程，帮你搜索相关日程...`,
            icon: '🔍',
          }, 300);

          // 按关键词模糊匹配
          let results = currentTodos;
          if (keyword) {
            const kw = keyword.toLowerCase();
            results = results.filter(t => (t.text || t.title || '').toLowerCase().includes(kw));
          }
          if (results.length > 0) {
            sendSSEventRaw(res, 'schedule_list', { action: 'query', keyword, todos: results });
          }
          const confirmPrompt = getSystemPrompt('chat');
          const summary = results.length > 0
            ? results.map((t, i) => `${i + 1}. ${t.text || t.title}（${t.startDate || ''}, id=${t.id}）`).join('\n')
            : '没有找到匹配的日程';
          const confirmMsg = results.length > 0
            ? `AI 想${actionLabel}日程但 ID 匹配失败。请让用户在以下候选中指定要${actionLabel}哪一个（说出序号或名称）：\n${summary}\n请用乌鸦人设列出候选日程，让用户选一个。`
            : `AI 想${actionLabel}日程但未找到匹配。请用乌鸦人设告知用户没找到。`;
          const confirmMessages = await buildMessagesForDeepSeek(pool, userId, sessionId, confirmPrompt, confirmMsg);
          await streamDeepSeekToSSE(res, confirmMessages, apiKey);
        } else {
          // 存储待确认操作
          pendingActions.set(pendingKey, {
            action: crudAction.action,
            targetId,
            title: targetTitle,
            changes: crudAction.changes || {},
            timestamp: Date.now(),
          });

          await sendSSEvent(res, 'thinking', {
            step: 3,
            text: `⚠️ 确认${actionLabel}：${targetTitle}`,
            icon: '⚠️',
          }, 300);

          // 发送 action_confirm 事件（前端显示确认卡片）
          sendSSEventRaw(res, 'action_confirm', {
            action: crudAction.action,
            title: targetTitle,
            detail: crudAction.action === 'delete'
              ? `确定要删除日程「${targetTitle}」吗？删除后不可恢复。`
              : `确定要修改日程「${targetTitle}」吗？${JSON.stringify(crudAction.changes || {})}`,
            targetId,
          });

          // 自然语言确认询问
          const confirmPrompt = getSystemPrompt('chat');
          const confirmMsg = `用户想${actionLabel}日程：「${targetTitle}」。${crudAction.action === 'delete' ? '需要确认是否删除' : `修改内容：${JSON.stringify(crudAction.changes || {})}`}。请用乌鸦人设友好询问用户是否确认${actionLabel}（回复"确认"或"是"执行，"取消"或"算了"放弃）。`;
          const confirmMessages = await buildMessagesForDeepSeek(pool, userId, sessionId, confirmPrompt, confirmMsg);
          await streamDeepSeekToSSE(res, confirmMessages, apiKey);
        }
      } else if (crudAction.action === 'batchDelete') {
        // 批量删除：需要二次确认
        const targetIds = (crudAction.targetIds || []).map(String);
        const matchedTodos = currentTodos.filter(t => targetIds.includes(String(t.id)));

        if (matchedTodos.length === 0) {
          // 没有匹配的日程，回退到查询模式
          console.log(`[日程管理] batchDelete: 所有 targetId 不存在于数据库中，回退到查询`);
          await sendSSEvent(res, 'thinking', {
            step: 3,
            text: `⚠️ 未找到匹配的日程`,
            icon: '🔍',
          }, 300);
          const confirmPrompt = getSystemPrompt('chat');
          const confirmMsg = `用户想批量删除日程但未找到匹配项。请用乌鸦人设告知用户没找到。`;
          const confirmMessages = await buildMessagesForDeepSeek(pool, userId, sessionId, confirmPrompt, confirmMsg);
          await streamDeepSeekToSSE(res, confirmMessages, apiKey);
        } else {
          // 存储待确认操作
          pendingActions.set(pendingKey, {
            action: 'batchDelete',
            targetIds: matchedTodos.map(t => String(t.id)),
            titles: matchedTodos.map(t => t.text || t.title || ''),
            timestamp: Date.now(),
          });

          const count = matchedTodos.length;
          const titleList = matchedTodos.map(t => t.text || t.title || '').join('、');

          await sendSSEvent(res, 'thinking', {
            step: 3,
            text: `⚠️ 确认批量删除 ${count} 条日程`,
            icon: '⚠️',
          }, 300);

          // 发送 action_confirm 事件（前端显示确认卡片）
          sendSSEventRaw(res, 'action_confirm', {
            action: 'batchDelete',
            title: `批量删除 ${count} 条日程`,
            titles: matchedTodos.map(t => t.text || t.title || ''),
            detail: `确定要删除以下 ${count} 条日程吗？\n${titleList}\n删除后不可恢复。`,
            targetIds: matchedTodos.map(t => String(t.id)),
            count,
          });

          // 自然语言确认询问
          const confirmPrompt = getSystemPrompt('chat');
          const confirmMsg = `用户想批量删除 ${count} 条日程：${titleList}。需要确认是否执行。请用乌鸦人设友好询问用户是否确认批量删除（回复"确认"或"是"执行，"取消"或"算了"放弃）。`;
          const confirmMessages = await buildMessagesForDeepSeek(pool, userId, sessionId, confirmPrompt, confirmMsg);
          await streamDeepSeekToSSE(res, confirmMessages, apiKey);
        }
      } else {
        // 未知 action
        await chatModeStream(res, pool, userId, sessionId, content, apiKey);
      }

    } else {
      // ======= 闲聊模式 =======
      await sendSSEvent(res, 'thinking', {
        step: 2,
        text: '💬 闲聊模式，正在生成回复...',
        icon: '💬',
      }, 300);
      await chatModeStream(res, pool, userId, sessionId, content, apiKey);
    }

    sendSSEventRaw(res, 'done', { sessionId });
  } catch (error) {
    console.error('[DeepSeek Chat] 错误:', error.message);
    sendSSEventRaw(res, 'error', { message: error.message });
  } finally {
    res.end();
  }
});

// ==================== 流式输出 DeepSeek 到 SSE ====================
async function streamDeepSeekToSSE(res, messages, apiKey) {
  const apiUrl = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions';

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages,
      temperature: 0.7,
      max_tokens: 4096,
      stream: true,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`DeepSeek API error ${response.status}: ${errBody}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullContent = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;
      const jsonStr = trimmed.slice(6);
      if (jsonStr === '[DONE]') continue;

      try {
        const parsed = JSON.parse(jsonStr);
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) {
          fullContent += delta;
          sendMessageChunk(res, delta);
        }
      } catch (e) { /* skip malformed */ }
    }
  }

  return fullContent;
}

// ==================== 闲聊模式流式回复 ====================
async function chatModeStream(res, pool, userId, sessionId, content, apiKey) {
  const systemPrompt = getSystemPrompt('chat');
  const messages = await buildMessagesForDeepSeek(pool, userId, sessionId, systemPrompt, content);

  const totalEstTokens = messages.reduce((sum, m) =>
    sum + estimateTokens(m.content || ''), 0
  );
  console.log(`[闲聊] messages=${messages.length} estTokens=${totalEstTokens}`);

  const fullContent = await streamDeepSeekToSSE(res, messages, apiKey);

  // 保存回复
  if (fullContent) {
    await saveAssistantMessage(pool, userId, sessionId, fullContent);
  }

  // 更新会话元数据
  try {
    const title = content.length > 20 ? content.slice(0, 20) + '...' : content;
    await pool.query(
      `INSERT INTO conversation_sessions (user_id, session_id, title, message_count, token_count, status)
       VALUES (?, ?, ?, 2, ?, 'active')
       ON DUPLICATE KEY UPDATE
         title = IF(title = '' OR title IS NULL, VALUES(title), title),
         message_count = message_count + 2,
         token_count = token_count + VALUES(token_count),
         updated_at = NOW()`,
      [userId, sessionId, title, totalEstTokens + estimateTokens(fullContent)]
    );
  } catch (e) { /* 表可能不存在 */ }

  // 尝试解析任务拆解 JSON
  try {
    const cleaned = fullContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);
    if (parsed.type === 'TASK_SPLIT' && parsed.data) {
      sendSSEventRaw(res, 'task_split', parsed.data);
    }
  } catch (e) { /* 非 JSON */ }
}

app.listen(PORT, () => {
  console.log('\n========================================');
  console.log('      拾鸦后端服务启动成功！');
  console.log('========================================');
  console.log(`本地访问地址: http://localhost:${PORT}`);
  console.log(`主脑API: ${process.env.MASTER_BRAIN_API_KEY ? '已配置' : '未配置'}`);
  console.log(`豆包API: ${process.env.DOUBAO_API_KEY ? '已配置' : '未配置'}`);
  console.log(`DeepSeek API: ${process.env.DEEPSEEK_API_KEY ? '已配置' : '未配置'}`);
  console.log(`数据库: MySQL connected`);
  console.log('========================================\n');
});

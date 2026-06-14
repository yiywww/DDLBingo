/**
 * 会话管理 API 路由
 * 参考 Data-Agent-main：创建由 chat stream 隐式完成，这里提供列表/重命名/删除/消息查询
 */

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

async function getUserId(req) {
  const SECRET_KEY = process.env.SECRET_KEY || 'shiya-secret';
  const token = req.headers.authorization?.split(' ')[1] || req.body.token;
  if (token) {
    try {
      const decoded = jwt.verify(token, SECRET_KEY);
      return decoded.id;
    } catch (e) { /* invalid */ }
  }
  return req.body.userId || 3;
}

function getPool(req) {
  return req.app.locals.pool;
}

/**
 * GET /api/conversations
 * 分页获取会话列表，按更新时间降序
 */
router.get('/conversations', async (req, res) => {
  try {
    const userId = await getUserId(req);
    const pool = getPool(req);
    const { current = 1, size = 20 } = req.query;
    const offset = (parseInt(current) - 1) * parseInt(size);

    const [rows] = await pool.query(
      `SELECT s.session_id AS id, s.title, s.message_count AS messageCount,
              s.token_count AS tokenCount, s.status, s.created_at AS createdAt, s.updated_at AS updatedAt
       FROM conversation_sessions s
       WHERE s.user_id = ?
       ORDER BY s.updated_at DESC
       LIMIT ? OFFSET ?`,
      [userId, parseInt(size), offset]
    );

    const [[{ total }]] = await pool.query(
      'SELECT COUNT(*) AS total FROM conversation_sessions WHERE user_id = ?',
      [userId]
    );

    res.json({
      success: true,
      data: {
        records: rows,
        total,
        current: parseInt(current),
        size: parseInt(size),
        pages: Math.ceil(total / parseInt(size)),
      },
    });
  } catch (error) {
    console.error('[Conversations] list error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/conversations/:id
 * 更新会话标题
 */
router.post('/conversations/:id', async (req, res) => {
  try {
    const userId = await getUserId(req);
    const pool = getPool(req);
    const { id } = req.params;
    const { title } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, error: 'missing_title' });
    }

    await pool.query(
      `UPDATE conversation_sessions SET title = ?, updated_at = NOW()
       WHERE session_id = ? AND user_id = ?`,
      [title, id, userId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('[Conversations] update error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/conversations/:id
 * 删除会话及其所有消息
 */
router.delete('/conversations/:id', async (req, res) => {
  try {
    const userId = await getUserId(req);
    const pool = getPool(req);
    const { id } = req.params;

    // 先删消息
    await pool.query(
      'DELETE FROM conversation_messages WHERE session_id = ? AND user_id = ?',
      [id, userId]
    );
    // 再删会话
    await pool.query(
      'DELETE FROM conversation_sessions WHERE session_id = ? AND user_id = ?',
      [id, userId]
    );

    // 清理本地存储的 sessionId 提示
    res.json({ success: true });
  } catch (error) {
    console.error('[Conversations] delete error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/conversations/:id/messages
 * 获取指定会话的所有消息
 */
router.get('/conversations/:id/messages', async (req, res) => {
  try {
    const userId = await getUserId(req);
    const pool = getPool(req);
    const { id } = req.params;

    const [rows] = await pool.query(
      `SELECT role, content, status, created_at AS createdAt
       FROM conversation_messages
       WHERE session_id = ? AND user_id = ?
       ORDER BY created_at ASC`,
      [id, userId]
    );

    // 映射 role 为前端期望格式
    const messages = rows.map(r => ({
      role: r.role === 'assistant' ? 'assistant' : 'user',
      content: r.content,
      createdAt: r.createdAt,
    }));

    res.json({ success: true, data: messages });
  } catch (error) {
    console.error('[Conversations] messages error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

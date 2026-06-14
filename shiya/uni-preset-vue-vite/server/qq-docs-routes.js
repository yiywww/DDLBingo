
/**
 * 腾讯文档API路由模块
 * 在 server.js 中引入此文件：
 * const qqDocsRoutes = require('./qq-docs-routes');
 * app.use('/api/qq-docs', qqDocsRoutes);
 */

const express = require('express');
const router = express.Router();
const qqDocsApi = require('./qq-docs-api');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');

// 创建数据库连接池（与主server.js保持一致）
let pool;
const SECRET_KEY = process.env.SECRET_KEY;

// 初始化数据库连接池
function initPool(dbPool) {
  pool = dbPool;
}

// 验证Token的中间件
const authenticate = async (req, res, next) =&gt; {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, error: 'unauthorized' });
    }
    
    const decoded = jwt.verify(token, SECRET_KEY);
    req.userId = decoded.id;
    next();
  } catch (error) {
    res.status(401).json({ success: false, error: 'invalid_token' });
  }
};

// 获取用户腾讯文档授权信息
const getUserAuth = async (userId) =&gt; {
  if (!pool) return null;
  
  const [rows] = await pool.query(
    'SELECT * FROM qq_docs_auth WHERE user_id = ?',
    [userId]
  );
  
  return rows.length &gt; 0 ? rows[0] : null;
};

// ==================== 路由定义 ====================

/**
 * 获取授权URL
 * GET /api/qq-docs/auth-url
 */
router.get('/auth-url', authenticate, (req, res) =&gt; {
  try {
    const authUrl = qqDocsApi.getAuthUrl(req.userId);
    
    res.json({
      success: true,
      authUrl: authUrl
    });
  } catch (error) {
    console.error('获取授权URL失败:', error);
    res.status(500).json({ success: false, error: 'server_error' });
  }
});

/**
 * OAuth回调处理
 * GET /api/qq-docs/callback
 */
router.get('/callback', async (req, res) =&gt; {
  try {
    const { code, state } = req.query;
    const userId = state;
    
    const tokenData = await qqDocsApi.getAccessToken(code, userId);
    
    // 保存token到数据库
    if (pool) {
      await pool.query(
        `INSERT INTO qq_docs_auth (user_id, access_token, refresh_token, expires_at)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
         access_token = VALUES(access_token),
         refresh_token = VALUES(refresh_token),
         expires_at = VALUES(expires_at)`,
        [userId, tokenData.access_token, tokenData.refresh_token, Date.now() + tokenData.expires_in * 1000]
      );
    }
    
    // 重定向回前端
    res.redirect('/?qq-docs-auth=success');
  } catch (error) {
    console.error('OAuth回调处理失败:', error);
    res.redirect('/?qq-docs-auth=error');
  }
});

/**
 * 检查授权状态
 * GET /api/qq-docs/auth-status
 */
router.get('/auth-status', authenticate, async (req, res) =&gt; {
  try {
    const userAuth = await getUserAuth(req.userId);
    const isAuthorized = userAuth &amp;&amp; Date.now() &lt; userAuth.expires_at;
    
    res.json({
      success: true,
      isAuthorized: isAuthorized
    });
  } catch (error) {
    console.error('检查授权状态失败:', error);
    res.status(500).json({ success: false, error: 'server_error' });
  }
});

/**
 * 创建课堂笔记
 * POST /api/qq-docs/create-class-note
 */
router.post('/create-class-note', authenticate, async (req, res) =&gt; {
  try {
    const { title, courseName, date } = req.body;
    const userAuth = await getUserAuth(req.userId);
    
    if (!userAuth) {
      return res.status(400).json({ success: false, error: 'not_authorized' });
    }
    
    const doc = await qqDocsApi.createClassNote(req.userId, userAuth, courseName, date);
    
    // 保存文档关联
    if (pool) {
      await pool.query(
        `INSERT INTO user_documents (user_id, file_id, title, type, url, doc_type)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [req.userId, doc.fileId, doc.title, doc.type, doc.url, 'class_note']
      );
    }
    
    res.json({
      success: true,
      document: doc
    });
  } catch (error) {
    console.error('创建课堂笔记失败:', error);
    res.status(500).json({ success: false, error: 'server_error' });
  }
});

/**
 * 创建错题本
 * POST /api/qq-docs/create-error-book
 */
router.post('/create-error-book', authenticate, async (req, res) =&gt; {
  try {
    const { title, subject } = req.body;
    const userAuth = await getUserAuth(req.userId);
    
    if (!userAuth) {
      return res.status(400).json({ success: false, error: 'not_authorized' });
    }
    
    const doc = await qqDocsApi.createErrorBook(req.userId, userAuth, subject || '数学');
    
    // 保存文档关联
    if (pool) {
      await pool.query(
        `INSERT INTO user_documents (user_id, file_id, title, type, url, doc_type, subject)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [req.userId, doc.fileId, doc.title, doc.type, doc.url, 'error_book', subject]
      );
    }
    
    res.json({
      success: true,
      document: doc
    });
  } catch (error) {
    console.error('创建错题本失败:', error);
    res.status(500).json({ success: false, error: 'server_error' });
  }
});

/**
 * 创建学习计划
 * POST /api/qq-docs/create-study-plan
 */
router.post('/create-study-plan', authenticate, async (req, res) =&gt; {
  try {
    const { title } = req.body;
    const userAuth = await getUserAuth(req.userId);
    
    if (!userAuth) {
      return res.status(400).json({ success: false, error: 'not_authorized' });
    }
    
    const doc = await qqDocsApi.createStudyPlan(req.userId, userAuth, title);
    
    // 保存文档关联
    if (pool) {
      await pool.query(
        `INSERT INTO user_documents (user_id, file_id, title, type, url, doc_type)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [req.userId, doc.fileId, doc.title, doc.type, doc.url, 'study_plan']
      );
    }
    
    res.json({
      success: true,
      document: doc
    });
  } catch (error) {
    console.error('创建学习计划失败:', error);
    res.status(500).json({ success: false, error: 'server_error' });
  }
});

/**
 * 获取文档列表
 * GET /api/qq-docs/documents
 */
router.get('/documents', authenticate, async (req, res) =&gt; {
  try {
    // 先从本地数据库获取
    if (pool) {
      const [rows] = await pool.query(
        'SELECT * FROM user_documents WHERE user_id = ? ORDER BY updated_at DESC',
        [req.userId]
      );
      
      if (rows.length &gt; 0) {
        return res.json({
          success: true,
          documents: rows
        });
      }
      
      // 如果本地没有，尝试从腾讯文档API获取
      const userAuth = await getUserAuth(req.userId);
      if (userAuth) {
        try {
          const docs = await qqDocsApi.getDocumentList(req.userId, userAuth);
          return res.json({
            success: true,
            documents: docs
          });
        } catch (apiError) {
          console.log('从腾讯文档API获取失败:', apiError.message);
        }
      }
      
      return res.json({
        success: true,
        documents: []
      });
    }
    
    res.json({
      success: true,
      documents: []
    });
  } catch (error) {
    console.error('获取文档列表失败:', error);
    res.status(500).json({ success: false, error: 'server_error' });
  }
});

/**
 * 创建通用文档
 * POST /api/qq-docs/create-document
 */
router.post('/create-document', authenticate, async (req, res) =&gt; {
  try {
    const { title, type = 'smartdoc' } = req.body;
    const userAuth = await getUserAuth(req.userId);
    
    if (!userAuth) {
      return res.status(400).json({ success: false, error: 'not_authorized' });
    }
    
    const doc = await qqDocsApi.createDocument(req.userId, userAuth, title, type);
    
    // 保存文档关联
    if (pool) {
      await pool.query(
        `INSERT INTO user_documents (user_id, file_id, title, type, url, doc_type)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [req.userId, doc.fileId, doc.title, doc.type, doc.url, 'general']
      );
    }
    
    res.json({
      success: true,
      document: doc
    });
  } catch (error) {
    console.error('创建文档失败:', error);
    res.status(500).json({ success: false, error: 'server_error' });
  }
});

module.exports = { router, initPool };


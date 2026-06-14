
# 📄 拾鸦 × 腾讯文档 整合方案

## 概述

本方案将拾鸦项目与腾讯文档深度结合，为学生提供更强大的学习工具，解决课堂笔记、错题整理、小组协作等学习痛点。

---

## 🎯 核心功能

### 1. 📝 课堂笔记协作中心
- 每节课自动创建腾讯智能文档
- 支持多人实时协作编辑
- 拾鸦AI助手自动提取课堂重点
- 笔记自动关联到课程表

### 2. 📚 AI错题智能整理系统
- 拍照上传错题，AI自动识别
- 自动创建腾讯智能表格作为错题本
- 按学科、知识点自动分类
- 基于艾宾浩斯遗忘曲线提醒复习

### 3. 🤝 小组协作任务驱动平台
- 待办事项与腾讯文档深度绑定
- 支持多人实时编辑协作文档
- 文档版本历史记录保留
- 协作状态可视化展示

### 4. 📅 智能学习计划生成器
- 基于课程表自动生成学习计划
- 腾讯收集表实现进度打卡
- 智能表格可视化学习进度
- 乌鸦助手提供进度提醒

### 5. 🏗️ 一站式学习资源中心
- 笔记、资料、作业统一管理
- 腾讯文档作为云端存储
- 智能关联，快速检索
- 支持多人共建知识库

---

## 📁 已创建的文件

### 后端文件
- `server/qq-docs-api.js` - 腾讯文档API集成模块

### 前端文件
- `src/components/QQDocsIntegration.vue` - 腾讯文档集成组件

### 配置文件
- `.env` - 需要添加腾讯文档配置（见下文）

---

## 🔧 配置步骤

### 1. 腾讯文档开放平台注册

1. 访问 [腾讯文档开放平台](https://docs.qq.com/open/)
2. 注册开发者账号并创建应用
3. 获取以下信息：
   - Client ID
   - Client Secret
4. 配置回调地址：`https://your-domain.com/api/qq-docs/callback`

### 2. 更新环境变量

在 `.env` 文件中添加以下配置：

```env
# 腾讯文档配置
QQ_DOCS_CLIENT_ID="your_client_id_here"
QQ_DOCS_CLIENT_SECRET="your_client_secret_here"
QQ_DOCS_REDIRECT_URI="https://your-domain.com/api/qq-docs/callback"
```

### 3. 数据库扩展

需要在数据库中添加腾讯文档相关的表：

```sql
-- 用户腾讯文档授权表
CREATE TABLE IF NOT EXISTS qq_docs_auth (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  expires_at BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 用户文档关联表
CREATE TABLE IF NOT EXISTS user_documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  file_id VARCHAR(255) NOT NULL,
  title VARCHAR(255),
  type VARCHAR(50),
  url VARCHAR(500),
  doc_type VARCHAR(50) COMMENT '文档类型: class_note, error_book, study_plan, etc',
  course_id INT,
  subject VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_doc_type (doc_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## 🚀 后端API集成

### 在 `server.js` 中添加以下路由

```javascript
// 在文件顶部引入腾讯文档模块
const qqDocsApi = require('./qq-docs-api');

// ==================== 腾讯文档相关API ====================

// 获取授权URL
app.get('/api/qq-docs/auth-url', async (req, res) =&gt; {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, error: 'unauthorized' });
    }
    
    const decoded = jwt.verify(token, SECRET_KEY);
    const userId = decoded.id;
    
    const authUrl = qqDocsApi.getAuthUrl(userId);
    
    res.json({
      success: true,
      authUrl: authUrl
    });
  } catch (error) {
    console.error('获取授权URL失败:', error);
    res.status(500).json({ success: false, error: 'server_error' });
  }
});

// OAuth回调处理
app.get('/api/qq-docs/callback', async (req, res) =&gt; {
  try {
    const { code, state } = req.query;
    const userId = state;
    
    const tokenData = await qqDocsApi.getAccessToken(code, userId);
    
    // 保存token到数据库
    const connection = await pool.getConnection();
    try {
      await connection.query(
        `INSERT INTO qq_docs_auth (user_id, access_token, refresh_token, expires_at)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
         access_token = VALUES(access_token),
         refresh_token = VALUES(refresh_token),
         expires_at = VALUES(expires_at)`,
        [userId, tokenData.access_token, tokenData.refresh_token, Date.now() + tokenData.expires_in * 1000]
      );
    } finally {
      connection.release();
    }
    
    // 重定向回前端
    res.redirect('/?qq-docs-auth=success');
  } catch (error) {
    console.error('OAuth回调处理失败:', error);
    res.redirect('/?qq-docs-auth=error');
  }
});

// 检查授权状态
app.get('/api/qq-docs/auth-status', async (req, res) =&gt; {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, error: 'unauthorized' });
    }
    
    const decoded = jwt.verify(token, SECRET_KEY);
    const userId = decoded.id;
    
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.query(
        'SELECT * FROM qq_docs_auth WHERE user_id = ?',
        [userId]
      );
      
      const isAuthorized = rows.length &gt; 0 &amp;&amp; Date.now() &lt; rows[0].expires_at;
      
      res.json({
        success: true,
        isAuthorized: isAuthorized
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('检查授权状态失败:', error);
    res.status(500).json({ success: false, error: 'server_error' });
  }
});

// 创建课堂笔记
app.post('/api/qq-docs/create-class-note', async (req, res) =&gt; {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, error: 'unauthorized' });
    }
    
    const decoded = jwt.verify(token, SECRET_KEY);
    const userId = decoded.id;
    const { title, courseName, date } = req.body;
    
    // 获取用户的token信息
    const connection = await pool.getConnection();
    let userTokens = null;
    try {
      const [rows] = await connection.query(
        'SELECT * FROM qq_docs_auth WHERE user_id = ?',
        [userId]
      );
      if (rows.length &gt; 0) {
        userTokens = rows[0];
      }
    } finally {
      connection.release();
    }
    
    if (!userTokens) {
      return res.status(400).json({ success: false, error: 'not_authorized' });
    }
    
    const doc = await qqDocsApi.createClassNote(userId, userTokens, courseName, date);
    
    // 保存文档关联
    const conn2 = await pool.getConnection();
    try {
      await conn2.query(
        `INSERT INTO user_documents (user_id, file_id, title, type, url, doc_type)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, doc.fileId, doc.title, doc.type, doc.url, 'class_note']
      );
    } finally {
      conn2.release();
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

// 创建错题本
app.post('/api/qq-docs/create-error-book', async (req, res) =&gt; {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, error: 'unauthorized' });
    }
    
    const decoded = jwt.verify(token, SECRET_KEY);
    const userId = decoded.id;
    const { title, subject } = req.body;
    
    // 获取用户的token信息
    const connection = await pool.getConnection();
    let userTokens = null;
    try {
      const [rows] = await connection.query(
        'SELECT * FROM qq_docs_auth WHERE user_id = ?',
        [userId]
      );
      if (rows.length &gt; 0) {
        userTokens = rows[0];
      }
    } finally {
      connection.release();
    }
    
    if (!userTokens) {
      return res.status(400).json({ success: false, error: 'not_authorized' });
    }
    
    const doc = await qqDocsApi.createErrorBook(userId, userTokens, subject);
    
    // 保存文档关联
    const conn2 = await pool.getConnection();
    try {
      await conn2.query(
        `INSERT INTO user_documents (user_id, file_id, title, type, url, doc_type, subject)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [userId, doc.fileId, doc.title, doc.type, doc.url, 'error_book', subject]
      );
    } finally {
      conn2.release();
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

// 创建学习计划
app.post('/api/qq-docs/create-study-plan', async (req, res) =&gt; {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, error: 'unauthorized' });
    }
    
    const decoded = jwt.verify(token, SECRET_KEY);
    const userId = decoded.id;
    const { title } = req.body;
    
    // 获取用户的token信息
    const connection = await pool.getConnection();
    let userTokens = null;
    try {
      const [rows] = await connection.query(
        'SELECT * FROM qq_docs_auth WHERE user_id = ?',
        [userId]
      );
      if (rows.length &gt; 0) {
        userTokens = rows[0];
      }
    } finally {
      connection.release();
    }
    
    if (!userTokens) {
      return res.status(400).json({ success: false, error: 'not_authorized' });
    }
    
    const doc = await qqDocsApi.createStudyPlan(userId, userTokens, title);
    
    // 保存文档关联
    const conn2 = await pool.getConnection();
    try {
      await conn2.query(
        `INSERT INTO user_documents (user_id, file_id, title, type, url, doc_type)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, doc.fileId, doc.title, doc.type, doc.url, 'study_plan']
      );
    } finally {
      conn2.release();
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

// 获取文档列表
app.get('/api/qq-docs/documents', async (req, res) =&gt; {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, error: 'unauthorized' });
    }
    
    const decoded = jwt.verify(token, SECRET_KEY);
    const userId = decoded.id;
    
    // 先从本地数据库获取
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.query(
        'SELECT * FROM user_documents WHERE user_id = ? ORDER BY updated_at DESC',
        [userId]
      );
      
      // 如果本地没有，可以尝试从腾讯文档API获取
      if (rows.length === 0) {
        const [authRows] = await connection.query(
          'SELECT * FROM qq_docs_auth WHERE user_id = ?',
          [userId]
        );
        
        if (authRows.length &gt; 0) {
          try {
            const docs = await qqDocsApi.getDocumentList(userId, authRows[0]);
            return res.json({
              success: true,
              documents: docs
            });
          } catch (apiError) {
            console.log('从腾讯文档API获取失败:', apiError.message);
          }
        }
      }
      
      res.json({
        success: true,
        documents: rows
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('获取文档列表失败:', error);
    res.status(500).json({ success: false, error: 'server_error' });
  }
});
```

---

## 🎨 前端集成

### 在主页面中引入组件

在 `src/pages/index/index.vue` 中：

```vue
&lt;template&gt;
  &lt;view&gt;
    &lt;!-- 其他内容 --&gt;
    
    &lt;!-- 腾讯文档集成模块 --&gt;
    &lt;QQDocsIntegration 
      :courseSchedule="courseSchedule"
    /&gt;
    
    &lt;!-- 其他内容 --&gt;
  &lt;/view&gt;
&lt;/template&gt;

&lt;script&gt;
import QQDocsIntegration from '@/components/QQDocsIntegration.vue';

export default {
  components: {
    QQDocsIntegration
  },
  data() {
    return {
      courseSchedule: null
    };
  }
};
&lt;/script&gt;
```

### 创建webview页面

创建 `src/pages/webview/index.vue` 用于打开腾讯文档：

```vue
&lt;template&gt;
  &lt;view class="webview-container"&gt;
    &lt;view class="header"&gt;
      &lt;text class="back-btn" @click="goBack"&gt;← 返回&lt;/text&gt;
      &lt;text class="title"&gt;腾讯文档&lt;/text&gt;
    &lt;/view&gt;
    &lt;web-view :src="url"&gt;&lt;/web-view&gt;
  &lt;/view&gt;
&lt;/template&gt;

&lt;script&gt;
export default {
  data() {
    return {
      url: ''
    };
  },
  onLoad(options) {
    if (options.url) {
      this.url = decodeURIComponent(options.url);
    }
  },
  methods: {
    goBack() {
      uni.navigateBack();
    }
  }
};
&lt;/script&gt;

&lt;style scoped&gt;
.webview-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.header {
  display: flex;
  align-items: center;
  padding: 16px;
  background: white;
  border-bottom: 1px solid #eee;
}

.back-btn {
  font-size: 16px;
  color: #667eea;
  margin-right: 16px;
}

.title {
  font-size: 16px;
  font-weight: 600;
}
&lt;/style&gt;
```

### 更新pages.json

在 `src/pages.json` 中添加webview页面：

```json
{
  "pages": [
    {
      "path": "pages/webview/index",
      "style": {
        "navigationStyle": "custom"
      }
    }
  ]
}
```

---

## 🤖 AI增强功能

### 1. 课堂笔记智能总结

在拾鸦对话中集成：

```javascript
// 用户说："帮我总结一下今天的高数笔记"
// AI会：
// 1. 获取今天的课程文档
// 2. 分析文档内容
// 3. 提取重点知识
// 4. 生成思维导图或知识点卡片
```

### 2. 错题自动分析

```javascript
// 用户上传错题照片
// AI会：
// 1. OCR识别题目内容
// 2. 分析错误原因
// 3. 提取相关知识点
// 4. 推荐类似题目练习
// 5. 自动添加到错题本表格
```

### 3. 学习计划智能生成

```javascript
// 用户说："帮我制定期末复习计划"
// AI会：
// 1. 分析课程表和剩余时间
// 2. 基于历史学习数据
// 3. 生成个性化复习计划
// 4. 自动创建腾讯收集表
// 5. 设置每日提醒
```

---

## 🎓 学生使用场景示例

### 场景1：课堂学习
1. 课前：拾鸦提醒下节课内容
2. 课中：自动打开课程笔记文档，实时协作记录
3. 课后：AI自动总结重点，生成复习卡片

### 场景2：错题整理
1. 作业中发现错题，拍照上传
2. AI自动识别并添加到腾讯智能表格
3. 按知识点分类整理
4. 根据遗忘曲线定时提醒复习

### 场景3：小组项目
1. 创建协作任务和共享文档
2. 实时协作编辑项目文档
3. 拾鸦乌鸦助手监控进度
4. 完成后自动归档

---

## 📊 与腾讯PCG的结合点

### 1. 腾讯文档
- 多人实时协作
- 丰富的文档类型
- 微信生态深度集成
- 免费使用门槛低

### 2. 腾讯会议（可选扩展）
- 在线课堂录制
- 自动转文字
- 与笔记系统关联

### 3. 微信小程序
- 快速分享笔记
- 小程序内查看编辑
- 微信消息提醒

---

## 🔐 安全与隐私

1. OAuth 2.0授权机制
2. Token加密存储
3. 数据传输HTTPS加密
4. 用户可随时取消授权
5. 权限最小化原则

---

## 📈 后续优化方向

1. **智能模板市场** - 学生分享优质笔记模板
2. **AI助教功能** - 基于笔记内容生成练习题
3. **学习数据分析** - 可视化学习进度和薄弱点
4. **班级知识库** - 班级共享笔记和资料
5. **跨平台同步** - 更好的多端体验

---

## 🆘 常见问题

### Q: 腾讯文档API是免费的吗？
A: 是的，腾讯文档开放平台目前提供免费额度，适合学生使用。

### Q: 如何保证数据安全？
A: 采用OAuth 2.0授权，用户可随时取消授权，Token加密存储。

### Q: 支持离线使用吗？
A: 腾讯文档支持离线编辑，重新上线后自动同步。

---

## 📞 技术支持

如有问题，请参考：
- [腾讯文档开放平台文档](https://docs.qq.com/open/document/)
- [拾鸦项目GitHub仓库]()

---

**祝使用愉快！🎓✨**


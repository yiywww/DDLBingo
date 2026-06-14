
const axios = require('axios');
require('dotenv').config();

/**
 * 腾讯文档API集成模块
 * 用于拾鸦项目与腾讯文档的深度结合
 */
class QQDocsAPI {
  constructor() {
    this.baseUrl = 'https://docs.qq.com/open-api';
    this.clientId = process.env.QQ_DOCS_CLIENT_ID;
    this.clientSecret = process.env.QQ_DOCS_CLIENT_SECRET;
    this.redirectUri = process.env.QQ_DOCS_REDIRECT_URI;
    this.accessTokens = new Map(); // 缓存用户access_token
  }

  /**
   * 获取OAuth授权URL
   * @param {string} userId - 用户ID
   * @param {string} state - 状态参数（防CSRF）
   * @returns {string} 授权URL
   */
  getAuthUrl(userId, state = '') {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'doc:read doc:write doc:list',
      state: state || userId,
    });
    return `https://docs.qq.com/oauth2/authorize?${params.toString()}`;
  }

  /**
   * 通过授权码获取access_token
   * @param {string} code - 授权码
   * @param {string} userId - 用户ID
   * @returns {Promise&lt;{access_token: string, refresh_token: string, expires_in: number}&gt;}
   */
  async getAccessToken(code, userId) {
    try {
      const response = await axios.post(`${this.baseUrl}/oauth2/token`, {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: this.redirectUri,
      });

      const tokenData = response.data;
      this.accessTokens.set(userId, {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: Date.now() + tokenData.expires_in * 1000,
      });

      return tokenData;
    } catch (error) {
      console.error('[腾讯文档] 获取access_token失败:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * 刷新access_token
   * @param {string} userId - 用户ID
   * @param {string} refreshToken - 刷新令牌
   * @returns {Promise&lt;{access_token: string, refresh_token: string, expires_in: number}&gt;}
   */
  async refreshAccessToken(userId, refreshToken) {
    try {
      const response = await axios.post(`${this.baseUrl}/oauth2/token`, {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      });

      const tokenData = response.data;
      this.accessTokens.set(userId, {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: Date.now() + tokenData.expires_in * 1000,
      });

      return tokenData;
    } catch (error) {
      console.error('[腾讯文档] 刷新access_token失败:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * 获取有效的access_token
   * @param {string} userId - 用户ID
   * @param {object} userTokens - 用户token信息
   * @returns {Promise&lt;string&gt;}
   */
  async getValidAccessToken(userId, userTokens) {
    let tokenInfo = this.accessTokens.get(userId);
    
    // 如果缓存中没有，使用数据库中的token
    if (!tokenInfo &amp;&amp; userTokens) {
      tokenInfo = {
        accessToken: userTokens.access_token,
        refreshToken: userTokens.refresh_token,
        expiresAt: userTokens.expires_at,
      };
    }

    if (!tokenInfo) {
      throw new Error('用户未授权腾讯文档');
    }

    // 检查token是否过期（提前5分钟刷新）
    if (Date.now() &gt; tokenInfo.expiresAt - 5 * 60 * 1000) {
      await this.refreshAccessToken(userId, tokenInfo.refreshToken);
      tokenInfo = this.accessTokens.get(userId);
    }

    return tokenInfo.accessToken;
  }

  /**
   * 创建文档
   * @param {string} userId - 用户ID
   * @param {object} userTokens - 用户token信息
   * @param {string} title - 文档标题
   * @param {string} type - 文档类型 (document/sheet/slide/collect/smartdoc/smartsheet/mindmap/flowchart)
   * @returns {Promise&lt;{file_id: string, url: string}&gt;}
   */
  async createDocument(userId, userTokens, title, type = 'smartdoc') {
    try {
      const accessToken = await this.getValidAccessToken(userId, userTokens);
      
      const response = await axios.post(`${this.baseUrl}/files/create`, {
        title: title,
        type: type,
      }, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      return {
        fileId: response.data.file_id,
        url: response.data.url,
        title: response.data.title,
        type: response.data.type,
      };
    } catch (error) {
      console.error('[腾讯文档] 创建文档失败:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * 获取用户文档列表
   * @param {string} userId - 用户ID
   * @param {object} userTokens - 用户token信息
   * @param {string} folderId - 文件夹ID（可选）
   * @returns {Promise&lt;Array&gt;}
   */
  async getDocumentList(userId, userTokens, folderId = '') {
    try {
      const accessToken = await this.getValidAccessToken(userId, userTokens);
      
      const params = folderId ? { folder_id: folderId } : {};
      
      const response = await axios.get(`${this.baseUrl}/files/list`, {
        params,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      return response.data.files || [];
    } catch (error) {
      console.error('[腾讯文档] 获取文档列表失败:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * 创建智能表格（用于错题本、学习计划等）
   * @param {string} userId - 用户ID
   * @param {object} userTokens - 用户token信息
   * @param {string} title - 表格标题
   * @param {Array} sheets - 子表配置
   * @returns {Promise&lt;{file_id: string, url: string}&gt;}
   */
  async createSmartSheet(userId, userTokens, title, sheets = []) {
    try {
      const accessToken = await this.getValidAccessToken(userId, userTokens);
      
      // 创建基础智能表格
      const doc = await this.createDocument(userId, userTokens, title, 'smartsheet');
      
      // 如果有子表配置，继续配置表格
      if (sheets.length &gt; 0) {
        // 这里需要调用智能表格的具体API来配置子表
        // 具体实现根据腾讯文档API文档进行
        console.log('[腾讯文档] 智能表格创建成功，可继续配置子表:', sheets);
      }

      return doc;
    } catch (error) {
      console.error('[腾讯文档] 创建智能表格失败:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * 创建课堂协作笔记
   * @param {string} userId - 用户ID
   * @param {object} userTokens - 用户token信息
   * @param {string} courseName - 课程名称
   * @param {string} date - 日期
   * @returns {Promise&lt;{file_id: string, url: string}&gt;}
   */
  async createClassNote(userId, userTokens, courseName, date = '') {
    const title = `${courseName} - ${date || new Date().toLocaleDateString('zh-CN')} 课堂笔记`;
    
    // 创建智能文档
    const doc = await this.createDocument(userId, userTokens, title, 'smartdoc');
    
    console.log(`[腾讯文档] 已创建课程笔记: ${title}`);
    return doc;
  }

  /**
   * 创建错题本智能表格
   * @param {string} userId - 用户ID
   * @param {object} userTokens - 用户token信息
   * @param {string} subject - 学科名称
   * @returns {Promise&lt;{file_id: string, url: string}&gt;}
   */
  async createErrorBook(userId, userTokens, subject) {
    const title = `${subject} 错题本`;
    
    const sheets = [
      {
        name: '错题记录',
        fields: [
          { name: '题目', type: 'text' },
          { name: '正确答案', type: 'text' },
          { name: '错误原因', type: 'text' },
          { name: '知识点', type: 'text' },
          { name: '掌握程度', type: 'select', options: ['未掌握', '基本掌握', '熟练掌握'] },
          { name: '复习次数', type: 'number' },
          { name: '上次复习时间', type: 'date' },
          { name: '下次复习时间', type: 'date' },
        ],
      },
    ];
    
    const doc = await this.createSmartSheet(userId, userTokens, title, sheets);
    console.log(`[腾讯文档] 已创建错题本: ${title}`);
    return doc;
  }

  /**
   * 创建学习计划收集表
   * @param {string} userId - 用户ID
   * @param {object} userTokens - 用户token信息
   * @param {string} planName - 计划名称
   * @returns {Promise&lt;{file_id: string, url: string}&gt;}
   */
  async createStudyPlan(userId, userTokens, planName) {
    const title = `${planName} 学习计划`;
    const doc = await this.createDocument(userId, userTokens, title, 'collect');
    console.log(`[腾讯文档] 已创建学习计划: ${title}`);
    return doc;
  }

  /**
   * 添加协作者到文档
   * @param {string} userId - 用户ID
   * @param {object} userTokens - 用户token信息
   * @param {string} fileId - 文件ID
   * @param {Array} collaborators - 协作者列表 [{user_id: string, permission: string}]
   * @returns {Promise&lt;void&gt;}
   */
  async addCollaborators(userId, userTokens, fileId, collaborators) {
    try {
      const accessToken = await this.getValidAccessToken(userId, userTokens);
      
      await axios.post(`${this.baseUrl}/permissions/add`, {
        file_id: fileId,
        collaborators: collaborators,
      }, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      console.log(`[腾讯文档] 已添加协作者到文档 ${fileId}`);
    } catch (error) {
      console.error('[腾讯文档] 添加协作者失败:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * 获取文档预览URL
   * @param {string} fileId - 文件ID
   * @returns {string} 预览URL
   */
  getDocumentPreviewUrl(fileId) {
    return `https://docs.qq.com/doc/${fileId}`;
  }

  /**
   * 生成学习计划模板内容
   * @param {string} planType - 计划类型
   * @param {object} options - 配置选项
   * @returns {string} 模板内容
   */
  generateStudyPlanTemplate(planType, options = {}) {
    const templates = {
      daily: `
# 每日学习计划

## 📅 今日目标
- [ ] 任务1
- [ ] 任务2

## ⏰ 时间安排
| 时间段 | 学习内容 |
|--------|----------|
| 8:00-9:00 |  |
| 9:00-10:00 |  |

## 📝 学习笔记
（在此记录学习内容）

## ✨ 今日收获
（在此总结今日收获）
      `,
      weekly: `
# 周学习计划

## 🎯 本周目标
- [ ] 目标1
- [ ] 目标2

## 📅 每日安排
### 周一
### 周二
### 周三
### 周四
### 周五
### 周六
### 周日

## 📊 进度跟踪
（记录本周学习进度）
      `,
      exam: `
# 考试复习计划

## 📚 复习科目
- 科目1
- 科目2

## ⏰ 复习时间表
| 日期 | 上午 | 下午 | 晚上 |
|------|------|------|------|
|      |      |      |      |

## 📝 重点知识点
（列出需要重点复习的知识点）

## ✅ 复习进度
- [ ] 知识点1
- [ ] 知识点2
      `,
    };

    return templates[planType] || templates.daily;
  }
}

module.exports = new QQDocsAPI();

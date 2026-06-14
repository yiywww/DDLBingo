// API 基础 URL：开发走 Vite 代理；生产 H5 与页面同源（避免 HTTPS 页请求 http IP 被浏览器拦截）
function resolveApiBaseUrl() {
  if (process.env.NODE_ENV === 'development') return '/api';
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/api`;
  }
  return 'https://shiya.yiywww.xyz/api';
}

export const API_BASE_URL = resolveApiBaseUrl();

/**
 * 发送 API 请求
 * @param {string} url - API 路径
 * @param {object} options - 请求选项
 * @returns {Promise<any>} - 返回响应数据
 */
export const request = async (url, options = {}) => {
  return new Promise((resolve, reject) => {
    try {
      const fullUrl = `${API_BASE_URL}${url}`;
      console.log('API Request:', fullUrl, options);
      
      // 构建请求头
      const headers = {
        'content-type': 'application/json',
        ...options.headers
      };
      
      // 使用 JWT 认证（前端用户认证）
      const token = uni.getStorageSync('token');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      uni.request({
        url: fullUrl,
        method: options.method || 'GET',
        data: options.data,
        header: headers,
        success: (res) => {
          console.log('API Response:', res);
          // 对于 400 和 401 状态码，也解析响应数据并返回
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(res.data);
          } else if ((res.statusCode === 400 || res.statusCode === 401) && res.data) {
            resolve(res.data);
          } else {
            reject(new Error(`API error: ${res.statusCode}`));
          }
        },
        fail: (err) => {
          console.error('API request failed:', err);
          reject(err);
        }
      });
    } catch (error) {
      console.error('API request error:', error);
      reject(error);
    }
  });
};

// ============== 会话管理 API ==============

/**
 * 获取会话列表
 * @param {object} params - { current, size }
 * @returns {Promise<any>}
 */
export const getConversations = async (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return request(`/conversations${query ? '?' + query : ''}`, {
    method: 'GET',
  });
};

/**
 * 更新会话标题
 * @param {string} id - 会话ID
 * @param {string} title - 新标题
 * @returns {Promise<any>}
 */
export const updateConversationTitle = async (id, title) => {
  return request(`/conversations/${id}`, {
    method: 'POST',
    data: { title },
  });
};

/**
 * 删除会话
 * @param {string} id - 会话ID
 * @returns {Promise<any>}
 */
export const deleteConversation = async (id) => {
  return request(`/conversations/${id}`, {
    method: 'DELETE',
  });
};

/**
 * 获取会话消息历史
 * @param {string} id - 会话ID
 * @returns {Promise<any>}
 */
export const getConversationMessages = async (id) => {
  return request(`/conversations/${id}/messages`, {
    method: 'GET',
  });
};

/**
 * 登录请求
 * @param {object} credentials - 登录凭证
 * @returns {Promise<any>} - 返回登录结果
 */
export const login = async (credentials) => {
  return request('/login', {
    method: 'POST',
    data: credentials
  });
};

/**
 * 注册请求
 * @param {object} userData - 用户注册数据
 * @returns {Promise<any>} - 返回注册结果
 */
export const register = async (userData) => {
  console.log('Register request data:', userData);
  return request('/register', {
    method: 'POST',
    data: userData
  });
};

// ============== 任务管理 API ==============

/**
 * AI 任务拆解
 * @param {object} params - { content, sessionId }
 * @returns {Promise<any>}
 */
export const splitTask = async (params) => {
  return request('/tasks/split', {
    method: 'POST',
    data: params,
  });
};

/**
 * 获取任务列表
 * @param {object} params - { sessionId, status }
 * @returns {Promise<any>}
 */
export const getTasks = async (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return request(`/tasks${query ? '?' + query : ''}`, {
    method: 'GET',
  });
};

/**
 * 创建任务（支持批量）
 * @param {object} data - 任务数据
 * @returns {Promise<any>}
 */
export const createTasks = async (data) => {
  return request('/tasks', {
    method: 'POST',
    data,
  });
};

/**
 * 更新任务
 * @param {number} id - 任务ID
 * @param {object} data - 更新字段
 * @returns {Promise<any>}
 */
export const updateTask = async (id, data) => {
  return request(`/tasks/${id}`, {
    method: 'PUT',
    data,
  });
};

/**
 * 删除任务
 * @param {number} id - 任务ID
 * @returns {Promise<any>}
 */
export const deleteTask = async (id) => {
  return request(`/tasks/${id}`, {
    method: 'DELETE',
  });
};

/**
 * 获取 Bingo 任务池
 * @returns {Promise<any>}
 */
export const getBingoPool = async () => {
  return request('/tasks/bingo-pool', {
    method: 'GET',
  });
};

/**
 * 保存 Bingo 完成状态
 * @param {Array} completedTasks - 已完成的任务列表
 * @returns {Promise<any>}
 */
export const saveBingoResults = async (completedTasks) => {
  return request('/tasks/save-from-bingo', {
    method: 'POST',
    data: { completedTasks },
  });
};

// ============== DDL 库 API ==============

/**
 * 获取 DDL 库任务池（个人日程 + 经典小任务）
 * @param {object} params - { availableMinutes, count? }
 * @returns {Promise<{success: boolean, data: Array, stats: object}>}
 */
export const getDDLPool = async (params = {}) => {
  return request('/tasks/ddl-pool', {
    method: 'POST',
    data: params,
  });
};

/**
 * DDL 库任务完成时，回写日程完成状态
 * @param {string} taskId - 格式 "ddl_{originalId}"
 * @returns {Promise<{success: boolean, scheduleUpdated: boolean}>}
 */
export const completeDDLTask = async (taskId) => {
  return request('/tasks/ddl-complete', {
    method: 'POST',
    data: { taskId },
  });
};

// ============== 成就墙 API ==============

/**
 * 获取用户的 Bingo 成就列表（从服务端）
 * @returns {Promise<{success: boolean, data: Array}>}
 */
export const getAchievements = async () => {
  return request('/tasks/achievements', {
    method: 'GET',
  });
};

/**
 * 保存用户的 Bingo 成就列表（全量替换）
 * @param {Array} achievements - 成就列表
 * @returns {Promise<{success: boolean}>}
 */
export const saveAchievements = async (achievements) => {
  return request('/tasks/achievements', {
    method: 'POST',
    data: { achievements },
  });
};

// ============== DDL 联动：日程 ↔ agent_tasks 双向同步 ==============

/**
 * 日程 → agent_tasks：创建/编辑日程时同步到任务表
 * @param {object} todo - 日程对象
 * @param {string} sessionId - 会话ID
 * @returns {Promise<{success: boolean, taskId: number}>}
 */
export const syncScheduleToTasks = async (todo, sessionId) => {
  return request('/tasks/sync-from-schedule', {
    method: 'POST',
    data: { todo, sessionId },
  });
};

/**
 * agent_tasks → 日程：Bingo 完成任务时回写日程状态
 * @param {number} taskId - agent_tasks 表的 ID
 * @param {boolean} completed - 是否完成
 * @returns {Promise<{success: boolean, updated: boolean}>}
 */
export const syncTaskToSchedule = async (taskId, completed) => {
  return request('/tasks/sync-to-schedule', {
    method: 'POST',
    data: { taskId, completed },
  });
};

// ============== DeepSeek 对话 API ==============

/**
 * 发送消息到 DeepSeek（流式 SSE）
 * 自动管理 sessionId：首次为空由后端创建，后续复用同一 session
 *
 * @param {object} params - { content, mode, sessionId? }
 * @param {function} onEvent - 事件回调 (eventType, data) => void
 * @param {object} options - { persistKey?: string } 存储 sessionId 的 key
 * @returns {Promise<void>}
 */
export const chatWithDeepSeek = async (params, onEvent, options = {}) => {
  const token = uni.getStorageSync('token');
  const deepseekKey = uni.getStorageSync('deepseek_api_key') || '';
  const fullUrl = `${API_BASE_URL}/chat/deepseek`;

  // 会话管理：读取已有 sessionId
  const persistKey = options.persistKey || 'shiya_session_id';
  const existingSessionId = uni.getStorageSync(persistKey);
  const requestData = {
    content: params.content,
    mode: params.mode || 'chat',
    sessionId: params.sessionId || existingSessionId || undefined,
    deepseekApiKey: deepseekKey,
  };

  return new Promise((resolve, reject) => {
    const requestTask = uni.request({
      url: fullUrl,
      method: 'POST',
      data: requestData,
      header: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
      },
      enableChunked: true,
      responseType: 'text',
      success: () => resolve(),
      fail: (err) => reject(err),
    });

    let buffer = '';
    requestTask.onChunkReceived((chunk) => {
      const text = typeof chunk.data === 'string'
        ? chunk.data
        : new TextDecoder().decode(chunk.data);

      buffer += text;
      const events = buffer.split('\n\n');
      buffer = events.pop() || '';

      for (const event of events) {
        const lines = event.split('\n');
        let eventType = 'message';
        let dataStr = '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            dataStr = line.slice(6).trim();
          }
        }

        if (dataStr && onEvent) {
          try {
            const data = JSON.parse(dataStr);

            // done 事件时保存 sessionId 供后续多轮使用
            if (eventType === 'done' && data.sessionId) {
              uni.setStorageSync(persistKey, data.sessionId);
            }

            onEvent(eventType, data);
          } catch (e) {
            // 跳过无法解析的事件数据
          }
        }
      }
    });
  });
};
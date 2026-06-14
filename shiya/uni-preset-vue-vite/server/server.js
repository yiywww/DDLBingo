const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');
require('dotenv').config();

// DeepSeek AI 服务（统一 AI 引擎）
const { callDeepSeek, callDeepSeekStream } = require('./services/deepseek');
const { getSystemPrompt } = require('./prompts');
const { buildMessagesForDeepSeek, saveAssistantMessage, estimateTokens } = require('./services/conversation');
const tasksRouter = require('./routes/tasks');
const conversationsRouter = require('./routes/conversations');

// 流式响应辅助函数
const sendSSEvent = async (res, type, data) => {
  res.write(`event: ${type}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
  // 强制刷新，确保事件立即发送
  if (res.socket && !res.socket.destroyed) {
    res.socket.cork?.();
    res.socket.uncork?.();
  }
  if (typeof res.flush === 'function') {
    res.flush();
  }
  // 去掉延迟！
  await new Promise(resolve => setTimeout(resolve, 30));
};

const app = express();
const PORT = process.env.PORT || 3004;
const SECRET_KEY = process.env.SECRET_KEY;

// 配置CORS，允许所有来源（开发环境）
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ============== 输入清理函数 ==============
function cleanInput(input) {
  if (!input || typeof input !== 'string') {
    return input;
  }
  
  let cleaned = input;
  
  // 清理模板字符串如 {{time.YYYY-MM-DD}}、{{variable}} 等
  cleaned = cleaned.replace(/\{\{[^}]+\}\}/g, '');
  
  // 清理多余的空白字符
  cleaned = cleaned.trim();
  
  return cleaned;
}

// ============== 乌鸦状态衰减计算 ==============
// 心情条：满条 6h 降为 0；食物/健康条：满条 12h 降为 0
function calculateCrowDecay(crowStats, lastUpdated) {
  if (!lastUpdated) return crowStats;
  const now = new Date();
  const elapsedMs = now - new Date(lastUpdated);
  if (elapsedMs <= 0) return crowStats;
  const elapsedHours = elapsedMs / (1000 * 60 * 60);
  // 心情：100% → 0% / 6h → 每小时降 16.667%
  const moodDecay = elapsedHours * (100 / 6);
  // 健康/食物：100% → 0% / 12h → 每小时降 8.333%
  const hungerDecay = elapsedHours * (100 / 12);
  return {
    hunger: Math.max(0, Math.round((crowStats.hunger - hungerDecay) * 100) / 100),
    mood: Math.max(0, Math.round((crowStats.mood - moodDecay) * 100) / 100)
  };
}

// ============== 自然语言时间解析模块 ==============
function parseNaturalLanguageTime(input) {
  console.log('[🕒 parseNaturalLanguageTime] 输入:', input);
  
  if (!input || typeof input !== 'string') {
    console.log('[🕒 parseNaturalLanguageTime] 输入无效，返回空');
    return { date: null, time: null, startTime: null, endTime: null };
  }
  
  // 清理输入
  const cleanedInput = cleanInput(input);
  console.log('[🕒 parseNaturalLanguageTime] 清理后:', cleanedInput);
  
  // === 先检查是否已经是标准格式 ===
  // 检查 YYYY-MM-DD 格式
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  // 检查 HH:MM 格式
  const timePattern = /^\d{2}:\d{2}$/;
  
  const now = new Date();
  let date = null;
  let time = null;
  let startTime = null;
  let endTime = null;
  let startDate = null;
  let endDate = null;
  
  // 如果输入已经是标准日期格式，直接返回
  if (datePattern.test(cleanedInput)) {
    console.log('[🕒 parseNaturalLanguageTime] 检测到标准日期格式，直接返回');
    return { date: cleanedInput, time: null, startTime: null, endTime: null };
  }
  
  // 如果输入已经是标准时间格式，直接返回
  if (timePattern.test(cleanedInput)) {
    console.log('[🕒 parseNaturalLanguageTime] 检测到标准时间格式，直接返回');
    return { date: null, time: cleanedInput, startTime: null, endTime: null };
  }
  
  // === 先检查是否是时间段 ===
  // 匹配 "2点到4点"、"下午2点到4点"、"2:00-4:00" 等
  const timeRangeMatch = cleanedInput.match(/(\d{1,2}:?\d{0,2})[\s点到至\-~]+(\d{1,2}:?\d{0,2})/);
  if (timeRangeMatch) {
    console.log('[🕒 parseNaturalLanguageTime] 检测到时间段格式');
    
    // 解析开始时间
    let startHour = null;
    let startMinute = 0;
    const startStr = timeRangeMatch[1];
    if (startStr.includes(':')) {
      const parts = startStr.split(':');
      startHour = parseInt(parts[0]);
      startMinute = parseInt(parts[1]) || 0;
    } else {
      startHour = parseInt(startStr);
    }
    
    // 解析结束时间
    let endHour = null;
    let endMinute = 0;
    const endStr = timeRangeMatch[2];
    if (endStr.includes(':')) {
      const parts = endStr.split(':');
      endHour = parseInt(parts[0]);
      endMinute = parseInt(parts[1]) || 0;
    } else {
      endHour = parseInt(endStr);
    }
    
    // 处理上午/下午/晚上
    let hasMorning = cleanedInput.includes('早上') || cleanedInput.includes('早晨') || cleanedInput.includes('上午') || cleanedInput.includes('凌晨');
    let hasAfternoon = cleanedInput.includes('下午') || cleanedInput.includes('傍晚');
    let hasEvening = cleanedInput.includes('晚上') || cleanedInput.includes('夜里');
    
    // 调整开始时间
    if (startHour !== null) {
      if (hasAfternoon && startHour < 12) startHour += 12;
      if (hasEvening && startHour >= 1 && startHour < 12) startHour += 12;
      if (hasMorning && startHour === 12) startHour = 0;
      
      // 确保时间在有效范围内
      if (startHour >= 0 && startHour < 24 && startMinute >= 0 && startMinute < 60) {
        startTime = `${startHour.toString().padStart(2, '0')}:${startMinute.toString().padStart(2, '0')}`;
      }
    }
    
    // 调整结束时间
    if (endHour !== null) {
      if (hasAfternoon && endHour < 12) endHour += 12;
      if (hasEvening && endHour >= 1 && endHour < 12) endHour += 12;
      if (hasMorning && endHour === 12) endHour = 0;
      
      // 确保时间在有效范围内
      if (endHour >= 0 && endHour < 24 && endMinute >= 0 && endMinute < 60) {
        endTime = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;
      }
    }
    
    console.log('[🕒 parseNaturalLanguageTime] 时间段解析结果:', { startTime, endTime });
    
    // 返回时间段，不设置单个time
    return { date: null, time: null, startTime, endTime };
  }
  
  // === 检查是否是日期范围 ===
  const dateRangeMatch = cleanedInput.match(/(从.*到.*)|(从.*至.*)|(.*到.*)|(.*至.*)/);
  if (dateRangeMatch) {
    console.log('[🕒 parseNaturalLanguageTime] 检测到日期范围格式');
    
    // 解析开始日期
    let startDateStr = null;
    let endDateStr = null;
    
    // 尝试解析各种日期
    if (cleanedInput.includes('今天')) {
      startDateStr = getLocalDateString(now);
    } else if (cleanedInput.includes('明天')) {
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      startDateStr = getLocalDateString(tomorrow);
    } else if (cleanedInput.includes('后天')) {
      const dayAfter = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
      startDateStr = getLocalDateString(dayAfter);
    } else if (cleanedInput.includes('大后天')) {
      const dayAfter3 = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      startDateStr = getLocalDateString(dayAfter3);
    } else if (cleanedInput.includes('昨天')) {
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      startDateStr = getLocalDateString(yesterday);
    } else if (cleanedInput.includes('前天')) {
      const dayBefore = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
      startDateStr = getLocalDateString(dayBefore);
    } else if (cleanedInput.includes('大前天')) {
      const dayBefore3 = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      startDateStr = getLocalDateString(dayBefore3);
    }
    
    // 解析结束日期
    if (cleanedInput.includes('今天') && cleanedInput.match(/到今天|至今天|今天$/)) {
      endDateStr = getLocalDateString(now);
    } else if (cleanedInput.includes('明天') && cleanedInput.match(/到明天|至明天|明天$/)) {
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      endDateStr = getLocalDateString(tomorrow);
    } else if (cleanedInput.includes('后天') && cleanedInput.match(/到后天|至后天|后天$/)) {
      const dayAfter = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
      endDateStr = getLocalDateString(dayAfter);
    } else if (cleanedInput.includes('大后天') && cleanedInput.match(/到大后天|至大后天|大后天$/)) {
      const dayAfter3 = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      endDateStr = getLocalDateString(dayAfter3);
    }
    
    console.log('[🕒 parseNaturalLanguageTime] 日期范围解析结果:', { startDateStr, endDateStr });
    
    // 如果解析出了日期范围，就返回
    if (startDateStr && endDateStr) {
      return { 
        date: startDateStr, 
        time: null, 
        startTime: startDateStr, 
        endTime: endDateStr,
        isDateRange: true 
      };
    }
  }
  
  // === 日期解析 ===
  if (cleanedInput.includes('今天') || cleanedInput.includes('今晚') || cleanedInput.includes('今天晚上') || cleanedInput.toLowerCase().includes('today') || cleanedInput.toLowerCase().includes('tonight')) {
    date = getLocalDateString(now);
  } else if (cleanedInput.includes('明天') || cleanedInput.includes('明早') || cleanedInput.includes('明天早上') || cleanedInput.includes('明天晚上') || cleanedInput.toLowerCase().includes('tomorrow')) {
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    date = getLocalDateString(tomorrow);
  } else if (cleanedInput.includes('后天') || cleanedInput.toLowerCase().includes('day after tomorrow')) {
    const dayAfter = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
    date = getLocalDateString(dayAfter);
  } else if (cleanedInput.includes('大后天')) {
    const dayAfter3 = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    date = getLocalDateString(dayAfter3);
  } else if (cleanedInput.includes('昨天') || cleanedInput.toLowerCase().includes('yesterday')) {
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    date = getLocalDateString(yesterday);
  } else if (cleanedInput.includes('前天') || cleanedInput.toLowerCase().includes('day before yesterday')) {
    const dayBefore = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    date = getLocalDateString(dayBefore);
  } else if (cleanedInput.includes('大前天')) {
    const dayBefore3 = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    date = getLocalDateString(dayBefore3);
  } else if (cleanedInput.includes('这周一') || cleanedInput.includes('本周一') || cleanedInput.includes('周一') || cleanedInput.includes('星期一')) {
    const dayOfWeek = now.getDay(); // 0是周日
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now.getTime() + diff * 24 * 60 * 60 * 1000);
    date = getLocalDateString(monday);
  } else if (cleanedInput.includes('这周二') || cleanedInput.includes('本周二') || cleanedInput.includes('周二') || cleanedInput.includes('星期二')) {
    const dayOfWeek = now.getDay();
    const diff = dayOfWeek === 0 ? -5 : 2 - dayOfWeek;
    const tuesday = new Date(now.getTime() + diff * 24 * 60 * 60 * 1000);
    date = getLocalDateString(tuesday);
  } else if (cleanedInput.includes('这周三') || cleanedInput.includes('本周三') || cleanedInput.includes('周三') || cleanedInput.includes('星期三')) {
    const dayOfWeek = now.getDay();
    const diff = dayOfWeek === 0 ? -4 : 3 - dayOfWeek;
    const wednesday = new Date(now.getTime() + diff * 24 * 60 * 60 * 1000);
    date = getLocalDateString(wednesday);
  } else if (cleanedInput.includes('这周四') || cleanedInput.includes('本周四') || cleanedInput.includes('周四') || cleanedInput.includes('星期四')) {
    const dayOfWeek = now.getDay();
    const diff = dayOfWeek === 0 ? -3 : 4 - dayOfWeek;
    const thursday = new Date(now.getTime() + diff * 24 * 60 * 60 * 1000);
    date = getLocalDateString(thursday);
  } else if (cleanedInput.includes('这周五') || cleanedInput.includes('本周五') || cleanedInput.includes('周五') || cleanedInput.includes('星期五')) {
    const dayOfWeek = now.getDay();
    const diff = dayOfWeek === 0 ? -2 : 5 - dayOfWeek;
    const friday = new Date(now.getTime() + diff * 24 * 60 * 60 * 1000);
    date = getLocalDateString(friday);
  } else if (cleanedInput.includes('这周六') || cleanedInput.includes('本周六') || cleanedInput.includes('周六') || cleanedInput.includes('星期六')) {
    const dayOfWeek = now.getDay();
    const diff = dayOfWeek === 0 ? -1 : 6 - dayOfWeek;
    const saturday = new Date(now.getTime() + diff * 24 * 60 * 60 * 1000);
    date = getLocalDateString(saturday);
  } else if (cleanedInput.includes('这周日') || cleanedInput.includes('本周日') || cleanedInput.includes('周日') || cleanedInput.includes('星期日')) {
    const dayOfWeek = now.getDay();
    const diff = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
    const sunday = new Date(now.getTime() + diff * 24 * 60 * 60 * 1000);
    date = getLocalDateString(sunday);
  } else {
    // 解析 "X号"、"X日" 格式
    const dayMatch = cleanedInput.match(/(\d{1,2})[号日]/);
    if (dayMatch) {
      const day = parseInt(dayMatch[1]);
      const targetDate = new Date(now.getFullYear(), now.getMonth(), day);
      date = getLocalDateString(targetDate);
      console.log('[🕒 parseNaturalLanguageTime] 解析到 X号/X日 格式:', { day, date });
    }
  }
  
  // === 时间解析 ===
  let hour = null;
  let minute = 0;
  
  // 先检查是否有"早上/早晨/上午/下午/傍晚/晚上/夜里/凌晨"
  let hasMorning = cleanedInput.includes('早上') || cleanedInput.includes('早晨') || cleanedInput.includes('上午') || cleanedInput.includes('凌晨');
  let hasAfternoon = cleanedInput.includes('下午') || cleanedInput.includes('傍晚');
  let hasEvening = cleanedInput.includes('晚上') || cleanedInput.includes('夜里');
  
  // 匹配各种时间格式
  const timePatterns = [
    /(\d{1,2}):(\d{2})/,           // 08:00
    /(\d{1,2})点(\d{1,2})分?/,      // 8点30分
    /(\d{1,2})点/,                   // 8点
    /(\d{1,2})点钟/,                 // 8点钟
    /(\d{1,2})时(\d{1,2})分?/,       // 8时30分
    /(\d{1,2})时/                    // 8时
  ];
  
  for (const pattern of timePatterns) {
    const match = cleanedInput.match(pattern);
    if (match) {
      hour = parseInt(match[1]);
      minute = parseInt(match[2]) || 0;
      break;
    }
  }
  
  // 处理特殊的时间词
  if (hour === null) {
    if (cleanedInput.includes('早上') || cleanedInput.includes('早晨')) {
      hour = 8;
    } else if (cleanedInput.includes('中午')) {
      hour = 12;
    } else if (cleanedInput.includes('下午')) {
      hour = 14;
    } else if (cleanedInput.includes('傍晚')) {
      hour = 18;
    } else if (cleanedInput.includes('晚上')) {
      hour = 20;
    }
  }
  
  // 如果找到小时，处理上午/下午/晚上
  if (hour !== null) {
    if (hasAfternoon && hour < 12) {
      hour += 12;
    }
    if (hasEvening && hour >= 1 && hour < 12) {
      hour += 12;
    }
    // 上午12点改为0点
    if (hasMorning && hour === 12) {
      hour = 0;
    }
    
    // 确保时间在有效范围内
    if (hour >= 0 && hour < 24 && minute >= 0 && minute < 60) {
      time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    }
  }
  
  // 如果没有明确日期，默认用今天
  if (!date) {
    date = getLocalDateString(now);
  }
  
  // 设置 startTime 和 endTime（用于单个日期/时间的情况）
  if (!startTime) {
    if (date && time) {
      startTime = `${date} ${time}`;
      endTime = startTime;
    } else if (date) {
      startTime = date;
      endTime = date;
    }
  }
  
  console.log('[🕒 parseNaturalLanguageTime] 输出:', { date, time, startTime, endTime });
  
  return { date, time, startTime, endTime };
}
// ============== 自然语言时间解析模块结束 ==============

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'shiyo',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'shiya',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// 共享连接池给路由模块
app.locals.pool = pool;

// 🧠 临时缓存：保存用户最近一次解析好的时间（userId -> {date, time, text}）
const parsedTimeCache = new Map();

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
        'INSERT INTO crow_data (user_id, crow_stats, chat_messages, food_count, last_updated) VALUES (?, ?, ?, ?, NOW())',
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
  
  // ============== 认证逻辑（新版） ==============
  const xApiKey = req.headers['x-api-key'] || req.headers['X-API-KEY'] || req.query['x-api-key'] || req.query['api_key'];
  const configApiKey = process.env.X_API_KEY;
  let userId = null;
  
  console.log('\n=== /api/save-data 请求 ===');
  console.log('[DEBUG] 请求来源:', req.headers.origin);
  console.log('[DEBUG] X-API-KEY (Header/Query):', xApiKey ? '收到' : '没收到');
  
  // 1. 优先检查X-API-KEY
  if (configApiKey && xApiKey && xApiKey === configApiKey) {
    userId = 3;  // 默认用户ID
    console.log('[认证] ✅ X-API-KEY验证成功，用户ID:', userId);
  } else {
    // 2. 没有X-API-KEY，尝试token
    const token = req.headers.authorization?.split(' ')[1] || req.body.token;
    console.log('[DEBUG] 请求体中的 token:', req.body.token ? '存在' : '不存在');
    console.log('[DEBUG] 最终使用的 token:', token ? '存在' : '不存在');
    
    if (token) {
      try {
        const decoded = jwt.verify(token, SECRET_KEY);
        userId = decoded.id;
        console.log('[认证] ✅ 从Header/Body JWT验证成功，用户ID:', userId);
      } catch (error) {
        console.log('[ERROR] token 验证失败:', error.message);
      }
    }
    
    // 3. 没有token但有action，默认用3
    if (!userId && req.body.action) {
      userId = 3;
      console.log('[认证] ⚠️ 没有token但有action，使用默认用户ID:', userId);
    }
  }
  
  const { todos: reqTodos, diaryEntries: reqDiaryEntries, repeatTasks, completedTasks, courseSchedule, action, text, time, date, todoId, content, imageUrl, images, tags, preferences, priority } = req.body;
  console.log('[DEBUG] 请求体 action:', action);
  console.log('[DEBUG] 请求体 text:', text);
  console.log('[DEBUG] 请求体 date:', date);
  console.log('[DEBUG] 请求体 time:', time);
  console.log('[DEBUG] 请求体 priority:', priority);
  console.log('[DEBUG] 请求体 todos 存在:', reqTodos !== undefined);
  console.log('[DEBUG] 请求体 diaryEntries 存在:', reqDiaryEntries !== undefined);
  
  // 🧠 优先使用缓存里的解析结果！不管Dify传了什么
  let cachedTime = null;
  if (userId && parsedTimeCache.has(userId)) {
    cachedTime = parsedTimeCache.get(userId);
    console.log('[缓存] ✅ 找到缓存的解析结果:', cachedTime);
    
    // 检查缓存是否过期（5分钟内有效）
    const now = Date.now();
    if (now - cachedTime.timestamp > 5 * 60 * 1000) {
      console.log('[缓存] ⚠️ 缓存已过期，忽略');
      cachedTime = null;
      parsedTimeCache.delete(userId);
    }
  }

  if (!userId) {
    console.log('[ERROR] userId 不存在，返回 401');
    return res.status(401).json({ success: false, error: 'unauthorized' });
  }

  try {
    const connection = await pool.getConnection();
    let actionResult = null;

    try {
      if (action) {
        console.log('[DEBUG] 处理 action:', action);
        console.log('[DEBUG] 原始参数:', { date, time, text });
        
        // 兼容 add 和 create 两种 action
        if ((action === 'create' || action === 'add') && text) {
          // 🧹 清理所有输入参数
          const cleanedText = cleanInput(text);
          let cleanedDate = cleanInput(date);
          let cleanedTime = cleanInput(time);
          
          // 🧠 优先使用缓存里的解析结果！这是最关键的！
          if (cachedTime) {
            console.log('[缓存] ✅ 使用缓存的解析结果覆盖Dify传来的无效值');
            if (cachedTime.date) cleanedDate = cachedTime.date;
            if (cachedTime.time) cleanedTime = cachedTime.time;
            
            // 使用完后删除缓存，避免重复使用
            parsedTimeCache.delete(userId);
            console.log('[缓存] ✅ 已删除已使用的缓存');
          }
          
          const [rows] = await connection.query(
            'SELECT content FROM user_data WHERE user_id = ? AND data_type = ?',
            [userId, 'todos']
          );
          
          let todos = [];
          if (rows.length > 0) {
            todos = safeParseJSON(rows[0].content, []);
          }
          
          console.log('[DEBUG] 最终使用的参数:', { cleanedText, cleanedDate, cleanedTime });
          
          // ✅ 解析自然语言日期和时间
          let finalDate = getLocalDateString();
          let finalTime = cleanedTime || '';
          let finalStartTime = '';
          let finalEndTime = '';
          
          if (cleanedDate && typeof cleanedDate === 'string') {
            const parsed = parseNaturalLanguageTime(cleanedDate);
            if (parsed.date) finalDate = parsed.date;
            if (parsed.time && !cleanedTime) finalTime = parsed.time;
            // 检查是否有时间段
            if (parsed.startTime && parsed.endTime) {
              finalStartTime = parsed.startTime;
              finalEndTime = parsed.endTime;
            }
          }
          
          if (cleanedTime && typeof cleanedTime === 'string') {
            const parsed = parseNaturalLanguageTime(cleanedTime);
            if (parsed.time) finalTime = parsed.time;
            if (parsed.date && !cleanedDate) finalDate = parsed.date;
            // 检查是否有时间段
            if (parsed.startTime && parsed.endTime) {
              finalStartTime = parsed.startTime;
              finalEndTime = parsed.endTime;
            }
          }
          
          // 处理 startTime 和 endTime，跟前端保持一致
          // 检查 finalStartTime/finalEndTime 是否已经是日期格式（YYYY-MM-DD）
          const isDateFormat = (str) => /^\d{4}-\d{2}-\d{2}$/.test(str);
          
          if (finalDate && finalStartTime && finalEndTime) {
            // 检查是否已经是日期（日期范围的情况，不需要加日期）
            if (!isDateFormat(finalStartTime)) {
              // 如果是纯时间格式，才加日期
              finalStartTime = `${finalDate} ${finalStartTime}`;
              finalEndTime = `${finalDate} ${finalEndTime}`;
            }
            // 如果已经是日期格式，就不用加了
          } else if (finalDate && finalTime) {
            // 单个时间
            finalStartTime = `${finalDate} ${finalTime}`;
            finalEndTime = finalStartTime;
          } else if (finalDate) {
            // 只有日期
            finalStartTime = finalDate;
            finalEndTime = finalDate;
          }
          
          console.log('[DEBUG] Dify创建日程:', { finalDate, finalTime, finalStartTime, finalEndTime });
          
          console.log('[DEBUG] 使用参数:', { finalDate, finalTime, finalStartTime, finalEndTime });
          
          // 处理优先级：兼容中文和英文
          let finalPriority = 'normal'; // 默认一般
          if (priority) {
            const p = priority.toLowerCase();
            if (p === 'urgent' || p === '紧急' || p === 'high' || p === '高') {
              finalPriority = 'urgent';
            } else if (p === 'normal' || p === '一般' || p === 'medium' || p === '中') {
              finalPriority = 'normal';
            }
          }
          
          const newTodo = {
            id: generateId({ text: cleanedText, date: finalDate, time: finalTime }, 'task'),
            text: cleanedText,
            date: finalDate,
            time: finalTime,
            completed: false,
            details: '',           // 任务详情（空着）
            startTime: finalStartTime,  // 开始时间 = 完整的日期时间
            endTime: finalEndTime,      // 结束时间 = 完整的日期时间
            isRepeat: false,       // 不重复
            priority: finalPriority,      // 优先级
            estimatedTime: req.body.estimatedTime || 0,  // 预计耗时
            difficulty: req.body.difficulty || 'medium',  // 启动难度
            updatedAt: Date.now()
          };
          
          todos.push(newTodo);
          
          await connection.query(
            'INSERT INTO user_data (user_id, data_type, content) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE content = ?',
            [userId, 'todos', JSON.stringify(todos), JSON.stringify(todos)]
          );
          
          actionResult = {
            success: true,
            data: newTodo,
            action: 'create'
          };
        } else if ((action === 'create' || action === 'add') && content) {
          // 🧹 清理所有输入参数
          const cleanedContent = cleanInput(content);
          const cleanedDate = cleanInput(date);
          
          // 日记也解析一下日期
          let diaryDate = cleanedDate;
          if (cleanedDate && typeof cleanedDate === 'string') {
            const parsed = parseNaturalLanguageTime(cleanedDate);
            if (parsed.date) diaryDate = parsed.date;
          }
          if (cleanedContent && typeof cleanedContent === 'string' && !cleanedDate) {
            const parsed = parseNaturalLanguageTime(cleanedContent);
            if (parsed.date) diaryDate = parsed.date;
          }
          
          const [rows] = await connection.query(
            'SELECT content FROM user_data WHERE user_id = ? AND data_type = ?',
            [userId, 'diaryEntries']
          );
          
          let diaryEntries = [];
          if (rows.length > 0) {
            diaryEntries = safeParseJSON(rows[0].content, []);
          }
          
          const now = Date.now();
          const newEntry = {
            id: generateId({ content: cleanedContent, tags, images, date: diaryDate }, 'diary'),
            date: diaryDate || getLocalDateString(),
            content: cleanedContent,
            tags: tags || [],
            images: images || [],
            image: imageUrl || (images && images.length > 0 ? images[0] : null),
            updatedAt: now
          };
          
          diaryEntries.push(newEntry);
          
          await connection.query(
            'INSERT INTO user_data (user_id, data_type, content) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE content = ?',
            [userId, 'diaryEntries', JSON.stringify(diaryEntries), JSON.stringify(diaryEntries)]
          );
          
          actionResult = {
            success: true,
            data: newEntry,
            action: 'create'
          };
        } else if (action === 'query') {
          const [rows] = await connection.query(
            'SELECT content FROM user_data WHERE user_id = ? AND data_type = ?',
            [userId, text ? 'todos' : 'diaryEntries']
          );
          
          const data = rows.length > 0 ? safeParseJSON(rows[0].content, []) : [];
          
          actionResult = {
            success: true,
            data: text ? { todos: data } : { entries: data },
            action: 'query'
          };
        } else if (action === 'update' && todoId) {
          // 🧹 清理所有输入参数
          const cleanedText = cleanInput(text);
          const cleanedDate = cleanInput(date);
          const cleanedTime = cleanInput(time);
          
          // 更新操作也解析日期和时间
          let updateDate = cleanedDate;
          let updateTime = cleanedTime;
          
          if (cleanedDate && typeof cleanedDate === 'string') {
            const parsed = parseNaturalLanguageTime(cleanedDate);
            if (parsed.date) updateDate = parsed.date;
            if (parsed.time && !cleanedTime) updateTime = parsed.time;
          }
          
          if (cleanedTime && typeof cleanedTime === 'string') {
            const parsed = parseNaturalLanguageTime(cleanedTime);
            if (parsed.time) updateTime = parsed.time;
            if (parsed.date && !cleanedDate) updateDate = parsed.date;
          }
          
          const [rows] = await connection.query(
            'SELECT content FROM user_data WHERE user_id = ? AND data_type = ?',
            [userId, 'todos']
          );
          
          let todos = rows.length > 0 ? safeParseJSON(rows[0].content, []) : [];
          const index = todos.findIndex(t => t.id === todoId);
          
          if (index !== -1) {
            if (cleanedText !== undefined) todos[index].text = cleanedText;
            if (updateDate !== undefined) todos[index].date = updateDate;
            if (updateTime !== undefined) todos[index].time = updateTime;
            todos[index].updatedAt = Date.now();
            
            await connection.query(
              'INSERT INTO user_data (user_id, data_type, content) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE content = ?',
              [userId, 'todos', JSON.stringify(todos), JSON.stringify(todos)]
            );
          }
          
          actionResult = {
            success: true,
            data: { id: todoId, text: cleanedText, date: updateDate, time: updateTime },
            action: 'update'
          };
        } else if (action === 'delete' && todoId) {
          const [rows] = await connection.query(
            'SELECT content FROM user_data WHERE user_id = ? AND data_type = ?',
            [userId, 'todos']
          );
          
          let todos = rows.length > 0 ? safeParseJSON(rows[0].content, []) : [];
          todos = todos.filter(t => t.id !== todoId);
          
          await connection.query(
            'INSERT INTO user_data (user_id, data_type, content) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE content = ?',
            [userId, 'todos', JSON.stringify(todos), JSON.stringify(todos)]
          );
          
          actionResult = {
            success: true,
            data: { id: todoId, message: '日程已删除' },
            action: 'delete'
          };
        } else if (action === 'updatePreferences' && preferences) {
          // 🧹 清理用户偏好输入
          const cleanedPreferences = {};
          for (const key in preferences) {
            if (preferences[key] !== undefined && preferences[key] !== null) {
              cleanedPreferences[key] = cleanInput(preferences[key]);
            }
          }
          
          // 获取现有偏好
          const [rows] = await connection.query(
            'SELECT content FROM user_data WHERE user_id = ? AND data_type = ?',
            [userId, 'userPreferences']
          );
          
          let existingPreferences = {};
          if (rows.length > 0 && rows[0].content) {
            existingPreferences = safeParseJSON(rows[0].content, {});
          }
          
          // 合并新偏好
          const updatedPreferences = { ...existingPreferences, ...cleanedPreferences };
          
          // 保存到数据库
          await connection.query(
            'INSERT INTO user_data (user_id, data_type, content) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE content = ?',
            [userId, 'userPreferences', JSON.stringify(updatedPreferences), JSON.stringify(updatedPreferences)]
          );
          
          logInfo('用户偏好', `已更新: ${JSON.stringify(updatedPreferences)}`);
          
          actionResult = {
            success: true,
            data: updatedPreferences,
            action: 'updatePreferences'
          };
        } else if (action === 'queryPreferences') {
          // 查询用户偏好
          const [rows] = await connection.query(
            'SELECT content FROM user_data WHERE user_id = ? AND data_type = ?',
            [userId, 'userPreferences']
          );
          
          const data = rows.length > 0 ? safeParseJSON(rows[0].content, {}) : {};
          
          actionResult = {
            success: true,
            data: data,
            action: 'queryPreferences'
          };
        }
      }

      // ============== 不管有没有 action，都要保存完整数据 ==============
      console.log('[DEBUG] 开始保存完整数据...');
      
      if (reqTodos !== undefined) {
        console.log('[DEBUG] 保存 reqTodos:', reqTodos.length, '条');
        await connection.query(
          'INSERT INTO user_data (user_id, data_type, content) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE content = ?',
          [userId, 'todos', JSON.stringify(reqTodos), JSON.stringify(reqTodos)]
        );
      }

      if (reqDiaryEntries !== undefined) {
        console.log('[DEBUG] 保存 reqDiaryEntries:', reqDiaryEntries.length, '条');
        await connection.query(
          'INSERT INTO user_data (user_id, data_type, content) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE content = ?',
          [userId, 'diaryEntries', JSON.stringify(reqDiaryEntries), JSON.stringify(reqDiaryEntries)]
        );
      }

      if (repeatTasks !== undefined) {
        console.log('[DEBUG] 保存 repeatTasks:', repeatTasks.length, '条');
        await connection.query(
          'INSERT INTO user_data (user_id, data_type, content) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE content = ?',
          [userId, 'repeatTasks', JSON.stringify(repeatTasks), JSON.stringify(repeatTasks)]
        );
      }

      if (completedTasks !== undefined) {
        console.log('[DEBUG] 保存 completedTasks:', completedTasks.length, '条');
        await connection.query(
          'INSERT INTO user_data (user_id, data_type, content) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE content = ?',
          [userId, 'completedTasks', JSON.stringify(completedTasks), JSON.stringify(completedTasks)]
        );
      }

      if (courseSchedule !== undefined) {
        console.log('[DEBUG] 保存 courseSchedule');
        await connection.query(
          'INSERT INTO user_data (user_id, data_type, content) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE content = ?',
          [userId, 'courseSchedule', JSON.stringify(courseSchedule), JSON.stringify(courseSchedule)]
        );
      }

      // 保存用户偏好
      if (preferences !== undefined) {
        console.log('[DEBUG] 保存 userPreferences');
        await connection.query(
          'INSERT INTO user_data (user_id, data_type, content) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE content = ?',
          [userId, 'userPreferences', JSON.stringify(preferences), JSON.stringify(preferences)]
        );
      }

      // ============== 返回结果 ==============
      if (actionResult) {
        console.log('[DEBUG] 返回 action 结果');
        res.json(actionResult);
      } else {
        console.log('[DEBUG] 返回完整数据保存结果');
        res.json({
          success: true,
          message: 'Data saved successfully'
        });
      }
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Save data error:', error);
    res.status(500).json({ success: false, error: error.message });
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
        'SELECT crow_stats, chat_messages, ai_reminder, food_count, last_updated FROM crow_data WHERE user_id = ?',
        [userId]
      );

      const data = { 
        todos: [], 
        diaryEntries: [], 
        repeatTasks: [], 
        completedTasks: [], 
        courseSchedule: null,
        userPreferences: {}
      };

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
        } else if (row.data_type === 'userPreferences') {
          data.userPreferences = safeParseJSON(row.content, {});
        }
      });

      if (crowRows.length > 0) {
        const rawCrowStats = safeParseJSON(crowRows[0].crow_stats, { hunger: 100, mood: 90 });
        const lastUpdated = crowRows[0].last_updated;
        // 根据时间衰减计算当前实际值
        data.crowStats = calculateCrowDecay(rawCrowStats, lastUpdated);
        data.crowLastUpdated = lastUpdated ? new Date(lastUpdated).toISOString() : null;
        data.chatMessages = safeParseJSON(crowRows[0].chat_messages, []);
        data.aiReminder = crowRows[0].ai_reminder || '';
        data.foodCount = crowRows[0].food_count || 0;
      } else {
        data.crowStats = { hunger: 100, mood: 90 };
        data.crowLastUpdated = null;
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
  // ============== 认证逻辑（新版） ==============
  const xApiKey = req.headers['x-api-key'] || req.headers['X-API-KEY'] || req.query['x-api-key'] || req.query['api_key'];
  const configApiKey = process.env.X_API_KEY;
  let userId = null;
  
  // 1. 优先检查X-API-KEY
  if (configApiKey && xApiKey && xApiKey === configApiKey) {
    userId = 3;  // 默认用户ID
    console.log('[认证] ✅ X-API-KEY验证成功（save-crow-data），用户ID:', userId);
  } else {
    // 2. 没有X-API-KEY，尝试token
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      try {
        const decoded = jwt.verify(token, SECRET_KEY);
        userId = decoded.id;
        console.log('[认证] ✅ 从Header JWT验证成功（save-crow-data），用户ID:', userId);
      } catch (error) {
        console.log('[ERROR] token 验证失败:', error.message);
      }
    }
  }
  
  if (!userId) {
    return res.status(401).json({ success: false, error: 'unauthorized' });
  }
  
  const { crowStats, chatMessages, aiReminder, foodCount, userPreferences } = req.body;

  try {
    const connection = await pool.getConnection();

    try {
      // 保存 crow 数据（含 last_updated，用于衰减计算）
      await connection.query(
        `INSERT INTO crow_data (user_id, crow_stats, chat_messages, ai_reminder, food_count, last_updated)
         VALUES (?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE
         crow_stats = VALUES(crow_stats),
         chat_messages = VALUES(chat_messages),
         ai_reminder = VALUES(ai_reminder),
         food_count = VALUES(food_count),
         last_updated = NOW()`,
        [userId, JSON.stringify(crowStats), JSON.stringify(chatMessages || []), aiReminder || '', foodCount || 0]
      );

      // 保存用户偏好
      if (userPreferences !== undefined) {
        await connection.query(
          `INSERT INTO user_data (user_id, data_type, content)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE content = ?`,
          [userId, 'userPreferences', JSON.stringify(userPreferences), JSON.stringify(userPreferences)]
        );
        logInfo('用户偏好', '已保存到数据库');
      }

      // 检查是否是清除聊天记录的操作（消息数量小于等于1且只有欢迎消息）
      const isClearingChat = chatMessages && Array.isArray(chatMessages) && 
        (chatMessages.length <= 1) && 
        (chatMessages.length === 0 || 
         (chatMessages.length === 1 && chatMessages[0]?.text && chatMessages[0].text.includes('嘎！我是你的拾鸦助手')));

      if (isClearingChat) {
        // 清除 conversation_id
        await connection.query(
          'DELETE FROM user_data WHERE user_id = ? AND data_type = ?',
          [userId, 'conversation_id']
        );
        logInfo('对话上下文', '已清除 conversation_id（用户清除聊天记录）');
      }

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

// ==================== 模板变量替换函数 ====================
function replaceTemplateVariables(text, contextData) {
  if (!text) return text;
  
  let result = text;
  
  // 替换 crowStats 相关变量
  if (contextData.crowStats) {
    result = result.replace(/\{\{crowStats\.hunger\}\}/g, contextData.crowStats.hunger || 100);
    result = result.replace(/\{\{crowStats\.mood\}\}/g, contextData.crowStats.mood || 90);
  }
  
  // 替换 todos 相关变量
  if (contextData.todos && contextData.todos.length > 0) {
    result = result.replace(/\{\{todos\.length\}\}/g, contextData.todos.length);
    result = result.replace(/\{\{todos\.count\}\}/g, contextData.todos.length);
  } else {
    result = result.replace(/\{\{todos\.length\}\}/g, '0');
    result = result.replace(/\{\{todos\.count\}\}/g, '0');
  }
  
  // 替换 diaryEntries 相关变量
  if (contextData.diaryEntries && contextData.diaryEntries.length > 0) {
    result = result.replace(/\{\{diaryEntries\.length\}\}/g, contextData.diaryEntries.length);
    result = result.replace(/\{\{diaryEntries\.count\}\}/g, contextData.diaryEntries.length);
  } else {
    result = result.replace(/\{\{diaryEntries\.length\}\}/g, '0');
    result = result.replace(/\{\{diaryEntries\.count\}\}/g, '0');
  }
  
  return result;
}

// ==================== 最简单直接：只处理 <think> 标签 ====================
function extractThinkAndReply(text) {
  if (!text) return { thinkContent: '', replyContent: '' };
  
  console.log('[🔍 extractThinkAndReply 收到原始 text =', text);
  
  let thinkContent = '';
  let replyContent = '';
  
  // 🔴 找所有的 <think>...</think>
  const thinkRegex = /<think>([\s\S]*?)<\/think>/gi;
  let lastIndex = 0;
  let match;
  
  while ((match = thinkRegex.exec(text)) !== null) {
    // 把 <think> 之前到上一个位置之间的内容加到 replyContent
    const between = text.substring(lastIndex, match.index);
    if (between.trim()) {
      replyContent += between;
    }
    
    // 把 <think> 里面的内容加到 thinkContent
    if (match[1]) {
      thinkContent += match[1] + '\n';
    }
    
    lastIndex = match.index + match[0].length;
  }
  
  // 把最后一个 </think> 之后的内容加到 replyContent
  const remaining = text.substring(lastIndex);
  if (remaining.trim()) {
    replyContent += remaining;
  }
  
  // 🔴 清理所有标签残留
  replyContent = replyContent.replace(/<think>/gi, '');
  replyContent = replyContent.replace(/<\/think>/gi, '');
  replyContent = replyContent.replace(/&lt;think&gt;/gi, '');
  replyContent = replyContent.replace(/&lt;\/think&gt;/gi, '');
  replyContent = replyContent.replace(/\n\s*\n\s*\n/g, '\n\n');
  replyContent = replyContent.replace(/\n\s*\n/g, '\n');
  replyContent = replyContent.trim();
  
  thinkContent = thinkContent.replace(/<think>/gi, '');
  thinkContent = thinkContent.replace(/<\/think>/gi, '');
  thinkContent = thinkContent.replace(/&lt;think&gt;/gi, '');
  thinkContent = thinkContent.replace(/&lt;\/think&gt;/gi, '');
  thinkContent = thinkContent.replace(/\n\s*\n\s*\n/g, '\n\n');
  thinkContent = thinkContent.replace(/\n\s*\n/g, '\n');
  thinkContent = thinkContent.trim();
  
  console.log('[✅ 分离完成]');
  console.log('  thinkContent =', thinkContent);
  console.log('  replyContent =', replyContent);
  
  return { thinkContent, replyContent };
}

// ==================== 判断是不是思考语气 ====================
function isThinkingText(text) {
  if (!text) return false;
  const lowerText = text.toLowerCase();
  const thinkKeywords = [
    '我需要', '我要', '让我', '首先', '接下来', '然后', '现在',
    '分析', '思考', '考虑', '理解', '处理', '判断', '决定',
    '需要', '应该', '可能', '或许', '看看', '检查一下',
    '用户说', '用户想', '用户要', '请求是', '目标是', '意图是',
    'i need', 'i should', 'i will', 'i am', 'let me', 'first',
    'thinking', 'thought', 'consider', 'analyze', 'understand'
  ];
  for (const kw of thinkKeywords) {
    if (lowerText.includes(kw)) {
      return true;
    }
  }
  return false;
}

// ==================== 超级彻底的 <think> 标签过滤（旧版兼容） ====================
function removeThinkTags(text) {
  if (!text) return '';
  const { replyContent } = extractThinkAndReply(text);
  return replyContent;
}

// ==================== 流式标签缓冲处理器 ====================
class ThinkTagStreamHandler {
  constructor() {
    this.buffer = '';
    this.inThink = false; // 当前是否在 <think> 标签里面
    this.thinkContent = '';
  }
  
  // 处理流式收到的新内容
  processChunk(chunk) {
    console.log('[🧠 ThinkTagStreamHandler] 收到新 chunk =', chunk);
    this.buffer += chunk;
    
    const result = {
      thinkToSend: '',
      replyToSend: ''
    };
    
    while (true) {
      if (!this.inThink) {
        // 当前不在 think 标签里，找下一个 <think 开头的标签
        const thinkStartMatch = this.buffer.match(/<think[^>]*>/);
        if (thinkStartMatch) {
          const thinkStartIndex = thinkStartMatch.index;
          const thinkTag = thinkStartMatch[0];
          
          // 找到了 think 标签，把前面的内容都加到 reply
          const beforeThink = this.buffer.substring(0, thinkStartIndex);
          if (beforeThink.trim()) {
            result.replyToSend += beforeThink;
          }
          
          // 跳到 think 标签之后
          this.buffer = this.buffer.substring(thinkStartIndex + thinkTag.length);
          this.inThink = true;
          console.log('[🧠 ThinkTagStreamHandler] 进入 think 模式，标签=', thinkTag);
        } else {
          // 没找到 think 标签，检查有没有可能是部分标签，先保留在 buffer 里
          break;
        }
      } else {
        // 当前在 think 标签里，找 </think 开头的结束标签
        const thinkEndMatch = this.buffer.match(/<\/think[^>]*>/);
        if (thinkEndMatch) {
          const thinkEndIndex = thinkEndMatch.index;
          const thinkEndTag = thinkEndMatch[0];
          
          // 找到了 think 结束标签，把前面的内容都加到 think
          const insideThink = this.buffer.substring(0, thinkEndIndex);
          if (insideThink.trim()) {
            result.thinkToSend += insideThink;
            this.thinkContent += insideThink;
          }
          
          // 跳到 think 结束标签之后
          this.buffer = this.buffer.substring(thinkEndIndex + thinkEndTag.length);
          this.inThink = false;
          console.log('[🧠 ThinkTagStreamHandler] 退出 think 模式，标签=', thinkEndTag);
        } else {
          // 没找到 think 结束标签，先保留 buffer
          break;
        }
      }
    }
    
    // 如果不在 think 模式里，且 buffer 里有内容（非标签相关），也加到 reply
    if (!this.inThink && this.buffer.trim()) {
      // 检查 buffer 里是不是只是部分标签（比如 "<thi" 这种），如果不是才加到 reply
      if (!this.buffer.startsWith('<') || this.buffer.length > 30) {
        // 要么不以 < 开头，要么以 < 开头但长度超过 30（不是标签）
        result.replyToSend += this.buffer;
        this.buffer = '';
      }
    }
    
    console.log('[🧠 ThinkTagStreamHandler] 处理结果:');
    console.log('  thinkToSend =', result.thinkToSend);
    console.log('  replyToSend =', result.replyToSend);
    
    return result;
  }
  
  // 所有数据都处理完了，把 buffer 里剩余的内容处理掉
  flush() {
    const result = {
      thinkToSend: '',
      replyToSend: ''
    };
    
    if (this.inThink) {
      // 如果还在 think 标签里，把剩余 buffer 都加到 think
      result.thinkToSend += this.buffer;
      this.thinkContent += this.buffer;
    } else {
      // 不在 think 标签里，把剩余 buffer 都加到 reply
      result.replyToSend += this.buffer;
    }
    
    this.buffer = '';
    return result;
  }
}

// ==================== Dify Agent API调用函数 ====================
async function callDifyAgent(messages, userContext, sseRes = null) {
  logSection('🚀 Dify Agent开始处理请求');
  
  const apiKey = process.env.DIFY_API_KEY; // Dify Agent API密钥
  const difyApiUrl = process.env.DIFY_API_URL || 'https://api.dify.ai/v1/chat-messages';

  logInfo('配置', `Dify API Key: ${apiKey ? '已配置' : '未配置'}`);
  logObject('用户上下文', userContext);
  logObject('用户消息', messages);

  if (!apiKey) {
    console.error('[错误] Dify API密钥未配置');
    throw new Error('Dify API key not configured');
  }

  // 提取最后一条消息的内容，确保是字符串
  let query = '';
  if (messages && messages.length > 0) {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.content) {
      if (typeof lastMessage.content === 'string') {
        query = lastMessage.content;
      } else if (Array.isArray(lastMessage.content)) {
        // 如果是数组，提取文本内容
        const textContent = lastMessage.content.find(item => item.type === 'text');
        query = textContent?.text || '';
      }
    }
  }

  // 从数据库获取用户的 conversation_id
  let conversationId = null;
  if (userContext.userId) {
    try {
      const connection = await pool.getConnection();
      try {
        const [rows] = await connection.query(
          'SELECT content FROM user_data WHERE user_id = ? AND data_type = ?',
          [userContext.userId, 'conversation_id']
        );
        if (rows.length > 0 && rows[0].content) {
          conversationId = rows[0].content;
          logInfo('对话上下文', `找到已有 conversation_id: ${conversationId}`);
        }
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('[错误] 获取 conversation_id 失败:', error);
    }
  }

  // 使用自然语言时间解析
  const parsedTime = parseNaturalLanguageTime(query);
  
  // 🧠 保存解析好的时间到缓存，供后面save-data使用
  if (userContext.userId) {
    parsedTimeCache.set(userContext.userId, {
      date: parsedTime.date,
      time: parsedTime.time,
      text: query, // 保存原始查询文本
      timestamp: Date.now()
    });
    console.log('[缓存] ✅ 已保存解析好的时间到缓存 userId:', userContext.userId, parsedTime);
  }
  
  // 准备用户上下文数据
  const contextData = {
    todos: userContext.todos.slice(-10),
    diaryEntries: userContext.diaryEntries.slice(-3),
    crowStats: userContext.crowStats,
    userId: userContext.userId,
    token: userContext.token,
    // 添加用户偏好
    userPreferences: userContext.userPreferences || {},
    // 添加自然语言解析的时间信息
    parsedDate: parsedTime.date,
    parsedTime: parsedTime.time,
    hasParsedTime: !!parsedTime.date || !!parsedTime.time
  };
  
  // DEBUG: 追踪 token 传递
  console.log('[DEBUG] userContext.token:', userContext.token ? '已提供' : '未提供');
  console.log('[DEBUG] contextData.token:', contextData.token ? '已提供' : '未提供');
  
  // DEBUG: 输出自然语言时间解析结果
  console.log('[DEBUG] 自然语言时间解析:');
  console.log('[DEBUG] 原始输入:', query);
  console.log('[DEBUG] parsedDate:', parsedTime.date);
  console.log('[DEBUG] parsedTime:', parsedTime.time);
  console.log('[DEBUG] hasParsedTime:', contextData.hasParsedTime);

  // 过滤Dify自动生成的continue消息，防止无限循环
  if (query.trim().toLowerCase() === 'continue') {
    console.warn('[警告] 收到Dify自动生成的continue消息，可能存在配置问题');
    throw new Error('Dify auto-generated continue message detected');
  }

  logInfo('请求', '正在调用Dify Agent API...');
  logInfo('Query', query);
  logInfo('API URL', difyApiUrl);
  
  // 构建请求体
  const requestBody = {
    inputs: contextData,
    query: query,
    user: userContext.userId?.toString() || 'anonymous',
    response_mode: 'streaming'
  };
  
  // 如果有 conversation_id，添加到请求中
  if (conversationId) {
    requestBody.conversation_id = conversationId;
    logInfo('对话上下文', `使用 conversation_id: ${conversationId}`);
  }
  
  console.log('[Dify请求体]', JSON.stringify(requestBody));
  
  const response = await fetch(difyApiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const responseText = await response.text();
    console.error('[错误] Dify API调用失败:', responseText);
    throw new Error('Dify API call failed');
  }

  logInfo('响应', 'Dify API返回成功');
  console.log('[Dify响应头]', JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2));
  
  // 处理流式响应
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalAnswer = '';
  let thinkingProcess = '';
  let isDone = false;
  let loopCount = 0;
  const MAX_LOOPS = 1000; // 安全限制，防止无限循环
  let thoughtStep = 0;
  let difyData = {}; // 存储Dify返回的完整数据
  let toolCalls = []; // 存储所有工具调用
  let currentToolCall = null; // 当前正在构建的工具调用
  
  // 🟢 让AI回复更快！缓冲一下再发！
  let replyBuffer = ''; // 内容缓冲
  let lastSendTime = 0; // 上次发送时间
  const REPLY_BUFFER_THRESHOLD = 15; // 凑够多少字符就发
  const REPLY_MIN_INTERVAL = 50; // 最少间隔多少ms发一次（毫秒
  
  // 🧠 专门处理流式 <think> 标签的处理器
  const thinkHandler = new ThinkTagStreamHandler();

  while (true) {
    const { done, value } = await reader.read();
    if (done || isDone || loopCount++ > MAX_LOOPS) break;
    
    const chunk = decoder.decode(value, { stream: true });
    buffer += chunk;
    
    // 🟢 标准 SSE 格式：用 \n\n 分隔事件块！
    const events = buffer.split('\n\n');
    buffer = events.pop() || ''; // 最后一个不完整的事件块保留在 buffer 里
    
    for (const event of events) {
      if (!event.trim()) continue;
      
      let eventType = '';
      let dataStr = '';
      const lines = event.split('\n');
      
      // 解析 event 和 data
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          eventType = line.substring('event: '.length).trim();
        } else if (line.startsWith('data: ')) {
          dataStr = line.substring('data: '.length);
        }
      }
      
      if (dataStr === '[DONE]') {
        isDone = true;
        continue;
      }
      
      try {
        const data = JSON.parse(dataStr);
        
        // 完整打印 Dify 原始事件，便于调试！！
        console.log('[Dify 完整原始事件]', JSON.stringify(data, null, 2));
        
        // 保存Dify返回的所有数据
        difyData = { ...difyData, ...data };
        
        // 处理不同类型的事件 - 支持多种Dify响应格式
        if (data.event === 'agent_thought') {
          // Agent思考步骤事件
          let thought = data.thought || '';
          
          // 过滤 &lt;think&gt; 标签（后面的 cleanThinkTags 函数处理）
          thought = thought.replace(/<think>[\s\S]*?<\/think>/gi, '');
          thought = thought.replace(/<think>/gi, '');
          thought = thought.replace(/<\/think>/gi, '');
          
          if (!thought.trim()) {
            // 如果过滤后是空的，就跳过
            continue;
          }
          
          // 使用用户上下文数据替换模板变量
          const processedThought = replaceTemplateVariables(thought, contextData);
          thinkingProcess += processedThought;
          
          // 实时发送思考事件给前端，让思考组件一段一段显示！
          if (sseRes && processedThought.trim()) {
            // 自动分段：按句子（。！？）或者换行符切分，让思考更清晰！
            const segments = processedThought
              .split(/[。！？\n]+/)
              .map(s => s.trim())
              .filter(s => s.length > 0);
            
            for (const segment of segments) {
              thoughtStep++;
              console.log('[发送思考事件] 第', thoughtStep, '步:', segment);
              await sendSSEvent(sseRes, 'thinking', {
                step: thoughtStep,
                text: segment,
                icon: '🧠'
              });
            }
          }
          
          // 提取工具信息并收集到 toolCalls
          if (data.tool && data.tool_input) {
            console.log('[agent_thought 新工具调用]', data.tool, data.tool_input);
            // 开始一个新的工具调用
            currentToolCall = {
              tool: data.tool,
              params: data.tool_input,
              thought: processedThought
            };
          } else if (data.tool) {
            // 只有工具名
            if (currentToolCall) {
              currentToolCall.tool = data.tool;
            } else {
              currentToolCall = {
                tool: data.tool,
                params: {},
                thought: processedThought
              };
            }
          } else if (data.tool_input) {
            // 只有参数
            if (currentToolCall) {
              currentToolCall.params = data.tool_input;
            }
          }
        } else if (data.event === 'agent_message') {
          // Agent模式下的消息事件！
          console.log('[🔴🔴 收到 agent_message 事件]');
          console.log('  data.answer =', data.answer);
          
          if (data.answer) {
            let content = data.answer;
            
            // 🧠 使用流式标签处理器处理内容
            const streamResult = thinkHandler.processChunk(content);
            
            // 先处理 thinkToSend
            if (sseRes && streamResult.thinkToSend.trim()) {
              const segments = streamResult.thinkToSend
                .split(/[。！？\n]+/)
                .map(s => s.trim())
                .filter(s => s.length > 0);
              for (const segment of segments) {
                thoughtStep++;
                console.log('[🚀 发送 thinking 事件] 第', thoughtStep, '步:', segment);
                await sendSSEvent(sseRes, 'thinking', {
                  step: thoughtStep,
                  text: segment,
                  icon: '🧠'
                });
              }
              thinkingProcess += streamResult.thinkToSend;
            }
            
            // 再处理 replyToSend
            if (streamResult.replyToSend.trim()) {
              finalAnswer += streamResult.replyToSend;
              if (sseRes) {
                replyBuffer += streamResult.replyToSend;
                const now = Date.now();
                if (replyBuffer.length >= REPLY_BUFFER_THRESHOLD || now - lastSendTime >= REPLY_MIN_INTERVAL) {
                  console.log('[🚀 发送 reply 事件] content =', replyBuffer);
                  await sendSSEvent(sseRes, 'reply', {
                    content: replyBuffer
                  });
                  replyBuffer = '';
                  lastSendTime = now;
                }
              }
            }
          }
        } else if (data.event === 'tool_execution') {
          // 工具执行事件 - 这里收集完整工具调用
          console.log('[tool_execution 事件]', data);
          if (data.tool_name && data.tool_input) {
            console.log('[tool_execution 工具调用]', data.tool_name, data.tool_input);
            
            // 优先使用 tool_execution 里的信息
            // 检查是否已经添加过
            const alreadyAdded = toolCalls.some(tc => 
              tc.tool === data.tool_name && 
              JSON.stringify(tc.params) === JSON.stringify(data.tool_input)
            );
            if (!alreadyAdded) {
              toolCalls.push({
                tool: data.tool_name,
                params: data.tool_input,
                toolResult: data.tool_output || null
              });
            }
            // 重置当前工具调用
            currentToolCall = null;
          }
        } else if (data.event === 'message') {
          // LLM返回文本块事件！
          console.log('[🔴🔴 收到 message 事件]');
          console.log('  data.answer =', data.answer);
          
          if (data.answer) {
            let content = data.answer;
            
            // 🧠 使用流式标签处理器处理内容
            const streamResult = thinkHandler.processChunk(content);
            
            // 先处理 thinkToSend
            if (sseRes && streamResult.thinkToSend.trim()) {
              const segments = streamResult.thinkToSend
                .split(/[。！？\n]+/)
                .map(s => s.trim())
                .filter(s => s.length > 0);
              for (const segment of segments) {
                thoughtStep++;
                console.log('[🚀 发送 thinking 事件] 第', thoughtStep, '步:', segment);
                await sendSSEvent(sseRes, 'thinking', {
                  step: thoughtStep,
                  text: segment,
                  icon: '🧠'
                });
              }
              thinkingProcess += streamResult.thinkToSend;
            }
            
            // 再处理 replyToSend
            if (streamResult.replyToSend.trim()) {
              finalAnswer += streamResult.replyToSend;
              if (sseRes) {
                replyBuffer += streamResult.replyToSend;
                const now = Date.now();
                if (replyBuffer.length >= REPLY_BUFFER_THRESHOLD || now - lastSendTime >= REPLY_MIN_INTERVAL) {
                  console.log('[🚀 发送 reply 事件] content =', replyBuffer);
                  await sendSSEvent(sseRes, 'reply', {
                    content: replyBuffer
                  });
                  replyBuffer = '';
                  lastSendTime = now;
                }
              }
            }
          }
        } else if (data.event === 'message_end') {
          // 消息结束事件 - Dify文档说明这是流式返回结束的标志
          isDone = true;
          
          // 🧠 先处理流式标签处理器里剩余的内容
          const finalResult = thinkHandler.flush();
          
          // 处理剩余的 thinkToSend
          if (sseRes && finalResult.thinkToSend.trim()) {
            const segments = finalResult.thinkToSend
              .split(/[。！？\n]+/)
              .map(s => s.trim())
              .filter(s => s.length > 0);
            for (const segment of segments) {
              thoughtStep++;
              console.log('[🚀 发送 thinking 事件] 第', thoughtStep, '步:', segment);
              await sendSSEvent(sseRes, 'thinking', {
                step: thoughtStep,
                text: segment,
                icon: '🧠'
              });
            }
            thinkingProcess += finalResult.thinkToSend;
          }
          
          // 处理剩余的 replyToSend
          if (finalResult.replyToSend.trim()) {
            replyBuffer += finalResult.replyToSend;
            finalAnswer += finalResult.replyToSend;
          }
          
          // 🟢 把剩余 replyBuffer 发完！
          if (sseRes && replyBuffer.length > 0) {
            console.log('[🚀 发送 final reply 事件] content =', replyBuffer);
            await sendSSEvent(sseRes, 'reply', {
              content: replyBuffer
            });
            replyBuffer = '';
          }
          // 提取元数据
          if (data.metadata) {
            difyData.metadata = data.metadata;
          }
          // 如果还有未添加的 currentToolCall，也加到 toolCalls 里去
          if (currentToolCall && currentToolCall.tool && Object.keys(currentToolCall.params).length > 0) {
            // 检查是否已经添加过
            const alreadyAdded = toolCalls.some(tc => 
              tc.tool === currentToolCall.tool && 
              JSON.stringify(tc.params) === JSON.stringify(currentToolCall.params)
            );
            if (!alreadyAdded) {
              console.log('[message_end 添加遗漏的工具调用]', currentToolCall.tool, currentToolCall.params);
              toolCalls.push({
                tool: currentToolCall.tool,
                params: currentToolCall.params,
                toolResult: null
              });
            }
          }
        } else if (data.type === 'content' && data.content) {
          // 流式内容块 - 先过滤 &lt;think&gt;！
          let content = data.content;
          content = content.replace(/<think>[\s\S]*?<\/think>/gi, '');
          content = content.replace(/<think>/gi, '');
          content = content.replace(/<\/think>/gi, '');
          if (content.trim()) {
            finalAnswer += content;
          }
        } else if (data.choices && data.choices.length > 0) {
          // Dify返回的choices格式响应
          const message = data.choices[0]?.message;
          if (message?.content) {
            let content = message.content;
            content = content.replace(/<think>[\s\S]*?<\/think>/gi, '');
            content = content.replace(/<think>/gi, '');
            content = content.replace(/<\/think>/gi, '');
            if (content.trim()) {
              finalAnswer = content;
            }
          }
          
          // 提取Dify特定的元数据
          if (data.dify) {
            difyData.intent = data.dify.intent || difyData.intent;
            difyData.task = data.dify.task || difyData.task;
            difyData.tool = data.dify.tool || difyData.tool;
            difyData.params = data.dify.params || difyData.params;
            difyData.thinking_process = data.dify.thinkingProcess || data.dify.thinking_process || difyData.thinking_process;
            difyData.response = data.dify.response || difyData.response;
          }
          
          // 从toolResult中提取信息
          if (data.toolResult) {
            difyData.toolResult = data.toolResult;
          }
        } else if (data.content) {
          // 直接内容字段
          finalAnswer = data.content;
        }
        
        // 调试：打印所有收到的事件
        console.log('[Dify事件]', data.event || data.type || 'unknown', JSON.stringify(data).substring(0, 300));
        
      } catch (e) {
        console.error('[错误] 解析流式响应失败:', e);
      }
    }
  }
  
  // === ✅ 🔧 彻底过滤 &lt;think&gt; 标签，完全清理！
  const cleanThinkTags = (text) => {
    if (!text) return text;
    let result = text;
    // 1. 移除完整的 &lt;think&gt;...&lt;/think&gt; 标签块
    result = result.replace(/<think>[\s\S]*?<\/think>/gi, '');
    // 2. 移除单独的 &lt;think&gt; 开始标签
    result = result.replace(/<think>/gi, '');
    // 3. 移除单独的 &lt;/think&gt; 结束标签
    result = result.replace(/<\/think>/gi, '');
    // 4. 清理多余的空行和空白
    result = result.replace(/\n\s*\n/g, '\n'); // 空行
    result = result.trim(); // 首尾空白
    return result;
  };
  
  // 构建Dify结果格式
  console.log('[调试] finalAnswer:', finalAnswer);
  console.log('[调试] difyData:', JSON.stringify(difyData));
  console.log('[调试] thinkingProcess:', thinkingProcess);
  console.log('[调试] 收集到的工具调用数:', toolCalls.length);
  console.log('[调试] 工具调用详情:', JSON.stringify(toolCalls));
  
  // 工具名称规范化映射
  const normalizeToolName = (toolName) => {
    if (!toolName) return 'CHAT_ASSISTANT';
    const toolMap = {
      'schedulemanager': 'SCHEDULE_MANAGER',
      'scheduleManager': 'SCHEDULE_MANAGER',
      'ScheduleManager': 'SCHEDULE_MANAGER',
      'schedule_manager': 'SCHEDULE_MANAGER',
      'diarymanager': 'DIARY_MANAGER',
      'diaryManager': 'DIARY_MANAGER',
      'DiaryManager': 'DIARY_MANAGER',
      'diary_manager': 'DIARY_MANAGER',
      'courseanalyzer': 'COURSE_ANALYZER',
      'courseAnalyzer': 'COURSE_ANALYZER',
      'CourseAnalyzer': 'COURSE_ANALYZER',
      'course_analyzer': 'COURSE_ANALYZER',
      'remindergenerator': 'REMINDER_GENERATOR',
      'reminderGenerator': 'REMINDER_GENERATOR',
      'ReminderGenerator': 'REMINDER_GENERATOR',
      'reminder_generator': 'REMINDER_GENERATOR',
      'chatassistant': 'CHAT_ASSISTANT',
      'chatAssistant': 'CHAT_ASSISTANT',
      'ChatAssistant': 'CHAT_ASSISTANT',
      'chat_assistant': 'CHAT_ASSISTANT'
    };
    const normalized = toolMap[toolName] || toolName;
    console.log('[工具名称映射]', toolName, '->', normalized);
    return normalized;
  };
  
  const rawResponse = finalAnswer || (difyData.response || difyData.content || '嘎！我收到你的请求了，正在处理中...');
  const rawThinkingProcess = thinkingProcess || (difyData.thinking_process || difyData.thought) || '正在分析你的请求...';
  
  // 先彻底过滤掉所有 &lt;think&gt; 标签！
  const cleanedRawResponse = cleanThinkTags(rawResponse);
  const cleanedThinkingProcess = cleanThinkTags(rawThinkingProcess);
  
  // 规范化所有工具调用
  const normalizedToolCalls = toolCalls.map(tc => ({
    tool: normalizeToolName(tc.tool),
    params: tc.params,
    toolResult: tc.toolResult
  }));
  
  // 确定主工具调用（用最后一个）
  const mainToolCall = normalizedToolCalls.length > 0 
    ? normalizedToolCalls[normalizedToolCalls.length - 1]
    : { tool: normalizeToolName(difyData.tool), params: difyData.params || {} };
  
  // 构建Dify结果格式（使用清理后的内容！）
  console.log('[调试] 清理前的 finalAnswer:', rawResponse);
  console.log('[调试] 清理后的 finalAnswer:', cleanedRawResponse);
  
  // 对最终响应也进行模板变量替换
  let result = {
    intent: difyData.intent || 'CHAT',
    task: difyData.task || '日常对话',
    tool: mainToolCall.tool || 'CHAT_ASSISTANT',
    params: mainToolCall.params,
    allToolCalls: normalizedToolCalls, // 所有工具调用
    toolResult: difyData.toolResult,
    thinkingProcess: replaceTemplateVariables(cleanedThinkingProcess, contextData),
    response: replaceTemplateVariables(cleanedRawResponse, contextData),
    thoughtStep: thoughtStep
  };
  
  // === 🔧 关键修复：兼容 Dify 返回 tool=CHAT_ASSISTANT 但 params 是工具调用字符串的情况
  if (result.tool === 'CHAT_ASSISTANT' && result.params && typeof result.params === 'string') {
    console.log('[调试] 🔧 检测到 params 是字符串，尝试解析工具信息！');
    const paramsStr = result.params.trim();
    try {
      // 尝试解析 JSON
      const parsed = JSON.parse(paramsStr);
      
      // 检测是不是有工具调用的结构，比如 {"scheduleManager": { ... }}
      if (parsed && typeof parsed === 'object') {
        const keys = Object.keys(parsed);
        for (const key of keys) {
          const keyLower = key.toLowerCase();
          if (keyLower.includes('schedule')) {
            result.tool = 'SCHEDULE_MANAGER';
            result.params = parsed[key];
            console.log('[调试] ✅ 从 params 提取出 scheduleManager！');
            break;
          } else if (keyLower.includes('diary')) {
            result.tool = 'DIARY_MANAGER';
            result.params = parsed[key];
            console.log('[调试] ✅ 从 params 提取出 diaryManager！');
            break;
          } else if (keyLower.includes('course')) {
            result.tool = 'COURSE_ANALYZER';
            result.params = parsed[key];
            console.log('[调试] ✅ 从 params 提取出 courseAnalyzer！');
            break;
          }
        }
      }
    } catch (e) {
      console.log('[调试] 无法解析 params JSON，尝试其他方式');
    }
  }
  
  // === ✅ 再加修复：如果 toolResult 有值，再确认一下 tool（从 toolResult.action 反推）
  if (result.toolResult && result.toolResult.success && result.toolResult.action) {
    if (result.toolResult.data.date && result.toolResult.data.text) {
      result.tool = 'SCHEDULE_MANAGER';
      console.log('[调试] ✅ 从 toolResult 反推是 SCHEDULE_MANAGER！');
    } else if (result.toolResult.data.content) {
      result.tool = 'DIARY_MANAGER';
      console.log('[调试] ✅ 从 toolResult 反推是 DIARY_MANAGER！');
    }
  }
  
  // === ✅ 🔧 完美分离 &lt;think&gt; 标签！
  // 1. 从原始的 response 里分离 &lt;think&gt;
  console.log('[DEBUG] 原始完整响应:', rawResponse);
  
  const { thinkContent, replyContent } = extractThinkAndReply(rawResponse);
  
  console.log('[DEBUG] 分离出的思考内容:', thinkContent);
  console.log('[DEBUG] 分离出的回复内容:', replyContent);
  
  // 2. 设置结果
  result.thinkingProcess = thinkContent || '正在分析你的请求...';
  result.response = replaceTemplateVariables(replyContent, contextData);
  
  // 3. 把思考步骤单独存起来，方便前端显示
  const thinkStepsArr = thinkContent
    .split(/[。！？\n]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
  
  result.thinkSteps = thinkStepsArr;
  console.log('[DEBUG] 思考步骤数组:', thinkStepsArr);
  
  // 2. 对工具调用去重！
  if (result.allToolCalls && result.allToolCalls.length > 0) {
    console.log('[去重] 工具调用去重前数量:', result.allToolCalls.length);
    const uniqueToolCalls = [];
    const seen = new Set();
    
    for (const tc of result.allToolCalls) {
      const key = tc.tool + '|' + JSON.stringify(tc.params);
      if (!seen.has(key)) {
        seen.add(key);
        uniqueToolCalls.push(tc);
      }
    }
    
    result.allToolCalls = uniqueToolCalls;
    console.log('[去重] 工具调用去重后数量:', result.allToolCalls.length);
  }
  
  logObject('解析结果', result);
  logSection('✅ Dify Agent处理完成');

  // 保存从 Dify 返回的 conversation_id
  const newConversationId = difyData.conversation_id;
  if (newConversationId && userContext.userId) {
    try {
      const connection = await pool.getConnection();
      try {
        await connection.query(
          'INSERT INTO user_data (user_id, data_type, content) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE content = ?',
          [userContext.userId, 'conversation_id', newConversationId, newConversationId]
        );
        logInfo('对话上下文', `已保存 conversation_id: ${newConversationId}`);
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('[错误] 保存 conversation_id 失败:', error);
    }
  }
  
  return result;
}

// ==================== 各模型接口预留 ====================
async function callScheduleManager(params, userContext) {
  console.log('📅 Schedule Manager called with params:', params);
  
  const { action, text, time, date, todoId, todos, priority } = params;
  const userId = userContext.userId;
  
  // === 关键：智能融合解析策略 ===
  // 1. 先拿到缓存的原始解析结果（基于用户完整查询）
  let cachedResult = null;
  if (userId && parsedTimeCache.has(userId)) {
    cachedResult = parsedTimeCache.get(userId);
    console.log('[缓存] 拿到原始解析结果:', cachedResult);
  }
  
  // 2. 如果 Agent 传了 date/time，尝试解析一下 Agent 的理解
  let agentDate = null;
  let agentTime = null;
  
  if (date && typeof date === 'string' && date.trim()) {
    // Agent 传了日期，我们也解析一下
    const agentParsed = parseNaturalLanguageTime(date);
    if (agentParsed.date) {
      agentDate = agentParsed.date;
      console.log('[Agent] Agent 理解的日期:', agentDate);
    }
  }
  
  if (time && typeof time === 'string' && time.trim()) {
    // Agent 传了时间，我们也解析一下
    const agentParsed = parseNaturalLanguageTime(time);
    if (agentParsed.time) {
      agentTime = agentParsed.time;
      console.log('[Agent] Agent 理解的时间:', agentTime);
    }
  }
  
  // 3. 决策用哪个：优先用缓存（基于用户完整查询），其次用 Agent 解析过的
  let finalDate = (cachedResult && cachedResult.date) || agentDate;
  let finalTime = (cachedResult && cachedResult.time) || agentTime;
  let finalStartTime = null;
  let finalEndTime = null;
  
  // 检查是否有 startTime/endTime（支持范围）
  if (cachedResult && cachedResult.startTime) finalStartTime = cachedResult.startTime;
  if (cachedResult && cachedResult.endTime) finalEndTime = cachedResult.endTime;
  
  // 4. 如果都没有，尝试从 text 解析
  if (!finalDate && !finalTime && !finalStartTime && text) {
    const parsed = parseNaturalLanguageTime(text);
    if (parsed.date) finalDate = parsed.date;
    if (parsed.time) finalTime = parsed.time;
    if (parsed.startTime) finalStartTime = parsed.startTime;
    if (parsed.endTime) finalEndTime = parsed.endTime;
  }
  
  // 5. 确保有默认值
  if (!finalDate) {
    finalDate = getLocalDateString();
  }
  
  // 处理 startTime/endTime
  const isDateFormat = (str) => /^\d{4}-\d{2}-\d{2}$/.test(str);
  
  if (finalStartTime && finalEndTime) {
    // 已经有范围了，检查是否需要加日期
    if (!isDateFormat(finalStartTime)) {
      finalStartTime = `${finalDate} ${finalStartTime}`;
      finalEndTime = `${finalDate} ${finalEndTime}`;
    }
  } else if (finalDate && finalTime) {
    finalStartTime = `${finalDate} ${finalTime}`;
    finalEndTime = finalStartTime;
  } else if (finalDate) {
    finalStartTime = finalDate;
    finalEndTime = finalDate;
  }
  
  // 清理缓存
  if (userId && parsedTimeCache.has(userId)) {
    parsedTimeCache.delete(userId);
  }
  
  console.log('[调度] 最终使用的日期时间:', { finalDate, finalTime, finalStartTime, finalEndTime });
  console.log('[调度] 优先级参数:', priority);
  
  if (action === 'create') {
    // 处理优先级：兼容中文和英文
    let finalPriority = 'normal'; // 默认一般
    if (priority) {
      const p = priority.toLowerCase();
      if (p === 'urgent' || p === '紧急' || p === 'high' || p === '高') {
        finalPriority = 'urgent';
      } else if (p === 'normal' || p === '一般' || p === 'medium' || p === '中') {
        finalPriority = 'normal';
      }
    }
    console.log('[调度] 最终优先级:', finalPriority);
    
    const newTodo = {
      id: generateId({ text, date: finalDate, time: finalTime }, 'task'),
      text: text,
      date: finalDate,
      time: finalTime || '',
      completed: false,
      details: '',
      startTime: finalStartTime,
      endTime: finalEndTime,
      isRepeat: false,
      priority: finalPriority,
      updatedAt: Date.now()
    };
    
    if (userId) {
      const connection = await pool.getConnection();
      try {
        const [rows] = await connection.query(
          'SELECT content FROM user_data WHERE user_id = ? AND data_type = ?',
          [userId, 'todos']
        );
        
        let userTodos = [];
        if (rows.length > 0) {
          userTodos = safeParseJSON(rows[0].content, []);
        }
        
        userTodos.unshift(newTodo);
        
        await connection.query(
          'INSERT INTO user_data (user_id, data_type, content) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE content = ?',
          [userId, 'todos', JSON.stringify(userTodos), JSON.stringify(userTodos)]
        );
        
        console.log('[数据库] ✅ 日程已保存:', newTodo);
      } finally {
        connection.release();
      }
    }
    
    return { 
      success: true, 
      data: newTodo, 
      action: 'create' 
    };
  } else if (action === 'query') {
    return { 
      success: true, 
      data: { 
        todos: userContext.todos 
      }, 
      action: 'query' 
    };
  } else if (action === 'update' && todoId && userId) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.query(
        'SELECT content FROM user_data WHERE user_id = ? AND data_type = ?',
        [userId, 'todos']
      );
      
      let userTodos = rows.length > 0 ? safeParseJSON(rows[0].content, []) : [];
      const index = userTodos.findIndex(t => t.id === todoId);
      
      if (index !== -1) {
        if (text !== undefined) userTodos[index].text = text;
        if (finalDate !== undefined) userTodos[index].date = finalDate;
        if (finalTime !== undefined) userTodos[index].time = finalTime;
        userTodos[index].updatedAt = Date.now();
        
        await connection.query(
          'INSERT INTO user_data (user_id, data_type, content) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE content = ?',
          [userId, 'todos', JSON.stringify(userTodos), JSON.stringify(userTodos)]
        );
      }
    } finally {
      connection.release();
    }
    
    return { 
      success: true, 
      data: { id: todoId, text, date: finalDate, time: finalTime }, 
      action: 'update' 
    };
  } else if (action === 'delete' && todoId && userId) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.query(
        'SELECT content FROM user_data WHERE user_id = ? AND data_type = ?',
        [userId, 'todos']
      );
      
      let userTodos = rows.length > 0 ? safeParseJSON(rows[0].content, []) : [];
      userTodos = userTodos.filter(t => t.id !== todoId);
      
      await connection.query(
        'INSERT INTO user_data (user_id, data_type, content) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE content = ?',
        [userId, 'todos', JSON.stringify(userTodos), JSON.stringify(userTodos)]
      );
    } finally {
      connection.release();
    }
    
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
  console.log('📔 Diary Manager called with params:', params);
  
  const { action, content, date, imageUrl, images, tags } = params;
  const userId = userContext.userId;
  
  // === 关键：智能融合解析策略 ===
  // 1. 先拿到缓存的原始解析结果（基于用户完整查询）
  let cachedResult = null;
  if (userId && parsedTimeCache.has(userId)) {
    cachedResult = parsedTimeCache.get(userId);
    console.log('[缓存] 拿到原始解析结果:', cachedResult);
  }
  
  // 2. 如果 Agent 传了 date，尝试解析一下 Agent 的理解
  let agentDate = null;
  if (date && typeof date === 'string' && date.trim()) {
    const agentParsed = parseNaturalLanguageTime(date);
    if (agentParsed.date) {
      agentDate = agentParsed.date;
      console.log('[Agent] Agent 理解的日期:', agentDate);
    }
  }
  
  // 3. 决策用哪个：优先用缓存（基于用户完整查询），其次用 Agent 解析过的
  let finalDate = (cachedResult && cachedResult.date) || agentDate;
  
  // 4. 如果都没有，尝试从 content 解析
  if (!finalDate && content) {
    const parsed = parseNaturalLanguageTime(content);
    if (parsed.date) finalDate = parsed.date;
  }
  
  // 5. 确保有默认值
  if (!finalDate) {
    finalDate = getLocalDateString();
  }
  
  // 清理缓存
  if (userId && parsedTimeCache.has(userId)) {
    parsedTimeCache.delete(userId);
  }
  
  console.log('[调度] 最终使用的日期:', finalDate);
  
  if (action === 'create') {
    const now = Date.now();
    const diaryData = {
      id: generateId({ content, tags, images, date: finalDate }, 'diary'),
      date: finalDate,
      content: content,
      tags: tags || [],
      images: images || [],
      image: imageUrl || (images && images.length > 0 ? images[0] : null),
      updatedAt: now
    };
    
    if (userId) {
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
        
        entries.unshift(diaryData);
        
        await connection.query(
          'INSERT INTO user_data (user_id, data_type, content) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE content = ?',
          [userId, 'diaryEntries', JSON.stringify(entries), JSON.stringify(entries)]
        );
        
        console.log('[数据库] ✅ 日记已保存:', diaryData);
      } finally {
        connection.release();
      }
    }
    
    return { success: true, data: diaryData, action: 'create' };
  } else if (action === 'query') {
    return { 
      success: true, 
      data: { 
        entries: userContext.diaryEntries 
      }, 
      action: 'query' 
    };
  } else {
    return { success: false, error: 'Unknown action' };
  }
}

async function callCourseAnalyzer(params, userContext) {
  console.log('Course Analyzer called with params:', params);
  
  const { imageUrl, fileContent, type, courses } = params;
  
  if (type === 'image' && imageUrl) {
    // 直接返回数据，由Dify负责AI分析
    return { 
      success: true, 
      data: {
        courses: courses || []
      }
    };
  } else if (type === 'file' && fileContent) {
    // 直接返回数据，由Dify负责AI分析
    return { 
      success: true, 
      data: {
        courses: courses || []
      }
    };
  } else {
    return { success: false, error: 'Invalid request' };
  }
}

async function callReminderGenerator(params, userContext) {
  console.log('Reminder Generator called with params:', params);
  return { success: true, data: params };
}

// ==================== 更新用户偏好工具 ====================
async function callUpdateUserPreferences(params, userContext) {
  console.log('🔧 Update User Preferences called with params:', params);
  
  const { preferences } = params;
  const userId = userContext.userId;
  
  if (!userId) {
    return { success: false, error: 'User not logged in' };
  }
  
  try {
    const connection = await pool.getConnection();
    try {
      // 获取现有偏好
      let existingPreferences = {};
      const [rows] = await connection.query(
        'SELECT content FROM user_data WHERE user_id = ? AND data_type = ?',
        [userId, 'userPreferences']
      );
      
      if (rows.length > 0 && rows[0].content) {
        existingPreferences = safeParseJSON(rows[0].content, {});
      }
      
      // 合并新偏好
      const updatedPreferences = { ...existingPreferences, ...preferences };
      
      // 保存到数据库
      await connection.query(
        'INSERT INTO user_data (user_id, data_type, content) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE content = ?',
        [userId, 'userPreferences', JSON.stringify(updatedPreferences), JSON.stringify(updatedPreferences)]
      );
      
      logInfo('用户偏好', `已更新: ${JSON.stringify(updatedPreferences)}`);
      
      return { 
        success: true, 
        data: updatedPreferences,
        action: 'update'
      };
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('[错误] 更新用户偏好失败:', error);
    return { success: false, error: error.message };
  }
}

app.post('/api/chat', async (req, res) => {
  logSection('📨 收到新的聊天请求');
  
  const { messages, model, isToolCall } = req.body;
  const token = req.headers.authorization?.split(' ')[1];

  logInfo('请求参数', `Token: ${token ? '已提供' : '未提供'}, Messages数量: ${messages?.length || 0}, isToolCall: ${isToolCall || '否'}`);
  
  // DEBUG: 检查请求头（不记录敏感信息）
  console.log('[DEBUG] Authorization header:', req.headers.authorization ? '已提供' : '未提供');

  if (!messages || !Array.isArray(messages)) {
    logInfo('错误', '消息格式无效');
    return res.status(400).json({ error: 'Invalid messages format' });
  }

  // 检测是否是Dify工具调用（避免循环）
  // 特征：通常工具调用的消息格式或来源有特定特征
  const isDifyToolCall = isToolCall || 
                         (req.body.toolCall !== undefined) ||
                         (messages.length === 1 && 
                          messages[0]?.role === 'user' && 
                          messages[0]?.content === 'continue');

  if (isDifyToolCall) {
    logInfo('检测', '检测到Dify工具调用，直接返回响应避免循环');
    // 直接返回简单响应，不再调用Dify Agent
    return res.json({
      choices: [{
        message: {
          content: "嘎！我收到你的请求了，正在处理中..."
        }
      }],
      dify: {
        intent: 'CHAT',
        task: '日常对话',
        tool: 'CHAT_ASSISTANT',
        params: {},
        thinkingProcess: '用户想聊天',
        response: "嘎！有什么想聊的吗？"
      },
      toolResult: null,
      pendingActions: []
    });
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
            'SELECT crow_stats, last_updated FROM crow_data WHERE user_id = ?',
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
            const rawCrowStats = safeParseJSON(crowRows[0].crow_stats, { hunger: 100, mood: 90 });
            userCrowStats = calculateCrowDecay(rawCrowStats, crowRows[0].last_updated);
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
      userId: userId,
      token: token
    };

    // DEBUG: 追踪 userContext 创建
    console.log('[DEBUG] 创建 userContext');
    console.log('[DEBUG] userId:', userId);
    console.log('[DEBUG] token:', token ? '已设置' : '未设置');

    logSection('🤖 调用Dify Agent分析');
    const difyResult = await callDifyAgent(messages, userContext);

    logSection('⚡ 模型调度');
    logInfo('选择工具', difyResult.tool);
    logInfo('任务类型', difyResult.task);
    logInfo('工具调用数量', difyResult.allToolCalls ? difyResult.allToolCalls.length : 0);

    let allToolResults = [];
    let finalResponse = null;
    // 重置 pendingActions
    pendingActions = [];

    // ========== 处理多个工具调用 ==========
    if (difyResult.allToolCalls && difyResult.allToolCalls.length > 0) {
      logInfo('调度', `处理 ${difyResult.allToolCalls.length} 个工具调用...`);
      
      for (let i = 0; i < difyResult.allToolCalls.length; i++) {
        const toolCall = difyResult.allToolCalls[i];
        logInfo('调度', `处理第 ${i+1} 个工具: ${toolCall.tool}`);
        
        let toolResult = null;
        
        switch (toolCall.tool) {
          case 'SCHEDULE_MANAGER':
            logInfo('调度', '调用 SCHEDULE_MANAGER...');
            const scheduleParams = { ...toolCall.params, token: userContext.token };
            toolResult = await callScheduleManager(scheduleParams, userContext);
            
            // 构建 pendingActions
            if (toolResult.success && toolResult.data && toolResult.action === 'create') {
              pendingActions.push({
                type: 'schedule',
                data: toolResult.data
              });
            }
            break;
            
          case 'DIARY_MANAGER':
            logInfo('调度', '调用 DIARY_MANAGER...');
            const diaryParams = { ...toolCall.params, token: userContext.token };
            toolResult = await callDiaryManager(diaryParams, userContext);
            
            // 构建 pendingActions
            if (toolResult.success && toolResult.data && toolResult.action === 'create') {
              pendingActions.push({
                type: 'diary',
                data: toolResult.data
              });
            }
            break;
            
          case 'COURSE_ANALYZER':
            logInfo('调度', '调用 COURSE_ANALYZER...');
            toolResult = await callCourseAnalyzer(toolCall.params, userContext);
            break;
            
          case 'REMINDER_GENERATOR':
            logInfo('调度', '调用 REMINDER_GENERATOR...');
            toolResult = await callReminderGenerator(toolCall.params, userContext);
            break;
            
          case 'UPDATE_USER_PREFERENCES':
            logInfo('调度', '调用 UPDATE_USER_PREFERENCES...');
            toolResult = await callUpdateUserPreferences(toolCall.params, userContext);
            break;
        }
        
        if (toolResult) {
          allToolResults.push({
            tool: toolCall.tool,
            result: toolResult
          });
        }
      }
    } else {
      // ========== 只有一个工具调用的回退处理 ==========
      let toolResult = null;
      
      switch (difyResult.tool) {
        case 'SCHEDULE_MANAGER':
          logInfo('调度', '调用 SCHEDULE_MANAGER...');
          const scheduleParams = { ...difyResult.params, token: userContext.token };
          toolResult = await callScheduleManager(scheduleParams, userContext);
          
          // 构建 pendingActions
          if (toolResult.success && toolResult.data && toolResult.action === 'create') {
            pendingActions.push({
              type: 'schedule',
              data: toolResult.data
            });
          }
          break;
          
        case 'DIARY_MANAGER':
          logInfo('调度', '调用 DIARY_MANAGER...');
          const diaryParams = { ...difyResult.params, token: userContext.token };
          toolResult = await callDiaryManager(diaryParams, userContext);
          
          // 构建 pendingActions
          if (toolResult.success && toolResult.data && toolResult.action === 'create') {
            pendingActions.push({
              type: 'diary',
              data: toolResult.data
            });
          }
          break;
          
        case 'CHAT_ASSISTANT':
          logInfo('调度', '使用Dify直接回复...');
          if (difyResult.response) {
            finalResponse = {
              choices: [{
                message: {
                  content: difyResult.response
                }
              }]
            };
          }
          break;
          
        case 'COURSE_ANALYZER':
          logInfo('调度', '调用 COURSE_ANALYZER...');
          toolResult = await callCourseAnalyzer(difyResult.params, userContext);
          break;
          
        case 'REMINDER_GENERATOR':
          logInfo('调度', '调用 REMINDER_GENERATOR...');
          toolResult = await callReminderGenerator(difyResult.params, userContext);
          break;
          
        case 'UPDATE_USER_PREFERENCES':
          logInfo('调度', '调用 UPDATE_USER_PREFERENCES...');
          toolResult = await callUpdateUserPreferences(difyResult.params, userContext);
          break;
          
        default:
          logInfo('调度', '默认使用Dify回复...');
          if (difyResult.response) {
            finalResponse = {
              choices: [{
                message: {
                  content: difyResult.response
                }
              }]
            };
          }
      }
      
      if (toolResult) {
        allToolResults.push({
          tool: difyResult.tool,
          result: toolResult
        });
      }
    }

    if (!finalResponse && difyResult.response) {
      logInfo('响应', '使用Dify直接回复');
      finalResponse = {
        choices: [{
          message: {
            content: difyResult.response
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
      dify: difyResult,
      toolResults: allToolResults, // 所有工具执行结果
      toolResult: allToolResults.length > 0 ? allToolResults[allToolResults.length - 1].result : null,
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
  
  const { messages, action, confirmedTool, context } = req.body;
  const token = req.headers.authorization?.split(' ')[1];

  logInfo('请求参数', `Token: ${token ? '已提供' : '未提供'}, Action: ${action || 'initial'}, ConfirmedTool: ${confirmedTool || 'none'}, Context: ${context ? '已提供' : '未提供'}`);

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
    let userPreferences = {};
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
            'SELECT crow_stats, last_updated FROM crow_data WHERE user_id = ?',
            [userId]
          );

          rows.forEach(row => {
            if (row.data_type === 'todos') {
              userTodos = safeParseJSON(row.content, []);
            } else if (row.data_type === 'diaryEntries') {
              userDiaryEntries = safeParseJSON(row.content, []);
            } else if (row.data_type === 'userPreferences') {
              userPreferences = safeParseJSON(row.content, {});
            }
          });

          if (crowRows.length > 0 && crowRows[0].crow_stats) {
            const rawCrowStats = safeParseJSON(crowRows[0].crow_stats, { hunger: 100, mood: 90 });
            userCrowStats = calculateCrowDecay(rawCrowStats, crowRows[0].last_updated);
          }
        } finally {
          connection.release();
        }
      } catch (error) {
        console.error('[错误] 获取用户数据失败:', error);
      }
    }

    // 如果前端传递了上下文数据，优先使用前端的数据（因为前端数据是实时的）
    if (context) {
      if (context.crowStats) {
        userCrowStats = { ...userCrowStats, ...context.crowStats };
      }
      if (Array.isArray(context.todos)) {
        userTodos = context.todos;
      }
      if (Array.isArray(context.diaryEntries)) {
        userDiaryEntries = context.diaryEntries;
      }
    }

    const userContext = {
      todos: userTodos,
      diaryEntries: userDiaryEntries,
      crowStats: userCrowStats,
      userPreferences: userPreferences,
      userId: userId,
      token: token
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
      let pendingActions = [];
      const hasImages = messageHasImages(messages);
      const images = extractImagesFromMessages(messages);
      
      // 根据确认的工具直接调用 - 支持多种工具名称格式
      const confirmedToolLower = confirmedTool ? confirmedTool.toLowerCase() : '';
      
      switch (true) {
        case confirmedToolLower.includes('schedule'):
          await sendSSEvent(res, 'thinking', {
            step: 2,
            text: '执行日程管理操作...',
            icon: '📅'
          });
          toolResult = await callScheduleManager({ action: 'create', text: messages[messages.length - 1]?.content || '', token: userContext.token }, userContext);
          // 构建 pendingActions
          if (toolResult.success && toolResult.data && toolResult.action === 'create') {
            pendingActions.push({
              type: 'schedule',
              data: toolResult.data
            });
          }
          break;
        case confirmedToolLower.includes('diary'):
          await sendSSEvent(res, 'thinking', {
            step: 2,
            text: '执行日记管理操作...',
            icon: '📔'
          });
          // 把原始消息传给日记管理（包含图片）
          const diaryParams = { 
            action: 'create', 
            content: messages[messages.length - 1]?.content || '',
            date: getLocalDateString()
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
                date: toolResult.data.date || getLocalDateString(),
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
            } finally {
              connection.release();
            }
          }
          // 构建 pendingActions
          if (toolResult.success && toolResult.data && toolResult.action === 'create') {
            pendingActions.push({
              type: 'diary',
              data: toolResult.data
            });
          }
          break;
        case confirmedToolLower.includes('course'):
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
        text: '任务完成！',
        icon: '🎉'
      });

      // 优化5: 直接返回简单总结，避免二次调用主脑
      let finalContent = '';
      if (confirmedTool === 'SCHEDULE_MANAGER') {
        finalContent = '好的，日程已经帮你记录好了！嘎～';
      } else if (confirmedTool === 'DIARY_MANAGER') {
        finalContent = '日记已经保存啦，这是珍贵的记忆呢！嘎～';
      } else if (confirmedTool === 'COURSE_ANALYZER') {
        finalContent = '课表分析完成，课程信息都导入好了！嘎～';
      } else {
        finalContent = '完成啦！有什么其他需要帮忙的吗？嘎～';
      }

      const responseData = {
        choices: [{
          message: {
            content: finalContent
          }
        }],
        dify: null,
        toolResult: toolResult,
        pendingActions: pendingActions,
        thinkingProcess: `已执行 ${confirmedTool}`,
        isComplexTask: true,
        actionCompleted: confirmedTool
      };

      await sendSSEvent(res, 'complete', responseData);
      res.end();
      return;
    }

    // ============== 情况2: 首次请求，正常流程 ==============
    // 调用Dify Agent - 传递res以实时转发思考过程（动态步骤）
    const difyResult = await callDifyAgent(messages, userContext, res);

    // 检测是否有图片且需要确认
    const hasImages = messageHasImages(messages);
    let needsConfirmation = false;
    let confirmableTool = null;
    
    if (hasImages) {
      // 如果有图片，且Dify没有100%确定使用某个工具，就需要确认
      // 或者Dify选择了相关工具（支持多种命名格式）
      const toolLower = difyResult.tool ? difyResult.tool.toLowerCase() : '';
      if (toolLower.includes('diary') || toolLower.includes('schedule') || toolLower.includes('course')) {
        needsConfirmation = true;
        confirmableTool = difyResult.tool;
      }
    }

    if (needsConfirmation) {
      logInfo('确认', `需要用户确认使用 ${confirmableTool}`);
      
      const nextStep = (difyResult.thoughtStep || 0) + 1;
      await sendSSEvent(res, 'thinking', {
        step: nextStep,
        text: '需要你的确认...',
        icon: '❓'
      });

      await sendSSEvent(res, 'thinking', {
        step: nextStep + 1,
        text: '准备完成！',
        icon: '🎉'
      });

      // 返回需要确认的响应 - 不使用Dify的残留消息，只显示简单提示
      let finalContent = `我发现你发送了图片，要帮你${getToolLabel(confirmableTool)}吗？嘎～`;

      const responseData = {
        choices: [{
          message: {
            content: finalContent
          }
        }],
        dify: difyResult,
        toolResult: null,
        thinkingProcess: difyResult.thinkingProcess,
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

    // ============== 模型调度（不需要确认的情况） ==============
    logSection('⚡ 模型调度');
    logInfo('选择工具', difyResult.tool);
    logInfo('任务类型', difyResult.task);
    logInfo('工具调用数量', difyResult.allToolCalls ? difyResult.allToolCalls.length : 0);

    let allToolResults = [];
    let finalResponse = null;
    // 重置 pendingActions
    pendingActions = [];

    // ========== 处理多个工具调用 ==========
    if (difyResult.allToolCalls && difyResult.allToolCalls.length > 0) {
      logInfo('调度', `处理 ${difyResult.allToolCalls.length} 个工具调用...`);
      
      for (let i = 0; i < difyResult.allToolCalls.length; i++) {
        const toolCall = difyResult.allToolCalls[i];
        logInfo('调度', `处理第 ${i+1} 个工具: ${toolCall.tool}`);
        
        let toolResult = null;
        
        switch (toolCall.tool) {
          case 'SCHEDULE_MANAGER':
            logInfo('调度', '调用 SCHEDULE_MANAGER...');
            const scheduleParams = { ...toolCall.params, token: userContext.token };
            toolResult = await callScheduleManager(scheduleParams, userContext);
            
            // 构建 pendingActions
            if (toolResult.success && toolResult.data && toolResult.action === 'create') {
              pendingActions.push({
                type: 'schedule',
                data: toolResult.data
              });
            }
            break;
            
          case 'DIARY_MANAGER':
            logInfo('调度', '调用 DIARY_MANAGER...');
            const diaryParams = { ...toolCall.params, token: userContext.token };
            toolResult = await callDiaryManager(diaryParams, userContext);
            
            // 构建 pendingActions
            if (toolResult.success && toolResult.data && toolResult.action === 'create') {
              pendingActions.push({
                type: 'diary',
                data: toolResult.data
              });
            }
            break;
            
          case 'COURSE_ANALYZER':
            logInfo('调度', '调用 COURSE_ANALYZER...');
            toolResult = await callCourseAnalyzer(toolCall.params, userContext);
            break;
            
          case 'REMINDER_GENERATOR':
            logInfo('调度', '调用 REMINDER_GENERATOR...');
            toolResult = await callReminderGenerator(toolCall.params, userContext);
            break;
            
          case 'UPDATE_USER_PREFERENCES':
            logInfo('调度', '调用 UPDATE_USER_PREFERENCES...');
            toolResult = await callUpdateUserPreferences(toolCall.params, userContext);
            break;
        }
        
        if (toolResult) {
          allToolResults.push({
            tool: toolCall.tool,
            result: toolResult
          });
        }
      }
    } else {
      // ========== 只有一个工具调用的回退处理 ==========
      let toolResult = null;
      
      switch (difyResult.tool) {
        case 'SCHEDULE_MANAGER':
          logInfo('调度', '调用 SCHEDULE_MANAGER...');
          const scheduleParams = { ...difyResult.params, token: userContext.token };
          toolResult = await callScheduleManager(scheduleParams, userContext);
          
          // 构建 pendingActions
          if (toolResult.success && toolResult.data && toolResult.action === 'create') {
            pendingActions.push({
              type: 'schedule',
              data: toolResult.data
            });
          }
          break;
          
        case 'DIARY_MANAGER':
          logInfo('调度', '调用 DIARY_MANAGER...');
          const diaryParams = { ...difyResult.params, token: userContext.token };
          toolResult = await callDiaryManager(diaryParams, userContext);
          
          // 构建 pendingActions
          if (toolResult.success && toolResult.data && toolResult.action === 'create') {
            pendingActions.push({
              type: 'diary',
              data: toolResult.data
            });
          }
          break;
          
        case 'CHAT_ASSISTANT':
          logInfo('调度', '使用Dify直接回复...');
          if (difyResult.response) {
            finalResponse = {
              choices: [{
                message: {
                  content: difyResult.response
                }
              }]
            };
          }
          break;
          
        case 'COURSE_ANALYZER':
          logInfo('调度', '调用 COURSE_ANALYZER...');
          toolResult = await callCourseAnalyzer(difyResult.params, userContext);
          break;
          
        case 'REMINDER_GENERATOR':
          logInfo('调度', '调用 REMINDER_GENERATOR...');
          toolResult = await callReminderGenerator(difyResult.params, userContext);
          break;
          
        case 'UPDATE_USER_PREFERENCES':
          logInfo('调度', '调用 UPDATE_USER_PREFERENCES...');
          toolResult = await callUpdateUserPreferences(difyResult.params, userContext);
          break;
          
        default:
          logInfo('调度', '默认使用Dify回复...');
          if (difyResult.response) {
            finalResponse = {
              choices: [{
                message: {
                  content: difyResult.response
                }
              }]
            };
          }
      }
      
      if (toolResult) {
        allToolResults.push({
          tool: difyResult.tool,
          result: toolResult
        });
      }
    }

    if (!finalResponse && difyResult.response) {
      logInfo('响应', '使用Dify直接回复');
      finalResponse = {
        choices: [{
          message: {
            content: difyResult.response
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
      dify: difyResult,
      toolResults: allToolResults, // 所有工具执行结果
      toolResult: allToolResults.length > 0 ? allToolResults[allToolResults.length - 1].result : null,
      pendingActions: pendingActions,
      thinkingProcess: difyResult.thinkingProcess
    };

    logSection('✅ 请求处理完成');
    logObject('返回数据', responseData);

    console.log('[调试] 准备响应，difyResult.response =', difyResult.response);
    console.log('[调试] 准备发送的思考步骤 =', difyResult.thinkSteps);
    
    // === 🧠 先发送思考步骤！
    if (difyResult.thinkSteps && difyResult.thinkSteps.length > 0) {
      console.log('[🧠] 准备发送思考步骤');
      for (let i = 0; i < difyResult.thinkSteps.length; i++) {
        const stepText = difyResult.thinkSteps[i];
        console.log('[🧠] 发送思考步骤', i + 1, ':', stepText);
        await sendSSEvent(res, 'thinking', {
          step: i + 1,
          text: stepText,
          icon: '🧠'
        });
        // 稍微延迟，让用户有思考的感觉
        await new Promise(r => setTimeout(r, 50));
      }
      console.log('[🧠] 思考步骤发送完毕');
    }
    
    console.log('[调试] 发送complete事件，responseData =', JSON.stringify(responseData, null, 2));
    
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
  const toolLower = tool ? tool.toLowerCase() : '';
  if (toolLower.includes('schedule')) {
    return '记录到日程';
  } else if (toolLower.includes('diary')) {
    return '记录到日记';
  } else if (toolLower.includes('course')) {
    return '分析课表';
  } else if (toolLower.includes('reminder')) {
    return '生成提醒';
  } else {
    return '只是聊天';
  }
}

app.get('/api/oss-signature', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, error: 'unauthorized' });
  }

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    
    // OSS 配置（需要设置环境变量 OSS_ACCESS_KEY_ID 和 OSS_ACCESS_KEY_SECRET）
    const accessKeyId = process.env.OSS_ACCESS_KEY_ID;
    const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET;
    if (!accessKeyId || !accessKeySecret) {
      return res.status(500).json({ success: false, error: 'OSS credentials not configured' });
    }
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

// ============== 自然语言时间解析 API ==============
app.post('/api/parse-time', (req, res) => {
  const { text, localtime } = req.body;
  const input = text || localtime;
  
  console.log('\n=== /api/parse-time 请求 ===');
  console.log('[DEBUG] 输入文本:', input);
  
  const result = parseNaturalLanguageTime(input);
  
  console.log('[DEBUG] 解析结果:', result);
  
  res.json({
    success: true,
    original: input,
    date: result.date,
    time: result.time,
    formatted: result.date && result.time ? `${result.date} ${result.time}` : null
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============== 任务管理 API ==============
app.use('/api', tasksRouter);

// ============== 会话管理 API ==============
app.use('/api', conversationsRouter);

// ============== DeepSeek 流式对话（替代 Dify）==============
app.post('/api/chat/deepseek', async (req, res) => {
  const { content, mode, sessionId: reqSessionId, deepseekApiKey: userApiKey } = req.body;
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

    // 会话管理：复用已有 sessionId 或创建新的
    const sessionId = reqSessionId || `sess_${userId}_${Date.now()}`;

    // 获取任务上下文（注入到 System Prompt）
    let tasks = [];
    try {
      const [rows] = await pool.query(
        'SELECT * FROM agent_tasks WHERE user_id = ? AND status != ? ORDER BY priority ASC, created_at DESC LIMIT 20',
        [userId, 'completed']
      );
      tasks = rows;
    } catch (e) { /* 表可能还不存在 */ }

    // 构建 System Prompt
    const promptMode = mode || 'chat';
    const context = {
      tasks_json: JSON.stringify(tasks.map(t => ({
        id: t.id, title: t.title, status: t.status, priority: t.priority
      }))),
    };
    const systemPrompt = getSystemPrompt(promptMode, context);

    // === 多轮对话：加载历史 + 裁剪 + 组装 messages ===
    const messages = await buildMessagesForDeepSeek(
      pool, userId, sessionId, systemPrompt, content
    );

    const totalEstTokens = messages.reduce((sum, m) =>
      sum + estimateTokens(m.content || ''), 0
    );
    console.log(`[DeepSeek Chat] userId=${userId} session=${sessionId} `
      + `messages=${messages.length} estTokens=${totalEstTokens}`);

    // === 流式调用 DeepSeek（传递完整 messages 数组） ===
    let fullContent = '';

    const response = await fetch(process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions', {
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
            sendSSEvent(res, 'message', { content: delta });
          }
        } catch (e) { /* skip malformed */ }
      }
    }

    // === 保存 AI 回复到数据库 ===
    if (fullContent) {
      await saveAssistantMessage(pool, userId, sessionId, fullContent);
    }

    // === 更新会话元数据（标题 + token 估算） ===
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

    // === 解析结构化输出 ===
    try {
      const cleaned = fullContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);
      if (parsed.type === 'TASK_SPLIT') {
        sendSSEvent(res, 'task_split', parsed.data);
      } else if (parsed.type === 'SCHEDULE') {
        sendSSEvent(res, 'schedule', parsed.data);
      } else if (parsed.type === 'DIARY') {
        sendSSEvent(res, 'diary', parsed.data);
      }
    } catch (e) {
      // 非 JSON 输出，作为纯文本
    }

    sendSSEvent(res, 'done', { sessionId });
  } catch (error) {
    console.error('[DeepSeek Chat] 错误:', error.message);
    sendSSEvent(res, 'error', { message: error.message });
  } finally {
    res.end();
  }
});

app.listen(PORT, () => {
  console.log('\n========================================');
  console.log('      拾鸦后端服务启动成功！');
  console.log('========================================');
  console.log(`本地访问地址: http://localhost:${PORT}`);
  console.log(`DeepSeek API: ${process.env.DEEPSEEK_API_KEY ? '已配置' : '未配置'}`);
  console.log(`Dify API: ${process.env.DIFY_API_KEY ? '已配置（兼容）' : '未配置'}`);
  console.log(`数据库: MySQL connected`);
  console.log('========================================\n');
  
  // 自动 Migration：确保 crow_data 有 last_updated 列
  (async () => {
    try {
      await pool.query(
        "ALTER TABLE crow_data ADD COLUMN last_updated DATETIME DEFAULT CURRENT_TIMESTAMP"
      );
      console.log('[Migration] ✅ crow_data.last_updated 列已添加');
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log('[Migration] ⏭ crow_data.last_updated 列已存在，跳过');
      } else {
        console.warn('[Migration] ⚠ ALTER TABLE 出错:', e.message);
      }
    }
    try {
      await pool.query(
        "UPDATE crow_data SET last_updated = CURRENT_TIMESTAMP WHERE last_updated IS NULL"
      );
    } catch (e) { /* ignore */ }
  })();
});

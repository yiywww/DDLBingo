/**
 * System Prompt 模板管理
 * 按模式加载对应 Prompt 文件，注入上下文数据
 */

const fs = require('fs');
const path = require('path');

const PROMPTS_DIR = __dirname;

// 缓存已读取的 prompt 内容
const cache = {};

function loadPrompt(name) {
  if (cache[name]) return cache[name];
  const filePath = path.join(PROMPTS_DIR, `${name}.txt`);
  try {
    cache[name] = fs.readFileSync(filePath, 'utf-8').trim();
  } catch (e) {
    console.error(`[Prompts] 无法加载 ${name}:`, e.message);
    cache[name] = '';
  }
  return cache[name];
}

/**
 * 获取格式化的当前日期时间
 */
function getCurrentDateTime() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][now.getDay()];
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return {
    date: `${year}-${month}-${day}`,
    weekday,
    time: `${hours}:${minutes}`,
    full: `${year}年${parseInt(month)}月${parseInt(day)}日 ${weekday} ${hours}:${minutes}`,
  };
}

/**
 * 根据模式获取 System Prompt，注入上下文变量
 * 内置变量：
 *   {current_date}     → "2026-06-08"
 *   {current_weekday}  → "周一"
 *   {current_time}     → "15:30"
 *   {current_full}     → "2026年6月8日 周一 15:30"
 * @param {string} mode - chat | schedule | diary | task-split | task-chat
 * @param {object} context - 上下文变量 { user_input, tasks_json, ... }
 * @returns {string} 完整的 System Prompt
 */
function getSystemPrompt(mode, context = {}) {
  const template = loadPrompt(mode);

  if (!template) {
    console.error(`[Prompts] 模板 ${mode} 为空`);
    return '';
  }

  const dt = getCurrentDateTime();

  // 合并内置变量和外部上下文
  const allVars = {
    current_date: dt.date,
    current_weekday: dt.weekday,
    current_time: dt.time,
    current_full: dt.full,
    ...context,
  };

  let prompt = template;
  for (const [key, value] of Object.entries(allVars)) {
    prompt = prompt.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value ?? ''));
  }

  return prompt;
}

module.exports = {
  getSystemPrompt,
  loadPrompt,
};

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
 * 根据模式获取 System Prompt，注入上下文变量
 * @param {string} mode - chat | task | schedule | diary | class | task-split | task-chat
 * @param {object} context - 上下文变量 { tasks_json, ocr_text, user_input, ... }
 * @returns {string} 完整的 System Prompt
 */
function getSystemPrompt(mode, context = {}) {
  const template = loadPrompt(mode);

  let prompt = template;
  // 替换模板变量 {tasks_json} 等
  for (const [key, value] of Object.entries(context)) {
    prompt = prompt.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value ?? ''));
  }

  return prompt;
}

module.exports = {
  getSystemPrompt,
  loadPrompt,
};

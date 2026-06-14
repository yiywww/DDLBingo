/**
 * DeepSeek API 服务封装
 * 统一替代 Dify/豆包，通过 System Prompt 切换模式
 */

const DEEPSEEK_API_URL = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

/**
 * 调用 DeepSeek（非流式，返回完整结果）
 * @param {string} systemPrompt - 系统提示词
 * @param {string} userMessage - 用户消息
 * @param {object} options - 可选参数 { temperature, max_tokens, model }
 * @returns {Promise<string>} AI 返回的完整文本
 */
async function callDeepSeek(systemPrompt, userMessage, options = {}) {
  const {
    temperature = 0.7,
    max_tokens = 4096,
    model = 'deepseek-chat',
  } = options;

  const messages = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: userMessage });

  const response = await fetch(DEEPSEEK_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens,
      stream: false,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`DeepSeek API error ${response.status}: ${errorBody}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

/**
 * 调用 DeepSeek 流式（SSE），通过回调逐步返回内容
 * @param {string} systemPrompt - 系统提示词
 * @param {string} userMessage - 用户消息
 * @param {object} callbacks - 回调 { onToken, onDone, onError }
 * @param {object} options - 可选参数
 * @returns {Promise<string>} 累积的完整文本
 */
async function callDeepSeekStream(systemPrompt, userMessage, callbacks = {}, options = {}) {
  const {
    temperature = 0.7,
    max_tokens = 4096,
    model = 'deepseek-chat',
  } = options;

  const { onToken, onDone, onError } = callbacks;

  const messages = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: userMessage });

  let fullContent = '';

  try {
    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      const err = new Error(`DeepSeek API error ${response.status}: ${errorBody}`);
      if (onError) onError(err);
      throw err;
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
            if (onToken) onToken(delta, fullContent);
          }
        } catch (e) {
          // 跳过无法解析的 chunk
        }
      }
    }

    if (onDone) onDone(fullContent);
    return fullContent;
  } catch (err) {
    if (onError) onError(err);
    throw err;
  }
}

module.exports = {
  callDeepSeek,
  callDeepSeekStream,
};

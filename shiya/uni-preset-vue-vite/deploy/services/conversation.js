/**
 * 对话历史管理模块
 *
 * 策略（参考 Data-Agent-main）：
 * - 基于 Token 阈值动态裁剪，而非硬编码轮数上限
 * - DeepSeek 支持 128K context，设置阈值 80K 触发裁剪（留 48K 给回复）
 * - 裁剪时保留最近 25% 消息原文，最旧 75% 压缩为摘要
 * - 确保不在 tool-call/tool-result 对中间切割
 */

// ============== Token 估算 ==============

/**
 * 估算文本的 token 数量
 * 粗略规则：中文 ~1.5 字/token，英文 ~4 字/token
 * DeepSeek 使用 BPE tokenizer，这里用保守估计
 */
function estimateTokens(text) {
  if (!text) return 0;
  let chineseChars = 0;
  let otherChars = 0;
  for (const ch of text) {
    if (/[\u4e00-\u9fff\u3400-\u4dbf]/.test(ch)) {
      chineseChars++;
    } else {
      otherChars++;
    }
  }
  // 中文约 1.5 字/token，其他约 4 字/token
  return Math.ceil(chineseChars / 1.5 + otherChars / 4);
}

/**
 * 估算消息数组的总 token 数
 */
function estimateMessagesTokens(messages) {
  return messages.reduce((sum, m) => sum + estimateTokens(m.content || ''), 0);
}

// ============== 裁剪策略 ==============

/** Token 阈值：超过此值触发裁剪 */
const TOKEN_THRESHOLD = 80000;

/** 裁剪比例：保留最近 N% 的消息原文，其余压缩 */
const KEEP_RATIO = 0.25;

/** 最少保留轮数（即使是摘要也要保留最近的对话） */
const MIN_KEEP_ROUNDS = 4;

/**
 * 裁剪对话历史（多阶段策略）
 *
 * Stage 1: 软限制 — 超过 40 条消息（20 轮），只保留最近 30 条
 * Stage 2: 硬限制 — Token 超过 80K，保留最近 25% 原文 + 其余生成摘要
 *
 * @param {Array} messages - [{ role, content }]
 * @param {string} sessionSummary - 已有的会话摘要（多轮累积）
 * @returns {{ messages: Array, summary: string, prunedCount: number }}
 */
function pruneConversationHistory(messages, sessionSummary = '') {
  const result = {
    messages: [...messages],
    summary: sessionSummary,
    prunedCount: 0,
    wasCompressed: false,
  };

  // === Stage 1: 数量软限制 ===
  // 超过 40 条消息 → 只保留最近 30 条
  if (result.messages.length > 40) {
    const trimmed = result.messages.slice(-30);
    result.prunedCount = result.messages.length - trimmed.length;
    result.messages = trimmed;
  }

  // === Stage 2: Token 硬限制 ===
  const totalTokens = estimateMessagesTokens(result.messages);
  if (totalTokens <= TOKEN_THRESHOLD) {
    return result;
  }

  // 需要压缩：保留最近 KEEP_RATIO 的消息原文
  const keepCount = Math.max(
    MIN_KEEP_ROUNDS * 2,  // 至少保留 4 轮（8 条消息）
    Math.floor(result.messages.length * KEEP_RATIO)
  );

  // 找到干净分割点：不能在 user/assistant pair 中间切
  const splitPoint = findCleanSplitPoint(result.messages, keepCount);

  const oldMessages = result.messages.slice(0, splitPoint);
  const recentMessages = result.messages.slice(splitPoint);

  // 生成摘要
  const newSummary = buildHistorySummary(oldMessages, result.summary);

  // 构建压缩后的消息：摘要作为 system 消息 + 最近消息
  const compactedMessage = {
    role: 'system',
    content: `[对话历史摘要]\n${newSummary}\n\n--- 最近对话 ---`,
  };

  result.messages = [compactedMessage, ...recentMessages];
  result.summary = newSummary;
  result.prunedCount += oldMessages.length;
  result.wasCompressed = true;

  return result;
}

/**
 * 找到干净的消息分割点
 * 确保不会在 user-assistant pair 中间切割
 */
function findCleanSplitPoint(messages, targetIndex) {
  // 从 targetIndex 向前扫描，找到角色切换边界
  let splitPoint = Math.max(2, targetIndex);

  // 如果 splitPoint 落在 assistant 消息上，向前移
  // 确保 splitPoint 之前是完整的 user-assistant 对
  for (let i = splitPoint; i < messages.length; i++) {
    // 在 user 消息处切（新一轮对话开始）
    if (messages[i].role === 'user') {
      return i;
    }
  }

  // 兜底：不能全部裁剪，至少保留最后 2 条
  return Math.max(0, messages.length - 2);
}

/**
 * 从旧消息中生成简洁摘要
 */
function buildHistorySummary(oldMessages, existingSummary = '') {
  // 提取关键信息：用户问题 + AI 回复摘要
  const exchanges = [];
  for (let i = 0; i < oldMessages.length; i++) {
    if (oldMessages[i].role === 'user') {
      const userContent = truncateText(oldMessages[i].content, 100);
      const assistantContent = oldMessages[i + 1]?.role === 'assistant'
        ? truncateText(oldMessages[i + 1].content, 150)
        : '';
      exchanges.push(`Q: ${userContent}${assistantContent ? `\nA: ${assistantContent}` : ''}`);
    }
  }

  const newSummary = exchanges.join('\n');

  if (existingSummary) {
    // 合并新旧摘要
    return `[更早的对话]\n${truncateText(existingSummary, 500)}\n\n[最近的对话]\n${newSummary}`;
  }

  return newSummary;
}

function truncateText(text, maxLen) {
  if (!text) return '';
  return text.length > maxLen ? text.slice(0, maxLen) + '...' : text;
}

// ============== 会话管理 ==============

/**
 * 从数据库加载对话历史
 */
async function loadConversationHistory(pool, userId, sessionId) {
  if (!pool || !sessionId) return [];

  try {
    const [rows] = await pool.query(
      `SELECT role, content, created_at FROM conversation_messages
       WHERE user_id = ? AND session_id = ? AND status = 'NORMAL'
       ORDER BY created_at ASC`,
      [userId, sessionId]
    );
    return rows.map(r => ({ role: r.role, content: r.content }));
  } catch (e) {
    return [];
  }
}

/**
 * 从数据库加载已有的会话摘要
 */
async function loadSessionSummary(pool, userId, sessionId) {
  if (!pool || !sessionId) return '';

  try {
    const [rows] = await pool.query(
      `SELECT summary FROM conversation_sessions
       WHERE user_id = ? AND session_id = ?`,
      [userId, sessionId]
    );
    return rows[0]?.summary || '';
  } catch (e) {
    return '';
  }
}

/**
 * 保存会话摘要
 */
async function saveSessionSummary(pool, userId, sessionId, summary) {
  if (!pool || !sessionId) return;

  try {
    await pool.query(
      `INSERT INTO conversation_sessions (user_id, session_id, summary)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE summary = VALUES(summary)`,
      [userId, sessionId, summary]
    );
  } catch (e) {
    // 表可能不存在
  }
}

/**
 * 保存消息到数据库
 */
async function saveMessage(pool, userId, sessionId, role, content) {
  if (!pool || !sessionId) return;

  try {
    await pool.query(
      `INSERT INTO conversation_messages (user_id, session_id, role, content, status)
       VALUES (?, ?, ?, ?, 'NORMAL')`,
      [userId, sessionId, role, content]
    );
  } catch (e) {
    // 表可能不存在
  }
}

/**
 * 构建发送给 DeepSeek 的完整 messages 数组
 * 包含：system prompt + 裁剪后的历史 + 当前用户消息
 */
async function buildMessagesForDeepSeek(pool, userId, sessionId, systemPrompt, userMessage) {
  // 加载历史
  const history = await loadConversationHistory(pool, userId, sessionId);
  const existingSummary = await loadSessionSummary(pool, userId, sessionId);

  // 裁剪
  const { messages: prunedHistory, summary: newSummary, wasCompressed } =
    pruneConversationHistory(history, existingSummary);

  // 如果发生压缩，持久化新摘要
  if (wasCompressed && newSummary) {
    await saveSessionSummary(pool, userId, sessionId, newSummary);
  }

  // 组装：system prompt + 历史 + 当前消息
  const result = [];
  if (systemPrompt) {
    result.push({ role: 'system', content: systemPrompt });
  }
  result.push(...prunedHistory);
  result.push({ role: 'user', content: userMessage });

  // 保存当前用户消息
  await saveMessage(pool, userId, sessionId, 'user', userMessage);

  return result;
}

/**
 * 保存 AI 回复
 */
async function saveAssistantMessage(pool, userId, sessionId, content) {
  await saveMessage(pool, userId, sessionId, 'assistant', content);
}

module.exports = {
  estimateTokens,
  estimateMessagesTokens,
  pruneConversationHistory,
  buildMessagesForDeepSeek,
  saveAssistantMessage,
  TOKEN_THRESHOLD,
};

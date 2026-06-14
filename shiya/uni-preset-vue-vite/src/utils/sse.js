/**
 * 通用 SSE 解析器
 * 用于解析服务器发送的流式响应
 *
 * @param {Response} response - fetch 响应对象
 * @yields {Object} 解析后的 JSON 对象
 */
async function* parseSSEStream(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
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

      if (dataStr) {
        try {
          const data = JSON.parse(dataStr);
          yield { event: eventType, data };
        } catch (e) {
          // 跳过无法解析的事件
        }
      }
    }
  }
}

/**
 * uni-app 环境下的 SSE 解析器
 * 通过 uni.request 的 enableChunked 实现
 *
 * @param {string} url - API 地址
 * @param {object} options - 请求参数
 * @param {function} onEvent - 事件回调 (eventType, data) => void
 * @returns {Promise<void>}
 */
function createUniSSEStream(url, options = {}, onEvent) {
  const token = uni.getStorageSync('token');

  return new Promise((resolve, reject) => {
    const requestTask = uni.request({
      url,
      method: options.method || 'POST',
      data: options.data,
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
      buffer += new TextDecoder().decode(chunk.data);

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
            onEvent(eventType, data);
          } catch (e) {
            // 跳过无法解析的
          }
        }
      }
    });
  });
}

module.exports = {
  parseSSEStream,
  createUniSSEStream,
};

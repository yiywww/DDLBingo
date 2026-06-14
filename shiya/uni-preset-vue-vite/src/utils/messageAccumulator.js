/**
 * SSE 消息累积器
 * 把 SSE 逐块到达的 JSON 组织为连贯的渲染 Segment
 *
 * 用法：
 *   const acc = new MessageAccumulator()
 *   acc.pushBlock({ type: 'TEXT', data: '你好' })
 *   acc.pushBlock({ type: 'TASK_SPLIT', data: { mainTask: {...}, subTasks: [...] } })
 *   const segments = acc.getSegments()
 */

class MessageAccumulator {
  constructor() {
    this.textBuffer = '';       // 文本缓冲
    this.thoughtBuffer = '';    // 思考缓冲
    this.segments = [];         // 输出 segments
    this.taskSplitData = null;  // 任务拆解数据
    this.scheduleData = null;   // 日程数据
    this.diaryData = null;      // 日记数据
    this.isDone = false;        // 是否已完成
  }

  /**
   * 推入一个 SSE 事件块
   * @param {string} eventType - 事件类型: message | task_split | schedule | diary | done | error
   * @param {*} data - 事件数据
   */
  pushBlock(eventType, data) {
    switch (eventType) {
      case 'message':
        this.textBuffer += data.content || data || '';
        break;

      case 'task_split':
        this._flushBuffers();
        this.taskSplitData = data;
        break;

      case 'schedule':
        this._flushBuffers();
        this.scheduleData = data;
        break;

      case 'diary':
        this._flushBuffers();
        this.diaryData = data;
        break;

      case 'done':
        this._flushBuffers();
        this.isDone = true;
        break;

      case 'error':
        this.segments.push({
          kind: 'STATUS',
          statusKey: 'error',
          data: data.message || '未知错误',
        });
        break;

      default:
        // 未知类型按文本处理
        if (typeof data === 'string') {
          this.textBuffer += data;
        }
        break;
    }
  }

  /**
   * 获取当前所有 Segment
   * @returns {Array} Segment 数组
   */
  getSegments() {
    this._flushBuffers();

    const result = [...this.segments];

    // 追加任务拆解段
    if (this.taskSplitData) {
      result.push({
        kind: 'TASK_SPLIT',
        data: this.taskSplitData,
      });
    }

    // 追加日程段
    if (this.scheduleData) {
      result.push({
        kind: 'SCHEDULE',
        data: this.scheduleData,
      });
    }

    // 追加日记段
    if (this.diaryData) {
      result.push({
        kind: 'DIARY',
        data: this.diaryData,
      });
    }

    return result;
  }

  /**
   * 获取纯文本内容
   * @returns {string}
   */
  getTextContent() {
    this._flushBuffers();
    return this.segments
      .filter(s => s.kind === 'TEXT')
      .map(s => s.data)
      .join('');
  }

  /**
   * 获取任务拆解数据（如果有）
   * @returns {object|null}
   */
  getTaskSplitData() {
    return this.taskSplitData;
  }

  /**
   * 是否已完成
   * @returns {boolean}
   */
  getIsDone() {
    return this.isDone;
  }

  /**
   * 重置累积器
   */
  reset() {
    this.textBuffer = '';
    this.thoughtBuffer = '';
    this.segments = [];
    this.taskSplitData = null;
    this.scheduleData = null;
    this.diaryData = null;
    this.isDone = false;
  }

  // ===== 内部方法 =====

  _flushBuffers() {
    if (this.textBuffer) {
      this.segments.push({ kind: 'TEXT', data: this.textBuffer });
      this.textBuffer = '';
    }
    if (this.thoughtBuffer) {
      this.segments.push({ kind: 'THOUGHT', data: this.thoughtBuffer });
      this.thoughtBuffer = '';
    }
  }
}

export default MessageAccumulator;

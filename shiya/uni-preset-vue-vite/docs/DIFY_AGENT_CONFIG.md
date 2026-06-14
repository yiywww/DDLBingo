# 🐦 拾鸦 Dify Agent 配置说明

## 🎯 架构总览

```
用户输入 → 后端 parseNaturalLanguageTime (解析时间) → Dify Agent (识别意图) → 后端执行工具
```

**关键原则：**
- Dify 只负责 **理解意图** 和 **提取参数**
- **日期时间解析 100% 由后端负责**
- Dify 不要自己调用任何 API，直接返回意图给后端

---

## 📝 System Prompt (系统提示词)

```markdown
你是拾鸦，一只聪明可爱的乌鸦助手，专门帮助用户管理日程、日记和课程表。

## 🎯 你的任务
1. 理解用户的自然语言输入
2. 选择合适的工具
3. 提取关键参数
4. 友好地回应用户

## ⚠️ 重要：关于日期时间
**你不需要解析日期时间！**
- 后端已经帮你解析好了
- inputs.parsedDate: 解析好的日期 (YYYY-MM-DD)
- inputs.parsedTime: 解析好的时间 (HH:MM)
- inputs.hasParsedTime: 是否有解析结果

**直接使用 inputs 里的 parsedDate 和 parsedTime，不要自己解析！**
- 如果用户说"明天"，直接用 inputs.parsedDate
- 如果用户说"10点"，直接用 inputs.parsedTime
- 不要返回 {{time.YYYY-MM-DD}} 这种模板变量！

## 🛠️ 可用工具

### 1. scheduleManager - 日程管理
**action 选项：**
- create: 创建日程
- query: 查询日程
- update: 更新日程
- delete: 删除日程

**参数说明：**
- text: 日程内容 (必须)
- date: 日期 (直接用 inputs.parsedDate)
- time: 时间 (直接用 inputs.parsedTime)
- todoId: 日程ID (更新/删除时用)

**示例：**
用户说："明天10点和小罗约会"
→ tool: scheduleManager
→ params: {
    action: "create",
    text: "和小罗约会",
    date: "{{inputs.parsedDate}}",
    time: "{{inputs.parsedTime}}"
  }

### 2. diaryManager - 日记管理
**action 选项：**
- create: 创建日记
- query: 查询日记

**参数说明：**
- content: 日记内容
- date: 日期 (直接用 inputs.parsedDate)
- tags: 标签数组
- images: 图片URL数组

### 3. chatAssistant - 闲聊对话
不需要调用工具，直接友好回复。

## 🐦 回复风格
- 简洁友好
- 偶尔加"嘎"
- 亲切自然
```

---

## 🔧 工具配置

### scheduleManager (日程管理)

**工具类型：** 自定义工具 / HTTP Endpoint

**参数 Schema:**
```json
{
  "type": "object",
  "properties": {
    "action": {
      "type": "string",
      "enum": ["create", "query", "update", "delete"],
      "description": "操作类型"
    },
    "text": {
      "type": "string",
      "description": "日程内容"
    },
    "date": {
      "type": "string",
      "description": "日期 (直接用 inputs.parsedDate)"
    },
    "time": {
      "type": "string",
      "description": "时间 (直接用 inputs.parsedTime)"
    },
    "todoId": {
      "type": "string",
      "description": "日程ID (更新/删除时用)"
    }
  },
  "required": ["action"]
}
```

### diaryManager (日记管理)

**工具类型：** 自定义工具 / HTTP Endpoint

**参数 Schema:**
```json
{
  "type": "object",
  "properties": {
    "action": {
      "type": "string",
      "enum": ["create", "query"],
      "description": "操作类型"
    },
    "content": {
      "type": "string",
      "description": "日记内容"
    },
    "date": {
      "type": "string",
      "description": "日期 (直接用 inputs.parsedDate)"
    },
    "tags": {
      "type": "array",
      "items": { "type": "string" },
      "description": "标签数组"
    },
    "images": {
      "type": "array",
      "items": { "type": "string" },
      "description": "图片URL数组"
    }
  },
  "required": ["action"]
}
```

---

## 📥 Inputs (输入变量) 配置

在 Dify 中配置以下输入变量：

| 变量名 | 类型 | 说明 |
|--------|------|------|
| todos | array | 用户的日程列表 |
| diaryEntries | array | 用户的日记列表 |
| crowStats | object | 乌鸦状态 |
| userId | string | 用户ID |
| token | string | 认证token |
| parsedDate | string | **后端解析的日期 (YYYY-MM-DD)** |
| parsedTime | string | **后端解析的时间 (HH:MM)** |
| hasParsedTime | boolean | **是否有解析好的时间** |

---

## 🎯 工作流程示例

### 示例 1：创建日程

**用户输入：**
"明天上午10点和小罗约会"

**后端处理：**
1. parseNaturalLanguageTime("明天上午10点和小罗约会")
2. → date: "2026-05-05", time: "10:00"
3. 存入 parsedTimeCache
4. 调用 Dify，inputs.parsedDate = "2026-05-05", inputs.parsedTime = "10:00"

**Dify 返回：**
```json
{
  "tool": "scheduleManager",
  "params": {
    "action": "create",
    "text": "和小罗约会",
    "date": "2026-05-05",
    "time": "10:00"
  },
  "response": "好的嘎！我已经帮你记下来了。"
}
```

**后端执行：**
1. 调用 callScheduleManager
2. 从缓存取出解析结果
3. 保存到数据库
4. 返回结果

### 示例 2：闲聊

**用户输入：**
"今天天气真好"

**Dify 返回：**
```json
{
  "tool": "chatAssistant",
  "response": "是呀嘎！适合出去走走～"
}
```

---

## ⚠️ 常见问题 & 注意事项

### ❌ 不要做这些：
- ❌ 不要自己解析日期时间
- ❌ 不要返回 {{time.YYYY-MM-DD}} 这种模板变量
- ❌ 不要自己调用 HTTP API（工具只做声明）
- ❌ 不要怀疑后端的解析结果，直接用 inputs 里的

### ✅ 应该这样：
- ✅ 优先使用 inputs.parsedDate 和 inputs.parsedTime
- ✅ 如果用户没有明确时间，留空让后端处理
- ✅ 友好回复，偶尔加"嘎"
- ✅ 专注于理解用户意图，时间交给后端

### 🔧 调试技巧：
如果 Dify 还是返回模板变量：
1. 检查 System Prompt 是否明确说明"不要使用模板变量"
2. 检查 inputs 是否正确传入
3. 后端有缓存兜底，即使 Dify 返回垃圾也没问题

---

## 📚 更多资源

- [Dify 官方文档](https://docs.dify.ai/)
- 后端 server.js: 查看 parseNaturalLanguageTime 和工具执行逻辑

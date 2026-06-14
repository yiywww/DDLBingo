# 拾鸦 Agent 变更日志

> 最后更新：2026-06-09  
> 部署方式：PM2 (id=8, name=shiya)，端口 3004  
> 前端路径：`/var/www/frontend/`（nginx root）  
> 后端路径：`/var/www/shiya/deploy/`（PM2 cwd）  
> 服务器：root@8.134.127.111

---

## [v1.0] 2026-06-09 — DDL库：个人日程 + 经典小任务，让数据真正流通

### 变更概述
实现了 DDL 库（待办库）系统，让日程数据和 Bingo 棋盘真正互通互联。用户输入可用时间后，系统自动按 **70% 个人日程 + 30% 经典小任务** 的比例生成 Bingo 棋盘，日程完成后自动联动标记。

### DDL库内容

| 来源 | 占比 | 说明 |
|------|------|------|
| **个人日程** | 70% | 从 `user_data.todos` 中筛选未完成日程，优先推送紧急程度高的，困难/简单任务合理搭配，单个不超过可用时间 |
| **经典小任务** | 30% | 22 个预置微任务（喝水、眼保健操、深呼吸、深蹲、冥想等），随机抽取，可重复出现 |

### 核心规则

1. **时间约束**：单个任务的 `estimatedMinutes` 不超过用户投入的 `availableMinutes`
2. **优先级排序**：个人日程按 priority 排序（1=最紧急优先），从高优先级开始选取
3. **难度搭配**：hard 难度任务占比不超过 60%，确保不会全是困难任务
4. **分配算法**：紧急(priority≤2) → 一般(3) → 低(4-5)，轮流从三个池中选取
5. **棋盘分布**：每 2-3 个日程后穿插 1 个微任务，保证均匀分布
6. **日程去重**：已完成的日程不会再次出现在 DDL 库中（服务器端过滤 `completed=true`）
7. **微任务可重复**：经典小任务每次随机抽取，可以重复出现

### 经典小任务池（22个）

| 类别 | 任务示例 |
|------|---------|
| 健康 | 喝一杯水、起身走动、眼保健操、全身拉伸、矫正坐姿、户外快走、深蹲20个、爬楼梯 |
| 正念 | 深呼吸练习、冥想5分钟、感恩日记、写3句话日记 |
| 效率 | 整理桌面、快速复盘、明日计划、清洁小区域 |
| 学习 | 阅读10分钟 |
| 放松 | 听一首歌、远眺窗外、泡杯茶、拍张照片 |
| 补充 | 健康加餐 |

### 修改文件

| 文件 | 变更 |
|------|------|
| `deploy/routes/tasks.js` | 新增 `CLASSIC_MICRO_TASKS` 常量（22个任务）；新增 `POST /api/tasks/ddl-pool` 端点（DDL库生成算法）；新增 `POST /api/tasks/ddl-complete` 端点（Bingo完成→日程回写） |
| `src/utils/api.js` | 新增 `getDDLPool` 和 `completeDDLTask` API 函数 |
| `src/pages/index/index.vue` | 导入新 API；新增 `loadDDLBoard` 函数；Bingo 时间输入区新增「📋 从DDL库加载」按钮（暖黄色醒目）；`handleBingoComplete` 新增 `ddl_` 任务完成处理（本地标记 + 服务器回写） |

### 数据流向

```
用户点击 [从DDL库加载] → 输入可用时间
  ↓
POST /api/tasks/ddl-pool { availableMinutes, count: 9 }
  ↓
服务器:
  1. 加载 user_data.todos（过滤 completed=true）
  2. 筛选 estimatedMinutes <= availableMinutes
  3. 按优先级分组 [紧急, 一般, 低]
  4. 轮流选取 + 难度搭配 → 7个日程
  5. 随机抽取 CLASSIC_MICRO_TASKS → 2个小任务
  6. 交替合并 → 返回 Bingo 格式数组
  ↓
前端: selectedTasks.value = result → 棋盘渲染
  ↓
用户翻开卡片 → 完成涂抹
  ↓
handleBingoComplete(task):
  ├─ task.id 以 ddl_ 开头?
  │    → 本地标记 todo.completed = true
  │    → POST /api/tasks/ddl-complete { taskId: "ddl_xxx" }
  │    → 服务器回写 user_data.todos
  └─ 普通任务 → 原有逻辑
```

### 部署记录

- 前端构建：`npm run build:h5` → `DONE Build complete.`
- SCP 上传：`frontend.zip` → `/var/www/`，`backend.zip` → `/var/www/shiya/`
- SSH 解压部署 + PM2 重启：`shiya (id=8) online`

---

## [v0.9] 2026-06-09 — AI 批量删除功能修复（batchDelete 分支缺失）

### 变更概述
修复了 AI 对话中批量删除日程完全不可用的根因问题。用户说"删掉6.11的全部日程"后，AI 能正确识别意图并返回 `batchDelete` JSON，但前端始终不显示确认弹窗，AI 进入兜圈对话。

### 根因分析

```
用户: "删掉6.11的全部日程"
  → detectIntent → MANAGE_SCHEDULE
  → schedule-crud prompt → AI 返回 {"action":"batchDelete","targetIds":[...],"titles":[...]}
  → MANAGE_SCHEDULE handler 检查 crudAction.action
      ├─ "query"    → 查询分支 ✅
      ├─ "delete"   → 删除分支 ✅
      ├─ "update"   → 更新分支 ✅
      ├─ "batchDelete" → 无匹配！落入 else → chatModeStream（闲聊模式）❌
      └─ 结果：不存储 pending action，不发送 action_confirm SSE 事件
         → 前端 pendingConfirm 始终 null → 无确认弹窗 → AI 循环兜圈
```

`schedule-crud.txt` prompt 第17行定义了 `batchDelete` action：
```
4. 批量删除 → {"action":"batchDelete","targetIds":[id1, id2, ...],"titles":["标题1","标题2",...]}
```

但 `server.js` 的 MANAGE_SCHEDULE handler 从未处理该 action 分支。所有 batchDelete 请求都落入 `else` 的 `chatModeStream`，走闲聊模式。

### 修复内容

| 文件 | 变更 |
|------|------|
| `deploy/server.js` → MANAGE_SCHEDULE handler | 新增 `batchDelete` 分支（~50行）：验证 targetIds 是否真实存在 → 存入 `pendingActions` Map → 发送 `action_confirm` SSE 事件（含 targetIds、titles、count） → 生成自然语言确认消息。无匹配时回退到搜索模式列出候选项 |

### batchDelete 处理流程（修复后）

```
AI 返回 {"action":"batchDelete","targetIds":[-1428513238,-1432486408,...]}
  ↓
MANAGE_SCHEDULE handler → batchDelete 分支
  ↓
验证：targetIds.filter(t => currentTodos中是否存在)
  ├─ matchedTodos.length === 0
  │   → thinking: "⚠️ 未找到匹配的日程"
  │   → chatModeStream: "没找到匹配的日程"
  └─ matchedTodos.length > 0
      → pendingActions.set(pendingKey, { action: 'batchDelete', targetIds, titles })
      → thinking: "⚠️ 确认批量删除 N 条日程"
      → sendSSEventRaw('action_confirm', { action: 'batchDelete', targetIds, titles, detail, count })
      → chatModeStream: "确认删除以下 N 条日程：xxx、yyy？"
      ↓
前端收到 action_confirm → pendingConfirm = { action: 'batchDelete', ... }
      → 确认卡片显示
      ↓
用户点击 [确认] → handleConfirmActionApi → POST /api/confirm-action
      → 服务器执行批量删除 → schedule_batch_deleted SSE → 前端同步
```

### 相关已有基础设施

以下组件在 v0.8 已实现，batchDelete 分支建成后自动接通：

| 组件 | 文件 | 状态 |
|------|------|------|
| `/api/confirm-action` batchDelete 处理 | `deploy/server.js` line 705-737 | ✅ 已有 |
| SSE 确认执行 batchDelete | `deploy/server.js` line 2805-2839 | ✅ 已有 |
| 前端 `action_confirm` 事件处理（含 targetIds） | `src/pages/index/index.vue` line 4626-4641 | ✅ 已有 |
| 前端 `schedule_batch_deleted` 事件处理 | `src/pages/index/index.vue` line 4665-4669 | ✅ 已有 |
| 前端 `handleConfirmActionApi` batchDelete 响应 | `src/pages/index/index.vue` | ✅ 已有 |
| 手动批量删除 UI（多选 + 浮动按钮） | `src/components/ScheduleTab.vue` | ✅ 已有 |

### 部署记录

- 前端构建：`npm run build:h5` → `DONE Build complete.`
- SCP 上传：`frontend.zip` → `/var/www/`，`backend.zip` → `/var/www/shiya/`
- SSH 解压部署 + PM2 重启：`shiya (id=8) online`

---

## [v0.5] 2026-06-08 — 日程数据格式统一（手动 ↔ AI 互通）

### 变更概述
统一手动创建和 AI 生成的日程字段格式，确保两者在日程列表中展示一致、可互相编辑。AI 任务拆解的子任务现在完全兼容手动创建的日程格式。

### 后端改动

**`deploy/server.js` → `saveScheduleToDB()`**
- 新增 `difficulty` 字段（从 priority 推断：4-5→hard, 3→medium, 1-2→easy）
- 新增 `estimatedTime` 字段（与 `estimatedMinutes` 并存）
- `startTime`/`endTime` 改为完整日期时间串（`startDate + ' ' + startTime`）

### 前端改动

**`src/pages/index/index.vue`**
- `task_split` 事件处理：子任务 todo 新增 `difficulty`、`estimatedTime`、`startTime`/`endTime`（从 startDate/deadline 解析）
- `schedule` 事件处理：日程 todo 新增 `difficulty`、`estimatedTime`，`startTime`/`endTime` 组合为完整日期时间串
- `handleAddTask`：手动创建也补充 `estimatedMinutes`、`startDate`/`endDate`（从 startTime 解析）
- `handleEditTask`：编辑保存时同步补充 `estimatedMinutes`、`startDate`/`endDate`
- `startEditTask`：编辑 AI 任务时自动映射数字 priority 为 `'urgent'`/`'normal'`，`estimatedTime` 回退到 `estimatedMinutes`

**`src/components/ScheduleTab.vue`**
- 字符串 priority（`'urgent'`）也显示红色徽章，不仅限数字 priority

### AI 字段推断规则

| AI 输出 | 前端标准化 |
|---------|-----------|
| priority=4-5 | difficulty=`hard` |
| priority=3 | difficulty=`medium` |
| priority=1-2 | difficulty=`easy` |
| startDate + startTime | startTime=`"YYYY-MM-DD HH:MM"` |

---

## [v0.4] 2026-06-08 — 思考流程可视化（ThinkingPanel）

### 变更概述
参考 Data-Agent-main 设计，新增动画思考面板，展示 AI 的推理步骤和工具调用过程。替代了原来简单的文本步骤列表。

### 新增文件

| 文件 | 用途 |
|------|------|
| `src/components/ThinkingPanel.vue` | 折叠式思考面板：步骤时间线（running/completed/error dot）、工具调用卡片（tool-call-card）、blink/pulse/slide 动画 |

### 修改文件

| 文件 | 变更 |
|------|------|
| `src/components/ChatSidebar.vue` | 历史消息和当前 typing 状态的思考展示均替换为 `<ThinkingPanel>` |
| `src/pages/index/index.vue` | `processNormalChat` 中 thinking step 数据增加 `status`（running/completed）和 `toolCall` 对象；`task_split`/`schedule` 事件推送工具调用卡片 |

### ThinkingPanel 特性

- 折叠标题：活跃时显示旋转 spinner + "正在处理..."，完成时显示绿色勾 + "处理完成"
- 步骤时间线：每步有状态 dot（running 蓝脉冲 / completed 绿勾 / error 红叉），连接线渐变
- 工具调用卡片：展示工具名、状态、详情，running 时有滑动进度条
- CSS 动画：`spin`、`pulse-dot`、`text-blink`、`loader-slide`

---

## [v0.3] 2026-06-08 — 意图路由 + 工具调用展示 + 日程落地

### 变更概述
引入了**意图识别预检测**（pre-flight intent detection），让 Agent 在流式回复前先判断用户意图并路由到对应 System Prompt。日程/日记不再是纯文本回复，而是真正写入数据库。

### 后端改动

#### 新增函数（`deploy/server.js`）

| 函数 | 用途 |
|------|------|
| `sendSSEventRaw(res, type, data)` | 无延迟 SSE 推送 |
| `sendMessageChunk(res, content)` | 流式消息逐字推送 |
| `detectIntent(content)` | 调用 DeepSeek 识别用户意图，返回 `SCHEDULE/DIARY/TASK/CHAT` |
| `saveScheduleToDB(pool, userId, data)` | 日程 JSON → 读现有 todos → 追加 → 写回 `user_data` 表 |
| `saveDiaryToDB(pool, userId, data)` | 日记 JSON → 读现有 diaryEntries → 追加 → 写回 `user_data` 表 |
| `streamDeepSeekToSSE(res, messages)` | 通用流式转发函数 |
| `chatModeStream(res, pool, userId, sessionId, content)` | 闲聊模式完整流程（构建历史 → 流式 → 保存 → 解析 task_split） |

#### 重写端点

**`POST /api/chat/deepseek`** — 从"普通聊天"升级为**意图路由中控**：

```
用户消息
  ↓
阶段1: thinking → "正在理解你的意图..."
  ↓
detectIntent() (1次轻量 DeepSeek 调用)
  ↓
┌─ SCHEDULE → 日程 System Prompt → 解析 JSON → saveScheduleToDB → 流式确认
├─ DIARY    → 日记 System Prompt → 解析 JSON → saveDiaryToDB → 流式确认
├─ TASK     → 任务拆解 System Prompt → 流式输出
└─ CHAT     → 闲聊 System Prompt → 流式输出 → 尝试后解析 task_split
```

#### 更新的 Prompt

- `deploy/prompts/schedule.txt` — 添加 `{user_input}` 模板变量，重复周期字段
- `deploy/prompts/diary.txt` — 添加 `{user_input}` 模板变量，规范 mood 选项

### 前端改动

- `src/pages/index/index.vue` — `schedule`/`diary` SSE 事件处理器构建规范的 todo/diary 对象格式，确保与现有数据兼容

### SSE 事件流（完整）

用户在聊天时可以看到的事件序列：

```
event: thinking → {step: 1, text: "正在理解你的意图...", icon: "🧠"}
event: thinking → {step: 2, text: "识别到日程意图，正在解析时间...", icon: "📅"}
event: thinking → {step: 3, text: "日程已保存到数据库", icon: "✅"}
event: schedule  → {action: "create", data: {title, date, time, ...}}
event: message   → {content: "已经帮你记录..."}   (流式逐词)
event: done      → {sessionId: "..."}
```

---

## [v0.2] 2026-06-08 — 多轮对话 + 会话管理

### 变更概述
补全了对话历史存储和多轮上下文传递，并实现了会话的创建、切换、删除管理。

### 新增文件

| 文件 | 用途 |
|------|------|
| `server/services/conversation.js` | 对话历史管理：`buildMessagesForDeepSeek`、`saveAssistantMessage`、Token 裁剪（40条软限 → 80K硬限 → 压缩摘要） |
| `server/migrations/conversation_tables.sql` | `conversation_sessions` + `conversation_messages` 建表 |
| `server/routes/conversations.js` | 会话 CRUD：列表、改名、删除、查消息历史 |
| `src/components/ConversationList.vue` | 会话列表面板（新建/切换/删除） |
| `src/utils/messageAccumulator.js` | SSE 消息累积器，支持 TASK_SPLIT/SCHEDULE/DIARY 分段 |

### 修改文件

| 文件 | 变更 |
|------|------|
| `deploy/server.js` | 挂载 conversations 路由 |
| `src/components/ChatSidebar.vue` | 集成会话列表切换入口 |
| `src/pages/index/index.vue` | 会话切换/新建/删除事件处理 |
| `src/utils/api.js` | 新增 4 个会话 API 方法 |

### Token 控制策略

```
消息数 > 40
  → Stage 1: 保留最近 30 条
    → Token 仍 > 80K
      → Stage 2: 最旧 75% 压缩为摘要，保留最近 25% 原文
```

---

## [v0.1] 2026-06-08 — DeepSeek 迁移 + 任务拆解 + Bingo 联动

### 变更概述
将 Agent 后端从 **Dify/豆包** 迁移至 **DeepSeek API** 统一引擎，新增任务拆解功能并与 Bingo 棋盘联动。

### AI 引擎

- 所有 AI 调用统一走 DeepSeek API (`https://api.deepseek.com/v1/chat/completions`)
- 通过 6 套 System Prompt 切换模式：chat / schedule / diary / class / task-split / task-chat
- 支持 SSE 流式输出

### 新增文件

| 文件 | 用途 |
|------|------|
| `deploy/services/deepseek.js` | DeepSeek API 封装（流式 `callDeepSeekStream` + 非流式 `callDeepSeek`） |
| `deploy/services/conversation.js` | 对话历史管理 |
| `deploy/prompts/` (6个 txt) | System Prompt 模板 |
| `deploy/prompts/index.js` | Prompt 加载器 + 模板变量替换 |
| `deploy/routes/tasks.js` | 任务 CRUD + 拆解 + Bingo 池 |
| `deploy/migrations/tasks_table.sql` | `agent_tasks` + `agent_task_history` 建表 |
| `deploy/migrations/conversation_tables.sql` | 对话表建表 |
| `src/components/TaskSplitCard.vue` | 任务拆解卡片（勾选/加入列表/导入 Bingo） |
| `src/utils/sse.js` | 通用 SSE 解析器 |
| `src/utils/messageAccumulator.js` | 消息累积器 |

### 修改文件

| 文件 | 变更 |
|------|------|
| `deploy/server.js` | 引入 DeepSeek + 任务路由 + `/api/chat/deepseek` |
| `src/utils/api.js` | 新增 7 个任务 API + `chatWithDeepSeek` |
| `src/components/BingoBoard.vue` | 新增"🤖 AI任务"按钮 |
| `src/components/BingoCard.vue` | 新增 DDL 红色标签 |
| `src/pages/index/index.vue` | `processNormalChat` 改用 `chatWithDeepSeek` |

### 安全

- `deploy/.env` 含 `DEEPSEEK_API_KEY`，已加入 `.gitignore`
- 前端不接触任何 API Key

---

## [v0.6] 2026-06-09 — 日程增删改查全链路修复 + ID 幻觉防护

### 变更概述
修复了 Agent 日程管理（MANAGE_SCHEDULE 模式）中三个关键 Bug：确认按钮不发送消息、schedule-crud prompt 文件部署路径错误、AI 返回不存在的 ID 导致删除失败。首次通过**服务器端 ID 存在性验证**防御 LLM 幻觉。

参考了 [Data-Agent-main](https://github.com/) 项目中 ReAct Agent 的数据操作模式，借鉴了其"工具调用结果验证 + 安全确认"的架构思想。

### 问题定位过程

#### 问题 1：确认按钮无效
- **现象**：Agent 弹出"确认删除"卡片，但点击确认后无反应
- **定位**：`handleConfirmAction` 同时 `emit('confirm')` 和 `emit('sendMessage')`，前者触发的旧流程设置 `isTyping=true`，拦截了后者的"确认"消息发送
- **日志证据**：消息从未到达后端，pendingActions 中的操作永远不执行

#### 问题 2：schedule-crud.txt 部署到错误路径
- **现象**：[Prompts] 无法加载 schedule-crud → 模板为空 → AI 返回自然语言 → JSON 解析失败 → fallback 闲聊
- **根因**：`cp -rf prompts/ deploy/prompts/` 在 deploy/prompts 已存在时将整个目录作为子目录复制，导致文件实际位于 `deploy/prompts/prompts/schedule-crud.txt`
- **修复**：`cp -rf prompts/* deploy/prompts/`（DEPLOY.md 也同步修正）

#### 问题 3：AI 幻觉 ID（核心 Bug）
- **现象**：AI 返回 `{"action":"delete","targetId":1780979028878}`，但数据库中无此 ID
- **定位**：直接查询 MySQL → `user_data` 表中 userId=3 有 14 个 todo，ID 为 `-1432418853`, `1780978884991` 等，`1780979028878` 不存在
- **根因**：LLM 看到日程列表中的 ID 是 `Date.now()` 时间戳，试图"推测"合理值但猜错。`deleteTodoFromDB` 返回 `not_found` 但错误信息未明确传递到前端
- **Data-Agent-main 对比**：Data-Agent-main 使用工具调用（Tool Use）而非 LLM 自由生成 JSON 来获取 ID，从根本上避免了幻觉问题

### 修复方案

#### 三层防线（借鉴 Data-Agent-main 的验证思想）

```
Layer 1: Prompt 强化
  → schedule-crud.txt 明确警告 ID 可能是负数，必须原样复制
  → 不确定时返回 action="query" 而非猜测

Layer 2: 存储前验证（schedule-crud 解析后，pendingActions.set 前）
  → 检查 targetId 是否存在于 currentTodos
  → 不存在 → 回退为搜索模式，列出候选项让用户选

Layer 3: 执行时二次验证（确认执行 deleteTodoFromDB 前）
  → 重新加载 todos 确认目标仍存在
  → 防止：确认期间被并发删除
```

#### 具体文件改动

| 文件 | 变更 |
|------|------|
| `deploy/prompts/schedule-crud.txt` | 重写 prompt：注入 `{current_date}` 和 `{current_weekday}` 上下文；新增 `dateLabel` 字段匹配口语化日期（"6.12"→"06-12"）；强化 ID 精确复制警告；添加删除/修改 action 的 `title` 字段回传 |
| `deploy/server.js` → MANAGE_SCHEDULE 模式 | 新增 `targetExists` 验证（约 2818 行）；ID 不存在时回退为关键词搜索 + `schedule_list` SSE；确认执行侧新增二次验证（约 2437 行） |
| `deploy/server.js` → 确认执行 | `update` 操作新增 DDL 同步：`syncTodoToAgentTask`（约 2462 行）；`delete` 操作新增 DDL 同步：`syncAgentTaskToSchedule`（约 2443 行） |
| `src/components/ChatSidebar.vue` → `handleConfirmAction` | 修复确认按钮 Bug：CRUD 场景下跳过旧流程 `emit('confirm')`，仅通过 `emit('sendMessage')` 发送"确认"到 SSE |
| `src/components/ChatSidebar.vue` → `handleCancelConfirm` | 修复取消按钮：新增 `emit('sendMessage', { text: '取消' })` 通知后端释放 pending |
| `DEPLOY.md` | 所有 `cp -r prompts deploy/prompts` 改为 `cp -rf prompts/* deploy/prompts/`，防止嵌套目录问题 |

#### 数据库表结构（确认）

```
user_data 表（userId=3, data_type='todos'）：
  content 列类型：JSON（MySQL JSON 类型，驱动自动解析为 Array）
  todo 示例：
    { id: -1432418853, text: "阅读理解", startDate: "2026-06-09", 
      priority: 4, difficulty: "hard", estimatedMinutes: 60 }
  
agent_tasks 表：
  id, user_id, title, description, parent_id, session_id,
  ddl_date (DATE), estimated_minutes, priority, status
```

### 待改进（借鉴 Data-Agent-main）

| 方向 | Data-Agent-main 做法 | shiya 现状 | 差距 |
|------|---------------------|-----------|------|
| **ID 传递** | Tool Use 强制 LLM 传参，参数由工具自身从数据库获取 | LLM 自由文本 JSON 输出 ID | 易幻觉 |
| **JSON 解析** | `PlannerResponseParser` 有多层 try-catch + 字段级验证 | 单层 try-catch + 正则兜底 | 脆弱 |
| **写入确认** | `executeNonSelectSql` → `WriteExecutionApprovalStore` → 前端 confirm | `pendingActions` Map + `isConfirmationMessage` | 需完善 |
| **批量操作** | 不支持（每次一个 SQL） | 不支持（每次一个 todo） | 均缺失 |
| **Schema 验证** | `ConversationWorkingMemoryValidator` 禁止模糊值 | 无 | 可借鉴 |

---

## [v0.7] 2026-06-09 — 确认按钮修复 + 修改功能修复 + 前端部署

### 变更概述
修复了增删改查流程中确认按钮点击无效和修改任务不生效的问题。根因为 SSE `done` 事件过早清除 `pendingConfirm`，导致确认卡片在用户能点击之前就消失。

### 问题定位

#### 问题：确认卡片秒消失
- **现象**：Agent 弹出"确认删除/修改"卡片后，卡片在 AI 说完话瞬间消失，用户无法点击按钮
- **定位**：`index.vue` line 4516 在 `done` 事件中无条件执行 `pendingConfirm.value = null`
- **影响范围**：删除和修改都受影响。用户只能再打字说"确认"来触发，违背了"点击按钮直接执行"的设计意图

#### 问题：按钮点击无效
- **根因**：同上。卡片消失后按钮不存在，用户点击无效，被迫打字
- **表现**：用户说"你删了吗" → AI 回复"我已经删了"（但实际上 pending action 从未被执行，因为卡片消失了）

### 修复内容

| 文件 | 变更 |
|------|------|
| `src/pages/index/index.vue` line 4516 | **移除** `pendingConfirm.value = null` — 卡片持续显示直到用户操作 |
| `src/pages/index/index.vue` line 4492 | **新增** `pendingConfirm.value = null` — 收到 `schedule_updated` 后清除 |
| `src/pages/index/index.vue` line 4496 | **新增** `pendingConfirm.value = null` — 收到 `schedule_deleted` 后清除 |

### 确认卡片生命周期（修复后）

```
action_confirm SSE 到达
  → pendingConfirm = { action, title, detail, targetId }  （卡片显示）
  → AI 自然语言回复 "确认删除「xxx」吗？"
  → done 事件 → isTyping=false, thinkingSteps=[]  （卡片仍在！）
  
用户点击 [确认删除]
  → handleConfirmAction
    → emit('cancelConfirmation') → pendingConfirm = null  （卡片消失）
    → emit('sendMessage', { text: '确认' })
    → SSE 「确认」请求 → 服务器执行 deleteTodoFromDB / updateTodoInDB
    → schedule_deleted / schedule_updated SSE → local 更新 + pendingConfirm = null（保险）

用户点击 [取消]
  → handleCancelConfirm
    → emit('cancelConfirmation') → pendingConfirm = null  （卡片消失）
    → emit('sendMessage', { text: '取消' })
    → SSE 「取消」请求 → 服务器释放 pendingActions
```

### 验证结果

| 检查项 | 结果 |
|--------|------|
| 删除 - 点击确认按钮 | 卡片立即消失 → 自动发送"确认" → 日程被删除 |
| 修改 - 点击确认按钮 | 同上流程 → 日程被更新 |
| 前端 HTTP | `https://shiya.yiywww.xyz/` → 200 |
| 后端 health | `/health` → `{"status":"ok"}` |

---

## [v0.8] 2026-06-09 — 数据同步策略重构：服务器权威 + 专用确认端点

### 变更概述
彻底解决"删除不执行"的根因问题。核心发现：`syncData()` 将本地所有 todos 全量上传到 `/api/save-data`，该端点使用 `ON DUPLICATE KEY UPDATE` 直接覆盖服务器数据。即使用户确认删除后服务器已清除记录，后续任何触发 `syncData()` 的代码都会把本地旧缓存（含已删项）重新上传，导致**数据反弹**。

### 根因分析

```
时间线：
  1. 用户说"删除明天的会议"
  2. processNormalChat → syncData() 上传本地 6 个 todos（含"明天的会议"）
  3. AI 生成 CRUD JSON → 服务器存储 pending → action_confirm 卡片显示
  4. 用户点击 [确认删除] → 服务器执行 deleteTodoFromDB → DB 中剩 5 个 todos
  5. 服务器发回 schedule_deleted SSE → 前端本地过滤掉该 todo

  ⚠️ 但此后任何 syncData() 调用：
  → 上传本地 todos（可能仍含已删项）→ /api/save-data 直接覆盖 → DB 又变回 6 个
  → 30s 定时拉取 /api/get-data → 发现 6 个 → 本地恢复 → 删除"反弹"
```

### 修复方案

#### 1. syncData() 不再上传 todos（前端）

**`src/pages/index/index.vue` → `syncData()`**

移除 `data.todos` 字段。日程增删改全部通过以下渠道完成，不需要本地全量上传：
- **创建**：SCHEDULE 意图 → SSE `schedule` 事件（服务器已通过 `saveScheduleToDB` 写入 DB）
- **更新**：MANAGE_SCHEDULE → 确认 → SSE `schedule_updated` 事件
- **删除**：MANAGE_SCHEDULE → 确认 → SSE `schedule_deleted` 事件 或 `/api/confirm-action`

服务器始终是数据的唯一权威来源。本地缓存仅供 UI 展示，通过以下两个渠道同步：
- 30s 定时器：`startServerSyncTimer()` → `/api/get-data` → `todos.value = result.data.todos`
- 每次对话后：`processNormalChat` → `loadDataFromServer()` → 同上

#### 2. 新增专用确认/取消端点（后端）

**`deploy/server.js`**

新增两个端点，绕过聊天 SSE 流程，直接执行待确认操作：

```
POST /api/confirm-action
  Body: { sessionId: string }
  逻辑：通过 pendingKey (userId_sessionId) 查找 pendingAction → 执行 → 返回结果
  返回：{ success, action, targetId, title, todo? }

POST /api/cancel-action  
  Body: { sessionId: string }
  逻辑：从 pendingActions Map 删除待确认项
  返回：{ success, message }
```

这些端点**不经过 DeepSeek、不流式输出、不检测意图**，是确定性的 CRUD 操作执行，消除了 SSE 竞态条件和意图识别误判的风险。

#### 3. 确认/取消按钮直连 API（前端）

**`src/components/ChatSidebar.vue`**

- `handleConfirmAction`：当 `pendingConfirm` 存在时，不再发送"确认"聊天消息，改为 `emit('confirmAction')`
- `handleCancelConfirm`：当 `pendingConfirm` 存在时，不再发送"取消"聊天消息，改为 `emit('cancelAction')`
- 新增 emits：`confirmAction`、`cancelAction`

**`src/pages/index/index.vue`**

- 新增 `handleConfirmActionApi`：调用 `POST /api/confirm-action` → 成功后本地更新 todos → 追加确认消息
- 新增 `handleCancelActionApi`：调用 `POST /api/cancel-action` → 追加取消消息
- 模板绑定：`@confirmAction="handleConfirmActionApi"`、`@cancelAction="handleCancelActionApi"`

#### 4. loadDataFromServer 修复

**`src/pages/index/index.vue` → `loadDataFromServer()`**

将 `uni.request` 包装为 Promise，确保 `await loadDataFromServer()` 真正等待请求完成后再继续。

#### 5. 确认流程增强日志

- 后端：`[确认流程] pendingKey=... hasPending=... isConfirm=...`
- 后端：`[确认API] deleteTodoFromDB 结果: ...`
- 前端：`[确认流程] processNormalChat 收到消息: ... isControlMsg: ... pendingConfirm: ...`
- 前端：`[确认流程] 收到 schedule_deleted: ... 当前 todos 数量: ...`

### 修改文件清单

| 文件 | 变更 |
|------|------|
| `deploy/server.js` | 新增 `/api/confirm-action` 和 `/api/cancel-action` 端点（~110行）；确认流程日志增强 |
| `src/pages/index/index.vue` | `syncData()` 移除 todos 上传；新增 `handleConfirmActionApi`/`handleCancelActionApi`；`loadDataFromServer` Promise 化；确认流程日志 |
| `src/components/ChatSidebar.vue` | 确认/取消按钮改 emit `confirmAction`/`cancelAction`；新增两个 emit 声明 |

### 数据流向（修复后）

```
┌──────────────┐     ┌─────────────────────────────────┐
│  前端 (缓存)  │     │  服务器 (MySQL, 权威)             │
├──────────────┤     ├─────────────────────────────────┤
│              │     │                                  │
│ 创建日程 ────→ SSE schedule 事件 ──→ saveScheduleToDB │
│ 删除日程 ────→ /api/confirm-action ──→ deleteTodoFromDB│
│ 修改日程 ────→ /api/confirm-action ──→ updateTodoInDB │
│              │     │                                  │
│ 定时拉取 ←─── /api/get-data ←─── loadTodosFromDB    │ (每30s)
│ 对话后拉取 ←─ /api/get-data ←─── loadTodosFromDB    │
│              │     │                                  │
│ ❌ 不再全量上传 todos 到 /api/save-data              │
│ ✅ 日记/重复任务 仍通过 /api/save-data 同步           │
└──────────────┘     └─────────────────────────────────┘
```

### 验证结果

| 检查项 | 结果 |
|--------|------|
| 前端构建 | `DONE Build complete.` |
| 后端部署 | `inflating: deploy/server.js` |
| PM2 重启 | `shiya (id=8) online` |
| 数据不反弹 | `syncData()` 不再覆盖 todos → 删除后不会恢复 |



| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/chat/deepseek` | 统一对话（SSE流式 + 意图路由） |
| POST | `/api/confirm-action` | 确认待执行操作（v0.8 新增） |
| POST | `/api/cancel-action` | 取消待执行操作（v0.8 新增） |
| POST | `/api/chat/stream` | 旧版 SSE 对话（保留兼容） |
| POST | `/api/chat` | 旧版非流式对话 |
| POST | `/api/save-data` | 前端同步数据（v0.8: todos 不再上传） |
| POST | `/api/tasks/split` | 任务拆解 |
| GET | `/api/tasks` | 任务列表 |
| PUT | `/api/tasks/:id` | 更新任务 |
| DELETE | `/api/tasks/:id` | 删除任务 |
| GET | `/api/tasks/bingo-pool` | Bingo 任务池 |
| POST | `/api/tasks/save-from-bingo` | Bingo 回写 |
| GET | `/api/conversations` | 会话列表 |
| POST | `/api/conversations/:id` | 更新会话标题 |
| DELETE | `/api/conversations/:id` | 删除会话 |
| GET | `/api/conversations/:id/messages` | 会话消息历史 |

## 部署步骤

详见 [DEPLOY.md](./DEPLOY.md)，核心步骤：

1. 构建前端：`npm run build:h5`
2. 打包前端：`Compress-Archive -Path "dist\build\h5\*" -DestinationPath "frontend.zip"`
3. 打包后端：`Compress-Archive -Path "deploy\server.js", "deploy\prompts\", "deploy\services\", "deploy\routes\" -DestinationPath "backend.zip"`
4. SCP 上传：`scp frontend.zip root@8.134.127.111:/var/www/` + `scp backend.zip root@8.134.127.111:/var/www/shiya/`
5. SSH 解压：
   - 前端 → `/var/www/frontend/`：`unzip -o frontend.zip -d frontend/`
   - 后端 → `/var/www/shiya/deploy/`：`unzip -o backend.zip && cp server.js deploy/...`
6. PM2 重启：`pm2 restart shiya`
7. 验证：`pm2 logs shiya` 确认 `DeepSeek API: 已配置`

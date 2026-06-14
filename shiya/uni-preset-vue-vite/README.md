# 拾鸦 (Shi Ya)

> 一只聪明体贴的乌鸦助手，陪你管理日程、记录日记、拆解任务。

## 项目简介

拾鸦是一款基于 AI 的个人日程与日记管理应用。以乌鸦宠物为载体，通过自然语言对话完成日程创建、日记记录、课表导入、任务拆解等操作。项目采用 **Vibe Coding** 理念设计，通过精心编排的 System Prompt 让单一 AI 引擎在不同场景下切换角色，实现"主脑 + 多副面孔"的架构。

- **地址**: https://shiya.yiywww.xyz


---

## 系统架构

```
┌─────────────────────────────────────────────────┐
│                前端 (uni-app H5)                  │
│   Vue 3 + Composition API + Tailwind CSS         │
│   3 Pages: Login / Register / Main               │
│   25 Components + SSE 流式对话                    │
└──────────────────┬──────────────────────────────┘
                   │ /api/* (Nginx 反向代理)
┌──────────────────▼──────────────────────────────┐
│         Express Server (Port 3004)               │
│                                                   │
│  ┌──────────────┐  ┌───────────────┐             │
│  │  DeepSeek    │  │   Dify Agent  │             │
│  │  (主引擎)    │  │   (辅助引擎)   │             │
│  └──────┬───────┘  └───────┬───────┘             │
│         │                  │                      │
│  ┌──────▼──────────────────▼──────────────┐      │
│  │       Prompt 模板管理器 (7种模式)        │      │
│  │  chat | schedule | diary | class       │      │
│  │  task-split | task-chat | schedule-crud│      │
│  └────────────────┬───────────────────────┘      │
│                   │                               │
│  ┌────────────────▼───────────────────────┐      │
│  │          MySQL 数据库                   │      │
│  │  users | user_data | crow_data          │      │
│  │  conversation_sessions/messages         │      │
│  │  agent_tasks | study_plans | ...        │      │
│  └────────────────────────────────────────┘      │
└──────────────────────────────────────────────────┘
```

### 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | uni-app 3.0 + Vue 3.4 + Vite 5.2 |
| 样式 | Tailwind CSS 3.4 + Lucide Icons |
| 后端 | Node.js + Express 4.18 |
| 数据库 | MySQL 8.0 (mysql2/promise) |
| AI 引擎 | DeepSeek API (`deepseek-chat`) |
| 认证 | JWT (jsonwebtoken + bcrypt) |
| 部署 | Nginx 反向代理 + PM2 进程守护 |

### 目录结构

```
uni-preset-vue-vite/
├── src/                          # 前端源码
│   ├── pages/
│   │   ├── index/index.vue       # 主页面 (单文件组件，~810行)
│   │   ├── login/login.vue       # 登录页
│   │   └── register/register.vue # 注册页
│   ├── components/               # 25 个 Vue 组件
│   │   ├── Crow.vue              # 乌鸦宠物核心互动
│   │   ├── ChatSidebar.vue       # AI 对话侧边栏
│   │   ├── ScheduleTab.vue       # 日程管理
│   │   ├── DiaryTab.vue          # 日记展示
│   │   ├── CourseTable.vue       # 课表视图
│   │   ├── TaskSplitCard.vue     # 任务拆解卡片
│   │   ├── BingoBoard.vue        # Bingo 游戏面板
│   │   └── ...
│   ├── utils/
│   │   ├── api.js                # API 请求封装 (JWT + SSE)
│   │   └── sse.js                # 通用 SSE 流式解析器
│   └── App.vue                   # 应用入口
├── server/                       # 后端源码
│   ├── server.js                 # 主服务 (~3850行)
│   ├── routes/
│   │   ├── tasks.js              # 任务 & Bingo 路由
│   │   └── conversations.js      # 对话会话管理
│   ├── services/
│   │   ├── deepseek.js           # DeepSeek API 封装
│   │   └── conversation.js       # 对话历史管理 (裁剪/摘要)
│   ├── prompts/                  # System Prompt 模板
│   │   ├── index.js              # Prompt 管理器
│   │   ├── chat.txt              # 乌鸦主角色
│   │   ├── schedule.txt          # 日程解析
│   │   ├── task-split.txt        # 任务拆解
│   │   ├── diary.txt             # 日记助手
│   │   ├── class.txt             # 课表分析
│   │   └── task-chat.txt         # 任务对话
│   └── migrations/               # 数据库迁移脚本
├── deploy/                       # 生产部署文件
├── docs/                         # 设计文档
│   ├── architecture.md           # 系统设计要点
│   ├── deployment.md             # 部署指南
│   ├── agent-changelog.md        # Agent 变更日志
│   └── ...
├── archive/                      # 归档 (不纳入版本管理)
│   ├── deploy-packages/          # 历史部署包
│   ├── old-pages/                # 旧版本页面源码
│   └── temp/                     # 临时文件
├── vite.config.js
└── package.json
```

---

## 核心 Prompt 设计 & Vibe Coding 思路

### 设计理念

项目摈弃了"一个功能一个模型"的传统做法，采用 **单一 DeepSeek 引擎 + 7 套 System Prompt** 的架构。核心思路：

> **不是让 AI 执行指令，而是让 AI 理解意图。**

### Prompt 模板体系

所有 prompt 以 `.txt` 文件存放于 `server/prompts/`，由 `index.js` 统一加载替换变量后注入 AI 调用上下文。

| Prompt 文件 | 模式 | AI 角色 | 核心职责 |
|------------|------|---------|---------|
| `chat.txt` | chat | 拾鸦本体 | 识别意图、主动追问、调度子模式 |
| `schedule.txt` | schedule | 日程管家 | 自然语言时间→结构化日程 JSON |
| `schedule-crud.txt` | schedule-crud | 日程操作 | 已有日程的查询/修改/删除 |
| `task-split.txt` | task-split | 任务拆解师 | 大任务→5-30分钟子任务 |
| `task-chat.txt` | task-chat | 任务助手 | 查询操作已有任务列表 |
| `diary.txt` | diary | 日记助手 | 日记创建/情感分析 |
| `class.txt` | class | 课表分析 | OCR文本→结构化课表 |

### Vibe Coding 关键设计

#### 1. 主动追问机制 (chat.txt)

```
当用户说"写论文"、"备战考试"等模糊大任务时：
  → AI 先创建大任务日程作为占位
  → 主动追问：截止日期？预估耗时？需要拆解吗？
  → 追问话术带有乌鸦风格："这个任务看起来不小嘎！
    我先帮你记下来。不过具体要拆成哪些步骤呢？"
```

这实现了**从"被动响应"到"主动引导"**的转变——AI 不只是回答问题，而是像一个真正的助手一样帮用户理清思路。

#### 2. 结构化输出约束

每个 prompt 都要求 **只返回 JSON，不返回 Markdown 或其他格式**。前端通过 `type` 字段分发：

```
{ "type": "TASK_SPLIT", "data": { ... } }  → TaskSplitCard 组件渲染
{ "type": "SCHEDULE",   "data": { ... } }  → 写入日程列表
{ "type": "DIARY",      "data": { ... } }  → 创建日记条目
{ "type": "CHAT",       "data": "..."   }  → 纯文本气泡渲染
```

后端 `server.js` 在 SSE 流完成后自动解析 JSON，按类型分发事件给前端，无需额外 NLU。

#### 3. 上下文注入策略

- **时间锚定**: `{current_date}`、`{current_weekday}`、`{current_time}` 在每次调用时实时注入，消除 AI 对"今天"的幻觉
- **任务上下文**: `{tasks_json}` 注入当前用户的所有待办
- **乌鸦状态**: `{crowStats.hunger}`、`{crowStats.mood}` 注入宠物状态

#### 4. Prompt 渐进增强

项目存在 `server/prompts/` 和 `deploy/prompts/` 两套 prompt：
- `server/` 版：精简 prompt，适合快速原型
- `deploy/` 版：增强 prompt，增加了详细的时间推算规则、安全阈值（如批量删除上限20条）、防误操作设计（ID 精确匹配）

#### 5. 安全防御设计

- 批量删除日程时，匹配超过 20 条先输出 query 让用户确认
- ID 匹配要求"原样复制"，防止因为 ID 为负数导致误判
- 对话历史裁剪确保不在 user-assistant pair 中间切割

---

## AI 调用逻辑

### 调用链路

```
用户输入 (ChatSidebar)
    │
    ▼
api.chatWithDeepSeek({ message, mode, sessionId })
    │
    ▼ POST /api/chat/deepseek
    │
    ▼
server.js 路由处理
    │
    ├─ JWT 认证 (authMiddleware)
    ├─ 会话复用/创建 (sessionId)
    ├─ 获取任务上下文 (agent_tasks)
    │
    ├─ getSystemPrompt(mode, context)
    │   └─ 加载对应 .txt 文件
    │   └─ 注入 {tasks_json} {current_date} 等变量
    │
    ├─ buildMessagesForDeepSeek(pool, userId, sessionId, systemPrompt, userMessage)
    │   ├─ LOAD 历史消息 (conversation_messages)
    │   ├─ LOAD 已有摘要 (conversation_sessions)
    │   ├─ PRUNE 两阶段裁剪
    │   └─ BUILD [system + history + current]
    │
    ├─ callDeepSeekStream(systemPrompt, messages, callbacks)
    │   └─ fetch → SSE 逐 token 推送
    │
    ├─ saveAssistantMessage() 持久化
    ├─ 更新会话元数据 (title, message_count, token_count)
    │
    └─ SSE 事件推送到前端
        ├─ event: token   → 逐字渲染
        ├─ event: done    → 最终解析 & sessionId 持久化
        └─ event: error   → 错误提示
```

### 对话历史管理 (conversation.js)

DeepSeek 支持 128K context 窗口，为高效利用：

**两阶段裁剪策略：**

| 阶段 | 条件 | 行为 |
|------|------|------|
| Stage 1 (数量软限制) | 消息 > 40 条 | 保留最近 30 条 |
| Stage 2 (Token 硬限制) | Token > 80,000 | 保留最近 25% 原文 + 其余压缩为摘要 |

**Token 估算公式**：中文 ~1.5 字/token，英文 ~4 字/token（保守估计）

**防切割保护**：`findCleanSplitPoint()` 确保裁剪边界始终在 user-assistant pair 之间，不会出现孤立的单条消息。

**摘要累积**：裁剪产生的摘要会写入 `conversation_sessions` 表，多次裁剪产生多层嵌套摘要 `[更早的对话] → [最近的对话]`，确保上下文不丢失。

### API 端点一览

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/register` | 用户注册 |
| POST | `/api/login` | 用户登录 (返回 JWT) |
| GET | `/api/user` | 获取用户信息 |
| POST | `/api/chat/deepseek` | DeepSeek 流式对话 (SSE) |
| POST | `/api/chat` | Dify Agent 非流式对话 |
| POST | `/api/chat/stream` | Dify Agent 流式对话 |
| POST | `/api/analyze-course` | 豆包视觉课表 OCR |
| POST | `/api/save-data` | 通用数据保存 (CRUD) |
| GET | `/api/get-data` | 获取用户全量数据 |
| POST | `/api/tasks/split` | 任务拆解 |
| POST | `/api/tasks/*` | 任务 CRUD / Bingo / DDL / 成就 |
| POST | `/api/conversations/*` | 会话列表 / 重命名 / 删除 |

---

## 部署步骤

### 环境要求

- Node.js 18+
- MySQL 8.0
- Nginx
- PM2 (推荐)

### 1. 克隆与安装

```bash
git clone <repo-url>
cd uni-preset-vue-vite

# 安装前端依赖
npm install

# 安装后端依赖
cd server
npm install
cd ..
```

### 2. 构建前端

```bash
npm run build:h5
```

构建产物输出到 `dist/build/h5/`，复制到 `deploy/` 目录。

### 3. 配置环境变量

在 `server/` (或 `deploy/`) 目录创建 `.env` 文件：

```env
# 服务器
PORT=3004

# 数据库
DB_HOST=127.0.0.1
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=shiya

# JWT
SECRET_KEY=your-secret-key

# DeepSeek AI
DEEPSEEK_API_KEY=sk-xxxxx
DEEPSEEK_API_URL=https://api.deepseek.com/v1/chat/completions

# Dify (可选)
DIFY_API_KEY=app-xxxxx
DIFY_API_URL=https://api.dify.ai/v1

# 豆包视觉 (课表 OCR)
DOUBAO_VISION_API_KEY=xxxxx

# 阿里云 OSS (图片存储)
OSS_ACCESS_KEY_ID=xxxxx
OSS_ACCESS_KEY_SECRET=xxxxx
OSS_BUCKET=your-bucket
OSS_REGION=oss-cn-hangzhou

# 腾讯文档集成 (可选)
QQ_DOCS_CLIENT_ID=xxxxx
QQ_DOCS_CLIENT_SECRET=xxxxx
QQ_DOCS_REDIRECT_URI=https://shiya.yiywww.xyz/oauth/callback
```

### 4. 初始化数据库

```bash
mysql -u root -p shiya < server/migrations/conversation_tables.sql
mysql -u root -p shiya < server/migrations/tasks_table.sql
mysql -u root -p shiya < server/migrations/crow_data.sql
```

### 5. DNS 配置

将域名 `shiya.yiywww.xyz` 的 A 记录指向服务器 IP `8.134.127.111`：

```
类型   主机记录   记录值           TTL
A     shiya      8.134.127.111   600
```

### 6. Nginx 配置

```nginx
server {
    listen 80;
    server_name shiya.yiywww.xyz;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name shiya.yiywww.xyz;

    # SSL 证书 (Let's Encrypt / certbot)
    ssl_certificate     /etc/nginx/ssl/shiya.yiywww.xyz.pem;
    ssl_certificate_key /etc/nginx/ssl/shiya.yiywww.xyz.key;

    # 前端静态文件
    root /path/to/shiya/deploy;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # API 反向代理
    location /api/ {
        proxy_pass http://127.0.0.1:3004;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SSE 流式响应关键配置
        proxy_buffering off;
        proxy_cache off;
        proxy_set_header Connection '';
        chunked_transfer_encoding off;

        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }
}
```

### 7. HTTPS 证书配置

使用 Let's Encrypt (certbot) 申请免费 SSL 证书：

```bash
# 安装 certbot (Ubuntu/Debian)
sudo apt install certbot

# 申请证书
sudo certbot certonly --webroot \
  -w /path/to/shiya/deploy \
  -d shiya.yiywww.xyz

# 自动续期 (crontab)
0 0 1 * * certbot renew --quiet --nginx
```

### 8. 启动服务

```bash
# 使用 PM2 守护后端进程
cd server
pm2 start server.js --name shiya-server

# 或直接启动
node server.js
```

### 9. 验证部署

```bash
# 检查后端
curl https://shiya.yiywww.xyz/api/health

# 检查前端
curl -I https://shiya.yiywww.xyz/

# 验证 SSE 流式响应
curl -N -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"message":"你好","mode":"chat"}' \
  https://shiya.yiywww.xyz/api/chat/deepseek
```

---

## 关键设计决策记录

| 决策 | 原因 |
|------|------|
| 单一 DeepSeek 替代多模型 | 降低成本和复杂度，通过 System Prompt 切换实现角色分离 |
| 两阶段对话裁剪 | 40 条软限制 + 80K Token 硬限制，兼顾上下文完整性和成本 |
| 摘要压缩替代简单截断 | 保留早期对话的语义信息，避免上下文断裂 |
| SSE 流式 + `X-Accel-Buffering: no` | 确保 Nginx 不缓冲，实现逐字实时渲染 |
| prompt 纯 JSON 输出 | 前端可直接解析，无需额外 NLU 层 |
| bcryptjs (deploy) 替代 bcrypt | deploy 版用纯 JS 实现，避免服务器 C++ 编译依赖 |
| 时间自动注入 | 消除 AI 对"今天/明天"的日期幻觉 |

---

## License

MIT

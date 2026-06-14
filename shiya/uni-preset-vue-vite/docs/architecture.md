# 拾鸦（Shi Ya）系统设计要点

## 1. 项目概述

### 1.1 项目定位
拾鸦是一款基于AI的个人日程、日记管理应用，通过智能助手（乌鸦形象）为用户提供多模态交互体验。

### 1.2 核心价值
- **智能助手**: 基于豆包大模型的多轮对话能力
- **多模态交互**: 支持文本、图片输入
- **游戏化设计**: 乌鸦宠物养成系统
- **跨平台部署**: 支持H5、微信小程序、App等多端

---

## 2. 系统架构

### 2.1 整体架构
```
┌─────────────────┐
│   前端层        │  uni-app + Vue 3 + Tailwind
└────────┬────────┘
         │
┌────────▼────────┐
│   API网关层     │  Express.js
└────────┬────────┘
         │
┌────────▼────────┐
│   业务逻辑层    │  主脑调度 + 工具模型
└────────┬────────┘
         │
┌────────▼────────┐
│   数据层        │  MySQL
└─────────────────┘
```

### 2.2 技术栈

| 层级 | 技术选型 |
|------|----------|
| 前端框架 | uni-app 3.0 + Vue 3.4 |
| 样式框架 | Tailwind CSS 3.4 |
| 后端框架 | Express.js |
| 数据库 | MySQL 8.0 |
| 认证方式 | JWT (jsonwebtoken) |
| AI服务 | 字节跳动豆包API |
| 构建工具 | Vite 5.2 |

---

## 3. 核心模块设计

### 3.1 用户认证模块

**文件位置**: `server/server.js:73-173`

**设计要点**:
- 使用 bcrypt 进行密码哈希加密（salt round: 10）
- JWT Token 有效期 7 天
- 支持用户名/邮箱双重登录
- 注册时自动初始化用户数据（todos、diaryEntries、crow_data）

**数据库表**: users
```sql
id (主键)
username (唯一)
email (唯一)
password (哈希)
created_at
```

---

### 3.2 AI 主脑调度系统

**文件位置**: `server/server.js:393-568`

**设计要点**:
- **意图识别**: 主脑模型分析用户请求，识别用户意图
- **工具调度**: 根据意图调用对应的专门模型
- **上下文优化**: 
  - 限制消息历史为最近5条
  - 只传递用户数据摘要而非完整数据
- **响应格式**: 
  ```
  [内部深度思考]
  1. 需求理解：xxx
  2. 模型调度：xxx
  [思考结束]
  [最终回复]
  自然语言回复
  ```

**工具模型**:

| 工具名称 | 功能描述 | 模型 |
|----------|----------|------|
| SCHEDULE_MANAGER | 日程增删改查 | doubao-1-5-lite-32k |
| DIARY_MANAGER | 日记管理（支持图片） | doubao-seed-1-6-vision |
| CHAT_ASSISTANT | 日常对话 | doubao-seed-character |
| COURSE_ANALYZER | 课表图片解析 | doubao-1-5-vision-pro |

---

### 3.3 数据存储模块

**文件位置**: `server/server.js:213-375`

**设计要点**:
- 使用 KV 存储模式 (user_data 表)
- 支持的数据类型: todos, diaryEntries, repeatTasks, completedTasks, courseSchedule
- 乌鸦数据独立存储 (crow_data 表)
- 使用 ON DUPLICATE KEY UPDATE 实现 upsert 操作

**数据库表**: user_data
```sql
user_id (外键)
data_type (ENUM)
content (JSON)
UNIQUE KEY (user_id, data_type)
```

---

### 3.4 流式响应（SSE）

**文件位置**: `server/server.js:1261-1800+`

**设计要点**:
- 使用 Server-Sent Events 实现思考过程可视化
- 响应头配置:
  - `Cache-Control: no-cache, no-transform`
  - `X-Accel-Buffering: no` (禁用nginx缓冲)
  - `Transfer-Encoding: chunked`
- 事件发送间隔: 600ms（确保不堆积）
- 支持用户确认机制（针对图片输入场景）

---

### 3.5 前端页面架构

**文件位置**: `src/pages.json`

| 页面 | 路由 | 功能 |
|------|------|------|
| 登录页 | pages/login/login | 用户认证 |
| 注册页 | pages/register/register | 用户注册 |
| 首页 | pages/index/index | 主界面（日程、日记、课表） |

**主页面布局**:
```
┌─────────────────────────────────────┐
│           Header (固定顶部)          │
├──────────────────┬──────────────────┤
│   左侧区域        │    右侧区域       │
│ - 乌鸦互动       │  - Tab切换        │
│ - 状态展示       │    · 日程管理     │
│ - 快捷按钮       │    · 拾光日记     │
│                  │    · 课程表       │
└──────────────────┴──────────────────┘
```

---

### 3.6 核心功能模块设计

#### 3.6.1 日程管理模块

**文件位置**: `src/pages/index/index.vue:398-599`

**功能特性**:
- **日历选择器**: 支持按日期筛选查看日程
- **今日待办**: 默认显示当天任务
- **任务卡片**:
  - 支持勾选完成/未完成状态
  - 拖拽乌鸦到任务卡片上"监督"
  - 长按显示详情弹窗
  - 悬停显示编辑/删除按钮
- **番茄钟集成**:
  - 乌鸦坐在任务上时显示计时按钮
  - 可设置1-60分钟倒计时
  - 进度条式时长选择
  - 时间到后乌鸦"告警"提醒
- **颜色编码**: 任务边框/背景颜色根据状态动态变化

**任务数据结构**:
```json
{
  "id": "确定性哈希ID",
  "text": "任务内容",
  "date": "2024-01-01",
  "time": "09:00",
  "completed": false
}
```

**与AI集成**:
- 通过对话自然语言创建任务
- SCHEDULE_MANAGER 模型负责意图解析和结构化输出
- 支持查询、更新、删除操作

---

#### 3.6.2 拾光日记模块

**文件位置**: `src/pages/index/index.vue:605-684`

**功能特性**:
- **日历导航**: 按日期查看日记记录
- **图文混排**:
  - 支持单图/多图展示
  - 网格布局（单图大图、多图3列网格）
  - 图片查看器支持全屏浏览
  - 超出9张图时显示+N提示
- **标签系统**: 自动生成或手动添加1-3个标签
- **编辑器**: 支持创建、编辑、删除日记
- **时间戳**: 记录日记更新时间

**日记数据结构**:
```json
{
  "id": "确定性哈希ID",
  "date": "2024-01-01",
  "content": "日记内容",
  "tags": ["标签1", "标签2"],
  "images": ["https://..."],
  "image": "https://...",  // 兼容旧格式
  "updatedAt": 1234567890
}
```

**与AI集成**:
- 发送图片 + 文字描述自动生成日记
- DIARY_MANAGER 模型支持视觉理解
- AI 自动总结内容、生成标签
- 支持查询回顾历史日记

---

#### 3.6.3 课程表模块

**文件位置**: `src/pages/index/index.vue:198-396`

**功能特性**:
- **双视图模式**:
  - 周视图: 7天 × 12节次的网格布局
  - 日视图: 单日详细列表
- **课表导入**:
  - 图片导入: 上传课表截图，AI自动识别
  - 手动添加: 逐门课程录入
- **学期设置**:
  - 学期开始日期配置
  - 当前周数选择
  - 上一周/下一周/当前周快速跳转
- **时间设置**: 可自定义每节课的起止时间
- **课程颜色**: 每门课程可自定义颜色
- **快捷操作**:
  - 点击课表格子直接添加课程
  - 点击课程卡片编辑
  - 一键清空课表

**课程数据结构**:
```json
{
  "id": "课程ID",
  "courseName": "课程名称",
  "teacher": "教师姓名",
  "location": "上课地点",
  "dayOfWeek": 1,  // 1-7 表示周一到周日
  "startSection": 1,  // 开始节次
  "endSection": 2,  // 结束节次
  "startWeek": 1,
  "endWeek": 16,
  "color": "#3B82F6"
}
```

**课表配置结构**:
```json
{
  "semesterSettings": {
    "startDate": "2024-02-26",
    "currentWeek": 1
  },
  "timeSettings": [
    { "startTime": "08:00", "endTime": "08:45" },
    ...
  ],
  "courses": [...]
}
```

**与AI集成**:
- COURSE_ANALYZER 视觉模型解析课表图片
- 提取字段: 课程名、教师、地点、时间、周数
- 支持图片和文件两种输入方式

---

## 4. 核心业务流程

### 4.1 用户对话流程

```
用户输入
   ↓
获取用户上下文（todos、diary、crow状态）
   ↓
调用主脑 → 意图识别
   ↓
检测是否有图片 + 意图确认
   ↓
┌─────────────┬─────────────┐
│  需要确认   │   直接执行   │
└──────┬──────┴──────┬──────┘
       ↓             ↓
   询问用户      调度工具模型
       ↓             ↓
   确认执行      执行工具操作
       ↓             ↓
   └───────┬───────┘
           ↓
      保存数据（如需要）
           ↓
      返回响应
```

### 4.2 乌鸦养成系统

**状态参数**:
- 饱食度 (hunger): 0-100%
- 心情 (mood): 0-100%
- 食物计数 (foodCount)

**交互设计**:
- 完成任务 → 提升饱食度/心情
- 投喂操作 → 消耗食物计数，提升饱食度
- 拖拽互动 → 提升心情
- 状态过低 → 乌鸦"晕倒"

---

## 5. API 接口设计

### 5.1 认证接口

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/register | 用户注册 |
| POST | /api/login | 用户登录 |
| GET | /api/user | 获取用户信息 |

### 5.2 数据接口

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/save-data | 保存用户数据 |
| GET | /api/get-data | 获取用户数据 |
| POST | /api/save-crow-data | 保存乌鸦数据 |

### 5.3 AI 接口

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/chat | 普通对话（单次响应） |
| POST | /api/chat/stream | 流式对话（SSE） |

---

## 6. 数据库设计

### 6.1 表结构概览

```
users (用户表)
  ├─ id
  ├─ username
  ├─ email
  ├─ password
  └─ created_at

user_data (用户数据表)
  ├─ user_id (FK)
  ├─ data_type (todos|diaryEntries|...)
  └─ content (JSON)

crow_data (乌鸦数据表)
  ├─ user_id (FK)
  ├─ crow_stats (JSON)
  ├─ chat_messages (JSON)
  ├─ ai_reminder
  └─ food_count
```

### 6.2 数据格式示例

**todos (JSON)**:
```json
[
  {
    "id": "xxx",
    "text": "完成作业",
    "date": "2024-01-01",
    "time": "09:00",
    "completed": false
  }
]
```

**diaryEntries (JSON)**:
```json
[
  {
    "id": "xxx",
    "date": "2024-01-01",
    "content": "今天天气很好...",
    "tags": ["日常", "开心"],
    "images": ["https://..."],
    "updatedAt": 1234567890
  }
]
```

**crow_stats (JSON)**:
```json
{
  "hunger": 85,
  "mood": 92
}
```

---

## 7. 安全设计

### 7.1 认证安全
- 密码使用 bcrypt 哈希存储（round=10）
- JWT Token 7天过期
- Token 通过 Authorization Header 传递 (Bearer scheme)

### 7.2 数据安全
- 数据库连接使用连接池
- SQL 查询使用参数化（防止注入）
- 请求体大小限制: 50MB

### 7.3 API 密钥管理
- 密钥通过 .env 文件配置
- 不同功能使用不同 API Key
- 不提交密钥到版本控制

---

## 8. 部署架构

### 8.1 前端部署
- 构建产物: `deploy/` 目录
- 静态服务器: Express (server.js)
- 支持 SSR (dev:h5:ssr)

### 8.2 后端部署
- 运行端口: 3002 (可配置)
- 依赖管理: npm
- 进程管理: PM2 (建议)

### 8.3 Nginx 反向代理配置

**使用场景**:
- 生产环境推荐使用 Nginx 作为反向代理
- 提供 HTTPS 支持
- 静态资源加速
- 负载均衡（如需扩展）

**关键配置要点**:

1. **SSE 流式响应特殊处理**（重要）：
   - 代码中已设置 `X-Accel-Buffering: no` 头部
   - Nginx 需禁用缓冲以确保 SSE 实时推送

2. **推荐 Nginx 配置示例**:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端静态文件
    location / {
        root /path/to/shiya/deploy;
        try_files $uri $uri/ /index.html;
        index index.html;
        
        # 静态资源缓存
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 30d;
            add_header Cache-Control "public, immutable";
        }
    }

    # API 反向代理
    location /api/ {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        
        # 通用代理头
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

    # HTTPS 配置（建议）
    # listen 443 ssl http2;
    # ssl_certificate /path/to/cert.pem;
    # ssl_certificate_key /path/to/key.pem;
}
```

**配置说明**:
- `proxy_buffering off`: 禁用代理缓冲（SSE 必须）
- `proxy_cache off`: 禁用缓存
- `proxy_set_header Connection ''`: 清除 Connection 头
- `proxy_read_timeout 300s`: 延长读取超时（适配长连接对话）

### 8.4 跨平台支持
- H5 网页
- 微信小程序 (dev:mp-weixin)
- 支付宝小程序 (dev:mp-alipay)
- 鸿蒙应用 (dev:mp-harmony)
- ... 更多平台参考 package.json

---

## 9. 性能优化要点

### 9.1 前端优化
- 使用 Vue 3 Composition API
- 图片懒加载
- 组件按需渲染

### 9.2 后端优化
- 数据库连接池 (connectionLimit: 10)
- AI 上下文裁剪（减少 Token 消耗）
- SSE 事件间隔控制（600ms）

### 9.3 AI 优化
- 主脑 + 工具模型的分层架构
- 不同场景使用不同专门模型
- 只传递必要的用户上下文摘要

---

## 10. 扩展与维护

### 10.1 新增工具模型
1. 在 `server.js` 中添加 `callXxxManager` 函数
2. 在主脑 prompt 中添加工具说明
3. 在意图识别逻辑中添加关键词匹配
4. 在 switch-case 中添加调度分支

### 10.2 新增数据类型
1. 在 `save-data` 接口添加判断
2. 在 `get-data` 接口添加解析
3. 在前端添加对应状态管理

### 10.3 环境变量配置
参考 `server/.env`:
- MASTER_BRAIN_API_KEY
- DOUBAO_API_KEY
- DIARY_MANAGER_API_KEY
- SCHEDULE_MANAGER_API_KEY
- DOUBAO_VISION_API_KEY
- DB_HOST, DB_USER, DB_PASSWORD, DB_NAME
- PORT, SECRET_KEY

---

## 11. 关键文件索引

| 文件路径 | 说明 |
|----------|------|
| `server/server.js` | 后端服务主文件 |
| `src/pages/index/index.vue` | 前端主页面 |
| `src/utils/api.js` | API 请求封装 |
| `src/pages.json` | 页面路由配置 |
| `package.json` | 项目依赖配置 |
| `server/.env` | 环境变量配置 |

---

## 12. 总结

拾鸦系统采用**主脑 + 工具模型**的分层 AI 架构，结合游戏化的宠物互动设计，为用户提供了智能、有趣的个人管理体验。系统设计注重可扩展性、安全性和性能优化，同时支持多端部署，是一个完整的现代 Web 应用解决方案。

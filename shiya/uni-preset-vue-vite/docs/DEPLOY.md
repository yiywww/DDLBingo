# 拾鸦部署指南

## 架构

```
本地 (Windows)                        云端 (Ubuntu, 8.134.127.111)
┌──────────────┐                     ┌──────────────────────────────────┐
│ npm run      │    Vite 代理        │ nginx (shiya.yiywww.xyz)         │
│ dev:h5       │   /api/* → 生产     │                                  │
│ :5174        │ ──────────────────→ │ /            → /var/www/frontend/ │
│              │                     │ /api/*       → 127.0.0.1:3004    │
└──────────────┘                     │                                  │
                                     │ PM2: shiya (id=8)                │
                                     │ cwd: /var/www/shiya/deploy/      │
                                     │ 入口: server.js (port 3004)      │
                                     └──────────────────────────────────┘
```

| 组件 | 服务器路径 | 说明 |
|------|-----------|------|
| **前端静态文件** | `/var/www/frontend/` | nginx root，存放 index.html + assets/ + static/ |
| **后端代码** | `/var/www/shiya/deploy/` | PM2 工作目录，server.js + prompts/ + services/ + routes/ |
| **API 端口** | `127.0.0.1:3004` | nginx 反向代理到 PM2 |

- **服务器**: `root@8.134.127.111`，域名 `shiya.yiywww.xyz`
- **PM2**: `pm2 restart shiya` / `pm2 status` / `pm2 logs shiya`

---

## 全部部署（前端 + 后端）

```powershell
# ===== 1. 构建前端 =====
cd d:\拾鸦_crow\shiya5.4.1\shiya4.2\uni-preset-vue-vite
npm run build:h5

# ===== 2. 打包前端（直接打包 dist/build/h5）=====
Compress-Archive -Path "dist\build\h5\*" -DestinationPath "frontend.zip" -Force

# ===== 3. 打包后端 =====
Compress-Archive -Path "deploy\server.js", "deploy\prompts\", "deploy\services\", "deploy\routes\" -DestinationPath "backend.zip"

# ===== 4. SCP 上传 =====
scp frontend.zip root@8.134.127.111:/var/www/
scp backend.zip root@8.134.127.111:/var/www/shiya/

# ===== 5. SSH 部署 =====
ssh root@8.134.127.111

# 部署前端到 /var/www/frontend/
cd /var/www
rm -rf frontend/assets             # 清理旧 assets
unzip -o frontend.zip -d frontend/  # 解压到 frontend/ 目录
rm frontend.zip

# 部署后端到 /var/www/shiya/deploy/
cd /var/www/shiya
unzip -o backend.zip
# ⚠️ Compress-Archive 不带父目录，解压到当前目录，需手动移到 deploy/
cp server.js deploy/server.js
cp -rf prompts/* deploy/prompts/
cp -rf services/* deploy/services/
cp -rf routes/* deploy/routes/
rm -rf server.js prompts services routes backend.zip

# 重启后端
pm2 restart shiya
pm2 status
exit
```

---

## 仅部署后端

```powershell
cd d:\拾鸦_crow\shiya5.4.1\shiya4.2\uni-preset-vue-vite

Compress-Archive -Path "deploy\server.js", "deploy\prompts\", "deploy\services\", "deploy\routes\" -DestinationPath "backend.zip"

scp backend.zip root@8.134.127.111:/var/www/shiya/

ssh root@8.134.127.111
cd /var/www/shiya
unzip -o backend.zip
cp server.js deploy/server.js
cp -rf prompts/* deploy/prompts/
cp -rf services/* deploy/services/
cp -rf routes/* deploy/routes/
rm -rf server.js prompts services routes backend.zip
pm2 restart shiya
exit
```

---

## 仅部署前端

```powershell
cd d:\拾鸦_crow\shiya5.4.1\shiya4.2\uni-preset-vue-vite
npm run build:h5

Compress-Archive -Path "dist\build\h5\*" -DestinationPath "frontend.zip" -Force

scp frontend.zip root@8.134.127.111:/var/www/

ssh root@8.134.127.111
cd /var/www
rm -rf frontend/assets
unzip -o frontend.zip -d frontend/
rm frontend.zip
exit
```

---

## 关键注意事项

1. **前后端分开部署**: 前端在 `/var/www/frontend/`，后端在 `/var/www/shiya/deploy/`，不要混淆。

2. **Compress-Archive 不带父目录**: 使用 `-d frontend/` 参数指定解压目标目录，或解压后手动 `cp`。

3. **前端打包直接打 `dist/build/h5/*`**: 不要再复制到 `deploy/` 目录，避免混淆。

4. **清理旧 assets**: 每次部署前端前 `rm -rf frontend/assets`，避免多版本 hash 文件堆积。

5. **PM2 命令**: `pm2 restart shiya` / `pm2 status` / `pm2 logs shiya`

6. **nginx 重载**: 修改 nginx 配置后 `nginx -t && nginx -s reload`

---

## 日程数据格式（手动 ↔ AI 互通）

手动创建和 AI 生成的日程共享同一字段标准，确保在日程列表中展示一致、可互相编辑。

### 统一字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `text` / `title` | String | 日程标题（两字段并存，兼容新旧） |
| `details` / `description` | String | 详细描述 |
| `startDate` | String | 开始日期 `YYYY-MM-DD`，从 `startTime` 解析或 AI 直接输出 |
| `endDate` | String | 结束日期 `YYYY-MM-DD`，从 `endTime` 解析或 AI 直接输出 |
| `startTime` | String | 完整日期时间串 `YYYY-MM-DD HH:MM`，供编辑表单回填 |
| `endTime` | String | 完整日期时间串，供编辑表单回填 |
| `time` | String | 兼容旧版，简短时间显示 |
| `priority` | Number | 优先级 1-5（1普通 2一般 3重要 4很重要 5紧急） |
| `estimatedMinutes` | Number | 预计耗时（分钟） |
| `estimatedTime` | Number | 同 estimatedMinutes（两字段并存，兼容新旧） |
| `difficulty` | String | 启动难度 `easy`/`medium`/`hard` |
| `completed` | Boolean | 是否完成 |
| `isRepeat` | Boolean | 是否重复日程 |
| `repeatInterval` | String | 重复间隔 `daily`/`weekly`/`weekdays`/`none` |

### AI 字段推断规则

AI 输出中 `difficulty` 非必填，前端/后端自动从 `priority` 推断：

| priority | difficulty |
|----------|------------|
| 4-5 | `hard` |
| 3 | `medium` |
| 1-2 | `easy` |

`startTime`/`endTime` 由 `startDate + ' ' + startTime` 组合为完整日期时间串。

### 编辑兼容

`startEditTask()` 自动处理：
- 数字 priority → 映射为 `'urgent'`(≥4) / `'normal'`(≤3) 填入表单
- `estimatedTime` 回退到 `estimatedMinutes`
- `difficulty` 默认 `'medium'`

### 相关文件

- `deploy/prompts/schedule.txt` — AI 日程 Prompt
- `deploy/prompts/task-split.txt` — AI 任务拆解 Prompt  
- `deploy/server.js` → `saveScheduleToDB()` — 后端标准化
- `src/pages/index/index.vue` → `processNormalChat` / `handleAddTask` / `handleEditTask` / `startEditTask` — 前端标准化
- `src/components/ScheduleTab.vue` — 日程展示

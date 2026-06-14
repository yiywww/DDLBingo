-- 乌鸦数据表 migration（部署版）
-- 添加 last_updated 列用于记录乌鸦状态最后更新时间，支持离线衰减计算

-- 确保表存在（如果不存在则创建）
CREATE TABLE IF NOT EXISTS crow_data (
  user_id INT PRIMARY KEY,
  crow_stats JSON NOT NULL DEFAULT '{"hunger":100,"mood":90}',
  chat_messages JSON NOT NULL DEFAULT '[]',
  ai_reminder TEXT DEFAULT '',
  food_count INT DEFAULT 0,
  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 添加 last_updated 列（如果列已存在则忽略错误）
ALTER TABLE crow_data ADD COLUMN last_updated DATETIME DEFAULT CURRENT_TIMESTAMP;

-- 为已存在的行填充默认值
UPDATE crow_data SET last_updated = CURRENT_TIMESTAMP WHERE last_updated IS NULL;

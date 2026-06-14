
-- =====================================================
-- 拾鸦项目 - 腾讯文档集成数据库表结构
-- 执行此SQL文件以添加腾讯文档相关的表
-- =====================================================

-- 用户腾讯文档授权表
CREATE TABLE IF NOT EXISTS qq_docs_auth (
  id INT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
  user_id INT NOT NULL COMMENT '用户ID',
  access_token TEXT COMMENT '访问令牌',
  refresh_token TEXT COMMENT '刷新令牌',
  expires_at BIGINT COMMENT '过期时间戳(毫秒)',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  UNIQUE KEY uk_user_id (user_id) COMMENT '用户ID唯一索引',
  INDEX idx_expires_at (expires_at) COMMENT '过期时间索引'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户腾讯文档授权表';

-- 用户文档关联表
CREATE TABLE IF NOT EXISTS user_documents (
  id INT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
  user_id INT NOT NULL COMMENT '用户ID',
  file_id VARCHAR(255) NOT NULL COMMENT '腾讯文档文件ID',
  title VARCHAR(255) COMMENT '文档标题',
  type VARCHAR(50) COMMENT '文档类型: document, sheet, slide, collect, smartdoc, smartsheet等',
  url VARCHAR(500) COMMENT '文档访问链接',
  doc_type VARCHAR(50) COMMENT '业务类型: class_note, error_book, study_plan, general等',
  course_id INT COMMENT '关联课程ID',
  subject VARCHAR(50) COMMENT '学科: 数学, 语文, 英语等',
  collaborators JSON COMMENT '协作者列表(JSON格式)',
  is_starred TINYINT(1) DEFAULT 0 COMMENT '是否星标: 0否, 1是',
  last_opened_at TIMESTAMP NULL COMMENT '最后打开时间',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX idx_user_id (user_id) COMMENT '用户ID索引',
  INDEX idx_doc_type (doc_type) COMMENT '文档业务类型索引',
  INDEX idx_subject (subject) COMMENT '学科索引',
  INDEX idx_updated_at (updated_at) COMMENT '更新时间索引'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户文档关联表';

-- 错题记录表（可选，用于更精细的错题管理）
CREATE TABLE IF NOT EXISTS error_records (
  id INT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
  user_id INT NOT NULL COMMENT '用户ID',
  doc_id INT COMMENT '关联的user_documents表ID',
  subject VARCHAR(50) COMMENT '学科',
  question_text TEXT COMMENT '题目内容',
  answer_text TEXT COMMENT '正确答案',
  error_reason TEXT COMMENT '错误原因分析',
  knowledge_point VARCHAR(255) COMMENT '知识点',
  mastery_level TINYINT DEFAULT 0 COMMENT '掌握程度: 0未掌握, 1基本掌握, 2熟练掌握',
  review_count INT DEFAULT 0 COMMENT '复习次数',
  next_review_at TIMESTAMP NULL COMMENT '下次复习时间',
  last_reviewed_at TIMESTAMP NULL COMMENT '最后复习时间',
  images JSON COMMENT '题目图片列表(JSON格式)',
  source VARCHAR(100) COMMENT '来源: homework, exam, practice等',
  difficulty TINYINT DEFAULT 1 COMMENT '难度: 1简单, 2中等, 3困难',
  tags JSON COMMENT '标签列表(JSON格式)',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX idx_user_id (user_id) COMMENT '用户ID索引',
  INDEX idx_subject (subject) COMMENT '学科索引',
  INDEX idx_knowledge_point (knowledge_point) COMMENT '知识点索引',
  INDEX idx_next_review_at (next_review_at) COMMENT '下次复习时间索引'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='错题记录表';

-- 学习计划表（可选，用于更精细的计划管理）
CREATE TABLE IF NOT EXISTS study_plans (
  id INT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
  user_id INT NOT NULL COMMENT '用户ID',
  doc_id INT COMMENT '关联的user_documents表ID',
  title VARCHAR(255) NOT NULL COMMENT '计划标题',
  description TEXT COMMENT '计划描述',
  plan_type VARCHAR(50) COMMENT '计划类型: daily, weekly, exam, custom',
  start_date DATE COMMENT '开始日期',
  end_date DATE COMMENT '结束日期',
  subjects JSON COMMENT '涉及学科列表(JSON格式)',
  is_active TINYINT(1) DEFAULT 1 COMMENT '是否激活: 0否, 1是',
  progress DECIMAL(5,2) DEFAULT 0.00 COMMENT '完成进度(0-100)',
  settings JSON COMMENT '设置信息(JSON格式)',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX idx_user_id (user_id) COMMENT '用户ID索引',
  INDEX idx_is_active (is_active) COMMENT '是否激活索引',
  INDEX idx_start_date (start_date) COMMENT '开始日期索引'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='学习计划表';

-- 学习计划任务表（可选）
CREATE TABLE IF NOT EXISTS study_plan_tasks (
  id INT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
  plan_id INT NOT NULL COMMENT '学习计划ID',
  title VARCHAR(255) NOT NULL COMMENT '任务标题',
  description TEXT COMMENT '任务描述',
  task_date DATE COMMENT '任务日期',
  task_time TIME COMMENT '任务时间',
  duration INT COMMENT '预计时长(分钟)',
  subject VARCHAR(50) COMMENT '学科',
  priority TINYINT DEFAULT 1 COMMENT '优先级: 1低, 2中, 3高',
  is_completed TINYINT(1) DEFAULT 0 COMMENT '是否完成: 0否, 1是',
  completed_at TIMESTAMP NULL COMMENT '完成时间',
  sort_order INT DEFAULT 0 COMMENT '排序',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX idx_plan_id (plan_id) COMMENT '学习计划ID索引',
  INDEX idx_task_date (task_date) COMMENT '任务日期索引',
  INDEX idx_is_completed (is_completed) COMMENT '是否完成索引'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='学习计划任务表';

-- =====================================================
-- 插入示例数据（可选）
-- =====================================================

-- 为现有用户创建一个默认的测试授权记录（仅用于开发测试）
-- INSERT INTO qq_docs_auth (user_id, access_token, refresh_token, expires_at)
-- SELECT id, 'test_token', 'test_refresh_token', UNIX_TIMESTAMP(DATE_ADD(NOW(), INTERVAL 30 DAY)) * 1000
-- FROM users WHERE id NOT IN (SELECT user_id FROM qq_docs_auth)
-- LIMIT 1;

-- =====================================================
-- 完成提示
-- =====================================================
SELECT '腾讯文档相关表创建完成！' AS message;


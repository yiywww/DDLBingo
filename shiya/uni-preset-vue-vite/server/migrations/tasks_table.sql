-- 任务表（支持 AI 拆解）
-- 用于存储主任务和子任务，支持 DDL/Bingo 联动

CREATE TABLE IF NOT EXISTS agent_tasks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    session_id VARCHAR(50) NOT NULL COMMENT '会话ID，关联对话上下文',
    parent_id INT DEFAULT NULL COMMENT '父任务ID，NULL=主任务',
    title VARCHAR(200) NOT NULL COMMENT '任务标题',
    description TEXT COMMENT '任务描述',
    estimated_minutes INT DEFAULT 30 COMMENT '预计耗时（分钟）',
    priority TINYINT DEFAULT 3 COMMENT '优先级 1-5，1最高',
    status VARCHAR(20) DEFAULT 'pending' COMMENT 'pending|in_progress|completed|failed',
    ddl_date DATE DEFAULT NULL COMMENT '截止日期',
    bingo_grid_id VARCHAR(50) DEFAULT NULL COMMENT '关联Bingo格子ID',
    sort_order INT DEFAULT 0 COMMENT '排序顺序',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_session (user_id, session_id),
    INDEX idx_parent (parent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Agent任务表';

-- 任务执行历史
CREATE TABLE IF NOT EXISTS agent_task_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    task_id INT NOT NULL,
    user_id INT NOT NULL,
    action VARCHAR(20) NOT NULL COMMENT 'created|started|completed|failed|deleted',
    details TEXT COMMENT '操作详情JSON',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES agent_tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='任务操作历史';

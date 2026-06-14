-- 对话会话表
CREATE TABLE IF NOT EXISTS conversation_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    session_id VARCHAR(50) NOT NULL COMMENT '会话唯一ID',
    title VARCHAR(200) DEFAULT '' COMMENT '会话标题（首条消息摘要）',
    summary TEXT COMMENT '对话历史压缩摘要',
    message_count INT DEFAULT 0 COMMENT '消息总数',
    token_count INT DEFAULT 0 COMMENT '估算 token 数',
    status VARCHAR(20) DEFAULT 'active' COMMENT 'active|archived',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uk_user_session (user_id, session_id),
    INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='AI对话会话表';

-- 对话消息表
CREATE TABLE IF NOT EXISTS conversation_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    session_id VARCHAR(50) NOT NULL,
    role VARCHAR(20) NOT NULL COMMENT 'user|assistant|system',
    content TEXT NOT NULL COMMENT '消息内容',
    status VARCHAR(20) DEFAULT 'NORMAL' COMMENT 'NORMAL|COMPRESSED',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_session (session_id),
    INDEX idx_user_session (user_id, session_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='AI对话消息表';

-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Platform accounts table
CREATE TABLE platform_accounts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL, -- 'twitch', 'tiktok', 'youtube', 'instagram'
    account_name VARCHAR(255),
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, platform)
);

-- Clips table
CREATE TABLE clips (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    twitch_clip_id VARCHAR(255) UNIQUE,
    title VARCHAR(500),
    broadcaster_name VARCHAR(255),
    game VARCHAR(255),
    view_count INTEGER,
    duration INTEGER, -- in seconds
    thumbnail_url TEXT,
    video_url TEXT,
    created_at TIMESTAMP,
    fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Compilations table
CREATE TABLE compilations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(500),
    description TEXT,
    duration INTEGER, -- total duration in seconds
    file_path TEXT,
    thumbnail_path TEXT,
    status VARCHAR(50) DEFAULT 'processing', -- processing, completed, failed
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Compilation clips junction table
CREATE TABLE compilation_clips (
    compilation_id INTEGER REFERENCES compilations(id) ON DELETE CASCADE,
    clip_id INTEGER REFERENCES clips(id) ON DELETE CASCADE,
    position INTEGER NOT NULL, -- order in compilation
    PRIMARY KEY (compilation_id, clip_id)
);

-- Scheduled posts table
CREATE TABLE scheduled_posts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    compilation_id INTEGER REFERENCES compilations(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL,
    scheduled_time TIMESTAMP NOT NULL,
    title VARCHAR(500),
    description TEXT,
    hashtags TEXT, -- JSON array of hashtags
    status VARCHAR(50) DEFAULT 'pending', -- pending, uploaded, failed
    upload_response TEXT, -- JSON response from platform
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Video templates table
CREATE TABLE video_templates (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    camera_position VARCHAR(50) DEFAULT 'bottom', -- top, bottom, left, right
    aspect_ratio VARCHAR(20) DEFAULT '9:16', -- TikTok/Shorts format
    include_subtitles BOOLEAN DEFAULT false,
    outro_enabled BOOLEAN DEFAULT true,
    settings JSONB, -- Additional settings
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Outros table
CREATE TABLE outros (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    duration INTEGER, -- in seconds
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_clips_user_id ON clips(user_id);
CREATE INDEX idx_compilations_user_id ON compilations(user_id);
CREATE INDEX idx_scheduled_posts_user_id ON scheduled_posts(user_id);
CREATE INDEX idx_scheduled_posts_scheduled_time ON scheduled_posts(scheduled_time);
CREATE INDEX idx_scheduled_posts_status ON scheduled_posts(status);
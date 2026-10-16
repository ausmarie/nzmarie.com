CREATE TABLE IF NOT EXISTS campaign_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_key VARCHAR(50) UNIQUE NOT NULL,
    campaign_name VARCHAR(100) NOT NULL,
    total_pv BIGINT DEFAULT 0,
    total_uv BIGINT DEFAULT 0,
    last_visited_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaign_key ON campaign_analytics(campaign_key);

CREATE TABLE IF NOT EXISTS campaign_visit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_key VARCHAR(50) NOT NULL,
    visitor_hash VARCHAR(64) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    device_type VARCHAR(20),
    referrer TEXT,
    is_unique BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visit_logs_campaign_time ON campaign_visit_logs(campaign_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_visit_logs_hash_time ON campaign_visit_logs(visitor_hash, created_at DESC);

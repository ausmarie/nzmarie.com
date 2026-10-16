ALTER TABLE campaign_visit_logs ADD COLUMN IF NOT EXISTS visit_count INT NOT NULL DEFAULT 1;
ALTER TABLE campaign_visit_logs ADD COLUMN IF NOT EXISTS first_scanned_at TIMESTAMPTZ;
ALTER TABLE campaign_visit_logs ADD COLUMN IF NOT EXISTS last_scanned_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_visit_logs_campaign_visitor ON campaign_visit_logs(campaign_key, visitor_hash);

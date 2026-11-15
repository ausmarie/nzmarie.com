CREATE TABLE IF NOT EXISTS north_shore_market_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_type VARCHAR(12) NOT NULL CHECK (period_type IN ('monthly', 'quarterly')),
  period_key VARCHAR(7) NOT NULL,
  title VARCHAR(255) NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  content JSONB NOT NULL DEFAULT '[]'::JSONB,
  data_snapshot JSONB NOT NULL,
  status VARCHAR(12) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'withdrawn')),
  has_unpublished_changes BOOLEAN NOT NULL DEFAULT FALSE,
  published_title VARCHAR(255),
  published_summary TEXT,
  published_content JSONB,
  published_data_snapshot JSONB,
  published_at TIMESTAMPTZ,
  withdrawn_at TIMESTAMPTZ,
  created_by VARCHAR(255) NOT NULL,
  updated_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT north_shore_market_reports_period_key_check CHECK (
    (period_type = 'monthly' AND period_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
    OR
    (period_type = 'quarterly' AND period_key ~ '^[0-9]{4}-Q[1-4]$')
  ),
  CONSTRAINT north_shore_market_reports_unique_period UNIQUE (period_type, period_key)
);

CREATE INDEX IF NOT EXISTS idx_north_shore_market_reports_status_period
  ON north_shore_market_reports(status, period_key DESC);

CREATE INDEX IF NOT EXISTS idx_north_shore_market_reports_published_at
  ON north_shore_market_reports(published_at DESC)
  WHERE status = 'published';

COMMENT ON TABLE north_shore_market_reports IS
  'Editorial North Shore monthly and quarterly market reports, including draft and published snapshots.';

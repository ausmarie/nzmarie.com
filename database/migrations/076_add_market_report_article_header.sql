ALTER TABLE north_shore_market_reports
  ADD COLUMN IF NOT EXISTS article_header JSONB NOT NULL DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS published_article_header JSONB;

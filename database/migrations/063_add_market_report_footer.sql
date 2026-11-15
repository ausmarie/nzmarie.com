ALTER TABLE north_shore_market_reports
  ADD COLUMN IF NOT EXISTS footer TEXT,
  ADD COLUMN IF NOT EXISTS published_footer TEXT;

ALTER TABLE north_shore_market_reports
  ADD COLUMN IF NOT EXISTS language VARCHAR(2) NOT NULL DEFAULT 'en';

ALTER TABLE north_shore_market_reports
  DROP CONSTRAINT IF EXISTS north_shore_market_reports_unique_period;

ALTER TABLE north_shore_market_reports
  DROP CONSTRAINT IF EXISTS north_shore_market_reports_unique_period_language;

ALTER TABLE north_shore_market_reports
  ADD CONSTRAINT north_shore_market_reports_unique_period_language
  UNIQUE (period_type, period_key, language);

ALTER TABLE north_shore_market_reports
  DROP CONSTRAINT IF EXISTS north_shore_market_reports_language_check;

ALTER TABLE north_shore_market_reports
  ADD CONSTRAINT north_shore_market_reports_language_check
  CHECK (language IN ('en', 'zh'));

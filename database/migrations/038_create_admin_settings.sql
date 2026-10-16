-- admin_settings: simple key/value store for admin UI preferences
-- (e.g. the default outreach campaign shown on the Activity page).
CREATE TABLE IF NOT EXISTS admin_settings (
  setting_key VARCHAR(100) PRIMARY KEY,
  setting_value TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by VARCHAR(255)
);

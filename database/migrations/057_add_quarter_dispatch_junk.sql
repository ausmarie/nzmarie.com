ALTER TABLE outreach_property_quarter_status
  ADD COLUMN IF NOT EXISTS is_junk BOOLEAN,
  ADD COLUMN IF NOT EXISTS junk_at TIMESTAMPTZ;

ALTER TABLE outreach_property_quarter_status
  ALTER COLUMN is_junk SET DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_opqs_quarter_suburb_junk
  ON outreach_property_quarter_status (quarter_key, suburb, is_junk)
  WHERE is_junk = TRUE;

CREATE INDEX IF NOT EXISTS idx_opqs_is_junk_junk_at
  ON outreach_property_quarter_status (is_junk, junk_at)
  WHERE is_junk = TRUE;

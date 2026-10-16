-- Add no_junk_mail column to properties table
ALTER TABLE properties ADD COLUMN IF NOT EXISTS no_junk_mail BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_properties_no_junk_mail ON properties (no_junk_mail);

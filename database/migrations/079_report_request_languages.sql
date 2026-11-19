ALTER TABLE report_downloads
  ADD COLUMN IF NOT EXISTS entry_language VARCHAR(5) NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(5) NOT NULL DEFAULT 'en';

ALTER TABLE report_download_events
  ADD COLUMN IF NOT EXISTS entry_language VARCHAR(5) NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(5) NOT NULL DEFAULT 'en';

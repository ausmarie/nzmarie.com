-- Migration 042: Add indexes to speed up outreach queries
-- Created: 2026-08-12
-- Purpose: Add expression and covering indexes used by outreach/outreach_enriched queries

-- 1) Expression index on outreach_enriched.property_id (lower(remove dashes))
CREATE INDEX IF NOT EXISTS idx_mv_property_id_no_dash
  ON outreach_enriched ((lower(replace(property_id::text, '-', ''))));

-- 2) Indexes to accelerate send logs lookups (by outreach_property and by sent timestamp)
CREATE INDEX IF NOT EXISTS idx_outreach_send_logs_outreach_prop_sent_at
  ON outreach_send_logs (outreach_property_id, sent_at DESC);

-- CockroachDB does not support expression indexes on `::date` casts in index definitions.
-- Use a plain timestamp index instead for date-range and recent-send queries.
CREATE INDEX IF NOT EXISTS idx_outreach_send_logs_sent_at
  ON outreach_send_logs (sent_at DESC);

-- 3) Ensure campaign_key + sent_at partial index exists (used by campaign queries)
CREATE INDEX IF NOT EXISTS idx_outreach_send_logs_key_sent
  ON outreach_send_logs (campaign_key, sent_at)
  WHERE sent_at IS NOT NULL;

-- 4) Helpful expression index on properties to speed up joins using replace(id::text, '-', '')
CREATE INDEX IF NOT EXISTS idx_properties_id_no_dash
  ON properties ((replace(id::text, '-', '')));

-- Note:
-- - If your DB is CockroachDB or otherwise does not support some expressions,
--   please review the migration before applying. These indexes are created
--   with IF NOT EXISTS and are idempotent.
-- - If you'd like trigram/GIN indexes for ILIKE prefix/contains searches,
--   I can add them as a separate migration (may require pg_trgm extension).

-- =====================================================
-- Migration 040: Add house_number to outreach_properties
-- Created: 2026-08-02
-- Purpose: Store the parsed primary house number per
--          outreach address so street ordering can anchor
--          on the minimum house number address of each street.
--
-- Backfill happens in migration 041 (CockroachDB cannot
-- update a column in the same transaction that adds it).
-- =====================================================

ALTER TABLE outreach_properties ADD COLUMN IF NOT EXISTS house_number BIGINT;

CREATE INDEX IF NOT EXISTS idx_outreach_suburb_street_housenumber
ON outreach_properties(suburb, street, house_number);

-- =====================================================
-- Migration Complete
-- =====================================================

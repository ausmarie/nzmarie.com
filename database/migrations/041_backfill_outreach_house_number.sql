UPDATE outreach_properties
SET house_number = COALESCE(
  NULLIF(regexp_extract(property_address, '^[0-9]+/([0-9]+)'), ''),
  NULLIF(regexp_extract(property_address, '^([0-9]+)'), '')
)::BIGINT
WHERE house_number IS NULL;

-- =====================================================
-- Migration 041: Backfill house_number on outreach_properties
-- Created: 2026-08-02
-- Purpose: Backfill the house_number column added in 040.
-- Runs as its own transaction because CockroachDB cannot
-- update a column in the same transaction that adds it.
--
-- House number rule (matches lib/street-ordering.ts):
--   "2/45 Smith St"   -> 45 (the actual street number of the unit)
--   "12 Kowhai St"    -> 12
--   "123-129 Main Rd" -> 123
--   "Flat 3/5 X St"   -> NULL (no leading street number)
-- =====================================================

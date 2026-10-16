-- =====================================================
-- Migration 013: Populate Street Field from Address
-- Created: 2026-07-03
-- Purpose: Extract and populate street names from existing addresses
-- =====================================================

-- Extract street name from the full address and populate empty street fields.
-- Inline SQL (CockroachDB-compatible) replaces the PL/pgSQL function version:
--   strip the leading unit/number, keep the text before the first comma, trim.
UPDATE outreach_properties
SET street = TRIM(REGEXP_REPLACE(SPLIT_PART(property_address, ',', 1), '^\d+[A-Za-z]?(/\d+)?\s+', ''))
WHERE street IS NULL OR street = '';

-- Normalize very short (unlikely) values to NULL
UPDATE outreach_properties
SET street = NULL
WHERE street IS NOT NULL AND LENGTH(street) < 3;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_outreach_street ON outreach_properties(street);

-- Create a composite index for the sorting query
CREATE INDEX IF NOT EXISTS idx_outreach_sort_order 
ON outreach_properties(suburb, street, created_at, property_address);

-- =====================================================
-- Migration Complete
-- =====================================================

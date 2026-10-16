-- Migration 028: Add performance indexes for outreach query optimization
--
-- This migration addresses three known performance bottlenecks:
--   1. Non-sargable JOINs on real_estate / real_estate_rent (function-wrapped columns)
--   2. OR join condition between outreach_properties and properties
--   3. ILIKE '%search%' pattern on property_address

-- ============================================================
-- 1. Expression indexes for normalized address + suburb matching
--    Used by the JOINs in app/api/admin/outreach/route.ts:
--      LOWER(REGEXP_REPLACE(TRIM(SPLIT_PART(re.address, ',', 1)), '  +', ' ', 'g'))
--      LOWER(REGEXP_REPLACE(TRIM(re.suburb), '  +', ' ', 'g'))
-- ============================================================

-- real_estate
CREATE INDEX IF NOT EXISTS idx_real_estate_norm_addr
  ON real_estate (LOWER(REGEXP_REPLACE(TRIM(SPLIT_PART(address, ',', 1)), '  +', ' ', 'g')));
CREATE INDEX IF NOT EXISTS idx_real_estate_norm_suburb
  ON real_estate (LOWER(REGEXP_REPLACE(TRIM(suburb), '  +', ' ', 'g')));

-- real_estate_rent
CREATE INDEX IF NOT EXISTS idx_real_estate_rent_norm_addr
  ON real_estate_rent (LOWER(REGEXP_REPLACE(TRIM(SPLIT_PART(address, ',', 1)), '  +', ' ', 'g')));
CREATE INDEX IF NOT EXISTS idx_real_estate_rent_norm_suburb
  ON real_estate_rent (LOWER(REGEXP_REPLACE(TRIM(suburb), '  +', ' ', 'g')));

-- ============================================================
-- 2. Index for the OR join condition on outreach_properties
--    REPLACE(op.property_id::text, '-', '') = p.id
--    OR op.louis_property_id = p.id
-- ============================================================

-- Expression index so the first branch of the OR can use an Index Scan
CREATE INDEX IF NOT EXISTS idx_outreach_property_id_clean
  ON outreach_properties (REPLACE(property_id::text, '-', ''));

-- Plain index for the second branch of the OR
CREATE INDEX IF NOT EXISTS idx_outreach_louis_property_id
  ON outreach_properties (louis_property_id);

-- ============================================================
-- 3. Trigram index for ILIKE '%search%' on property_address
--    Skipped: pg_trgm is a PostgreSQL extension not available on
--    CockroachDB. CockroachDB 23+ ships its own trigram support; the
--    application relies on the plain idx_outreach_address index instead.
-- ============================================================

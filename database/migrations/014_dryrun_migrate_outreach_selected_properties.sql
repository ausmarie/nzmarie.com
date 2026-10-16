-- Dry-run migration: outreach_selected_properties -> outreach_properties
-- This file contains read-only queries to preview what would be migrated,
-- plus an optional commented transaction that can be run in a test DB to
-- validate inserts (it is safe because it ROLLBACKs).

-- 0) Quick counts
SELECT 'legacy_total' as key, COUNT(*) as value FROM outreach_selected_properties;
SELECT 'target_total' as key, COUNT(*) as value FROM outreach_properties;

-- 1) How many legacy rows would NOT find a matching outreach_properties row
--    Matching logic: louis_property_id if present, otherwise property_address + campaign
SELECT COUNT(*) AS would_insert_count
FROM outreach_selected_properties osp
LEFT JOIN outreach_properties op
  ON (osp.louis_property_id IS NOT NULL AND op.louis_property_id = osp.louis_property_id)
  OR (osp.louis_property_id IS NULL AND op.property_address ILIKE osp.property_address AND op.campaign = 'legacy_import')
WHERE op.id IS NULL;

-- 2) Sample rows that would be inserted (limit for inspection)
SELECT osp.id, osp.louis_property_id, osp.property_address, osp.suburb, osp.city, osp.selected_by, osp.selected_at, osp.tracking_code
FROM outreach_selected_properties osp
LEFT JOIN outreach_properties op
  ON (osp.louis_property_id IS NOT NULL AND op.louis_property_id = osp.louis_property_id)
  OR (osp.louis_property_id IS NULL AND op.property_address ILIKE osp.property_address AND op.campaign = 'legacy_import')
WHERE op.id IS NULL
LIMIT 50;

-- 3) Optional: preview exact INSERT statements (select to generate SQL)
-- This outputs text rows that you can inspect or pipe to a client for review.
SELECT 'INSERT INTO outreach_properties (louis_property_id, property_address, suburb, street, city, region, owner_name, property_type, campaign, status, created_at, updated_at, selected_by, selected_at, notes) VALUES ('
  || quote_literal(louis_property_id::text) || ', ' || quote_literal(property_address) || ', ' || quote_literal(suburb) || ', ' || quote_literal(street) || ', ' || quote_literal(city) || ', ' || quote_literal('Auckland') || ', NULL, NULL, ' || quote_literal('legacy_import') || ', ' || quote_literal(lower(status)) || ', ' || quote_literal(selected_at::text) || ', ' || quote_literal(selected_at::text) || ', ' || quote_literal(selected_by) || ', ' || quote_literal(selected_at::text) || ', ' || quote_literal(notes::text) || ');' as stmt
FROM outreach_selected_properties osp
LEFT JOIN outreach_properties op
  ON (osp.louis_property_id IS NOT NULL AND op.louis_property_id = osp.louis_property_id)
  OR (osp.louis_property_id IS NULL AND op.property_address ILIKE osp.property_address AND op.campaign = 'legacy_import')
WHERE op.id IS NULL
LIMIT 100;

-- 4) Optional transactional test (UNCOMMENT to run in test DB). It inserts and then ROLLBACKs.
-- NOTE: Run only in a non-production/test database.
-- BEGIN;
-- INSERT INTO outreach_properties
--   (louis_property_id, property_address, suburb, street, city, region, owner_name, property_type, campaign, status, created_at, updated_at, selected_by, selected_at, notes)
-- SELECT
--   louis_property_id::text,
--   property_address,
--   suburb,
--   street,
--   city,
--   'Auckland'::text AS region,
--   NULL AS owner_name,
--   NULL AS property_type,
--   'legacy_import'::text AS campaign,
--   LOWER(status)::text AS status,
--   selected_at AS created_at,
--   selected_at AS updated_at,
--   selected_by,
--   selected_at,
--   notes
-- FROM outreach_selected_properties osp
-- LEFT JOIN outreach_properties op
--   ON (osp.louis_property_id IS NOT NULL AND op.louis_property_id = osp.louis_property_id)
--   OR (osp.louis_property_id IS NULL AND op.property_address ILIKE osp.property_address AND op.campaign = 'legacy_import')
-- WHERE op.id IS NULL
-- RETURNING id;
-- ROLLBACK;

-- 5) Post-run verification queries (run after actual migration)
-- SELECT COUNT(*) FROM outreach_selected_properties;
-- SELECT COUNT(*) FROM outreach_properties WHERE campaign = 'legacy_import';
-- SELECT COUNT(*) FROM outreach_qr_tokens WHERE outreach_property_id IS NOT NULL AND token IS NOT NULL;

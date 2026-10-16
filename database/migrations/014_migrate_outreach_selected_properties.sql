-- Migration: 014 - Migrate outreach_selected_properties -> outreach_properties
-- This script copies rows from the legacy outreach_selected_properties
-- into the unified outreach_properties table, then renames the legacy table.

BEGIN;

-- 1) Insert missing properties into outreach_properties
INSERT INTO outreach_properties
  (louis_property_id, property_address, suburb, street, city, region, owner_name,
   property_type, campaign, status, created_at, updated_at, selected_by, selected_at, notes)
SELECT
  louis_property_id::text,
  property_address,
  suburb,
  street,
  city,
  'Auckland'::text AS region,
  NULL AS owner_name,
  NULL AS property_type,
  'legacy_import'::text AS campaign,
  LOWER(status)::text AS status,
  selected_at AS created_at,
  selected_at AS updated_at,
  selected_by,
  selected_at,
  notes
FROM outreach_selected_properties
WHERE property_address IS NOT NULL
ON CONFLICT (property_address, campaign) DO NOTHING;

-- 2) Migrate tracking_code into outreach_qr_tokens where applicable
INSERT INTO outreach_qr_tokens (token, outreach_property_id, created_at)
SELECT osp.tracking_code, op.id, NOW()
FROM outreach_selected_properties osp
JOIN outreach_properties op
  ON op.property_address = osp.property_address AND op.campaign = 'legacy_import'
WHERE osp.tracking_code IS NOT NULL
ON CONFLICT (token) DO NOTHING;

-- 3) Archive legacy table (rename)
ALTER TABLE outreach_selected_properties RENAME TO outreach_selected_properties_archive_20260703;

COMMIT;

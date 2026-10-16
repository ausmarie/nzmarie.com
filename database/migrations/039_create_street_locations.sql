-- =====================================================
-- Migration 039: Create street_locations for geo-aware outreach
-- Created: 2026-08-01
-- Purpose: Store a representative point (lat/lng) for each street
--          so nearby streets can be clustered to plan mail runs.
--          Primary source: aggregate lat/lng from properties table (free).
-- =====================================================

-- Create the street_locations table
CREATE TABLE IF NOT EXISTS street_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suburb VARCHAR(100) NOT NULL,
  street VARCHAR(200) NOT NULL,
  center_lat DOUBLE PRECISION,
  center_lng DOUBLE PRECISION,
  source VARCHAR(20) NOT NULL DEFAULT 'properties',
  property_count INT DEFAULT 0,
  geocoded_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT uq_street_location UNIQUE(suburb, street)
);

-- Index for suburb + street lookup
CREATE INDEX IF NOT EXISTS idx_street_locations_suburb_street
ON street_locations(suburb, street);

-- Index for suburb + lat/lng (used for clustering fallback)
CREATE INDEX IF NOT EXISTS idx_street_locations_suburb_geo
ON street_locations(suburb, center_lat, center_lng);

-- =====================================================
-- Populate from properties: aggregate the average lat/lng of
-- all properties joined to each outreach street.
-- Only fills rows that have coordinates; missing ones are left
-- for incremental geocoding (see street prewarm scripts).
-- =====================================================
INSERT INTO street_locations (suburb, street, center_lat, center_lng, source, property_count)
SELECT
  op.suburb,
  op.street,
  AVG(p.latitude) AS center_lat,
  AVG(p.longitude) AS center_lng,
  'properties' AS source,
  COUNT(*) AS property_count
FROM outreach_properties op
JOIN properties p ON REPLACE(op.property_id::text, '-', '') = p.id
WHERE op.street IS NOT NULL
  AND TRIM(op.street) <> ''
  AND p.latitude IS NOT NULL
  AND p.longitude IS NOT NULL
GROUP BY op.suburb, op.street
ON CONFLICT (suburb, street) DO UPDATE
  SET center_lat = EXCLUDED.center_lat,
      center_lng = EXCLUDED.center_lng,
      source = 'properties',
      property_count = EXCLUDED.property_count,
      updated_at = NOW();

-- =====================================================
-- Migration Complete
-- =====================================================

-- Migration: 011 - Add region and city columns to appraisal_leads
-- Database: Marie DB
-- Purpose: Add region and city fields for three-tier location tracking (Region > City > Suburb)
-- Date: 2026-07-02

-- Add region column if it doesn't exist
ALTER TABLE appraisal_leads 
ADD COLUMN IF NOT EXISTS region VARCHAR(100);

-- Add city column if it doesn't exist
ALTER TABLE appraisal_leads 
ADD COLUMN IF NOT EXISTS city VARCHAR(100);

-- Create indexes for region and city lookups
CREATE INDEX IF NOT EXISTS idx_appraisal_leads_region ON appraisal_leads(region);
CREATE INDEX IF NOT EXISTS idx_appraisal_leads_city ON appraisal_leads(city);

-- Add comments for documentation
COMMENT ON COLUMN appraisal_leads.region IS 'Region/Province (e.g., Auckland, Wellington) - top-level geographic grouping';
COMMENT ON COLUMN appraisal_leads.city IS 'City/District (e.g., North Shore City, Auckland City) - mid-level geographic grouping';
COMMENT ON COLUMN appraisal_leads.suburb IS 'Suburb/Neighborhood (e.g., Albany, Takapuna) - lowest-level geographic grouping';

-- Notes:
-- This creates a three-tier geographic hierarchy:
-- Region > City/District > Suburb
-- This matches the structure used in /admin/properties for consistent data analysis

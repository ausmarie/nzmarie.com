-- Migration: 009 - Add suburb column to appraisal_leads
-- Database: Marie DB
-- Purpose: Add suburb field to appraisal_leads for tracking and correlation with direct mail

-- Add suburb column if it doesn't exist
ALTER TABLE appraisal_leads 
ADD COLUMN IF NOT EXISTS suburb VARCHAR(100);

-- Create index for suburb lookups
CREATE INDEX IF NOT EXISTS idx_appraisal_leads_suburb ON appraisal_leads(suburb);

-- Add comment
COMMENT ON COLUMN appraisal_leads.suburb IS 'Suburb extracted from property address - required for tracking and correlation';

-- Note: For existing records without suburb, you can run:
-- UPDATE appraisal_leads 
-- SET suburb = (SELECT regexp_match(property_address, '([A-Z][a-z]+(?: [A-Z][a-z]+)*),'))[1]
-- WHERE suburb IS NULL;

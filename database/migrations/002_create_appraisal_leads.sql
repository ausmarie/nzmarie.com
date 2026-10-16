-- Migration: 002 - Create appraisal_leads table
-- Database: Marie DB
-- Purpose: Store Free Property Appraisal requests from website

CREATE TABLE IF NOT EXISTS appraisal_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Contact Information
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  
  -- Property Information
  property_address TEXT NOT NULL,
  suburb VARCHAR(100) NOT NULL,  -- NEW: Required for tracking
  property_type VARCHAR(50),
  
  -- Lead Management
  priority VARCHAR(20) DEFAULT 'medium',  -- 'high', 'medium', 'low'
  contact_status VARCHAR(50) DEFAULT 'not_contacted',  -- 'not_contacted', 'contacted', 'scheduled', 'appraised', 'converted', 'lost'
  
  -- Follow-up Tracking
  follow_up_at TIMESTAMPTZ,
  last_contact_at TIMESTAMPTZ,
  agent_notes TEXT,
  
  -- Source Tracking
  source VARCHAR(50) DEFAULT 'website',  -- 'website', 'direct_mail', 'referral'
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_appraisal_suburb ON appraisal_leads(suburb);
CREATE INDEX IF NOT EXISTS idx_appraisal_contact_status ON appraisal_leads(contact_status);
CREATE INDEX IF NOT EXISTS idx_appraisal_follow_up_at ON appraisal_leads(follow_up_at);
CREATE INDEX IF NOT EXISTS idx_appraisal_priority ON appraisal_leads(priority);
CREATE INDEX IF NOT EXISTS idx_appraisal_created_at ON appraisal_leads(created_at);

-- Updated_at trigger
CREATE TRIGGER trg_appraisal_leads_updated_at
BEFORE UPDATE ON appraisal_leads
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE appraisal_leads IS 'Stores all Free Property Appraisal requests from the website';
COMMENT ON COLUMN appraisal_leads.suburb IS 'Required for tracking downloads and direct mail campaigns';
COMMENT ON COLUMN appraisal_leads.contact_status IS 'Current status of lead follow-up process';

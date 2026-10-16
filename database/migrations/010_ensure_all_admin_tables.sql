-- Migration: 010 - Ensure all admin system tables exist
-- Database: Marie DB
-- Purpose: Create any missing tables required by the admin system design
-- Note: This migration is idempotent (safe to run multiple times)

-- ============================================================================
-- Helper function for updated_at triggers (if not exists)
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Ensure report_downloads table exists (design document schema)
-- ============================================================================

CREATE TABLE IF NOT EXISTS report_downloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User Information
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  
  -- Download Details
  suburb VARCHAR(100) NOT NULL,
  report_type VARCHAR(50) DEFAULT 'local_market',  -- 'local_market', 'suburb_report'
  downloaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Source Tracking
  source VARCHAR(50),  -- 'direct_mail', 'organic', 'social', 'referral'
  campaign_id UUID,
  tracking_code VARCHAR(50),
  
  -- User Agent & IP (for fraud detection)
  user_agent TEXT,
  ip_address VARCHAR(45),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_report_email_suburb ON report_downloads(email, suburb);
CREATE INDEX IF NOT EXISTS idx_report_downloaded_at ON report_downloads(downloaded_at);
CREATE INDEX IF NOT EXISTS idx_report_suburb ON report_downloads(suburb);
CREATE INDEX IF NOT EXISTS idx_report_tracking_code ON report_downloads(tracking_code);

COMMENT ON TABLE report_downloads IS 'Tracks all PDF downloads with 5/month limit per email+suburb';

-- ============================================================================
-- Ensure direct_mail_campaigns table exists
-- ============================================================================

CREATE TABLE IF NOT EXISTS direct_mail_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Campaign Details
  campaign_name VARCHAR(200) NOT NULL,
  suburb VARCHAR(100) NOT NULL,
  sent_date DATE NOT NULL,
  total_addresses INT DEFAULT 0,
  status VARCHAR(50) DEFAULT 'planned',  -- 'planned', 'in_progress', 'sent', 'completed'
  
  -- Financial Data (Louis Only)
  printing_cost DECIMAL(10, 2) DEFAULT 0,
  postage_cost DECIMAL(10, 2) DEFAULT 0,
  total_cost DECIMAL(10, 2) GENERATED ALWAYS AS (printing_cost + postage_cost) STORED,
  
  -- Campaign Stats (auto-calculated)
  download_count INT DEFAULT 0,
  appraisal_count INT DEFAULT 0,
  conversion_count INT DEFAULT 0,
  total_revenue DECIMAL(12, 2) DEFAULT 0,
  
  -- Metadata
  created_by VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaign_suburb ON direct_mail_campaigns(suburb);
CREATE INDEX IF NOT EXISTS idx_campaign_sent_date ON direct_mail_campaigns(sent_date);
CREATE INDEX IF NOT EXISTS idx_campaign_status ON direct_mail_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaign_created_at ON direct_mail_campaigns(created_at);

COMMENT ON TABLE direct_mail_campaigns IS 'Marketing campaign metadata with financial tracking';

-- ============================================================================
-- Ensure direct_mail_addresses table exists
-- ============================================================================

CREATE TABLE IF NOT EXISTS direct_mail_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Campaign Link
  campaign_id UUID NOT NULL REFERENCES direct_mail_campaigns(id) ON DELETE CASCADE,
  
  -- Property Information
  property_address TEXT NOT NULL,
  suburb VARCHAR(100) NOT NULL,
  property_id UUID,  -- Optional link to Louis DB properties table
  
  -- Mailing Details
  mailed_date DATE NOT NULL,
  tracking_code VARCHAR(50) UNIQUE NOT NULL,
  
  -- Automatic Tracking (updated by application layer)
  has_downloaded BOOLEAN DEFAULT FALSE,
  download_count INT DEFAULT 0,
  first_download_at TIMESTAMPTZ,
  last_download_at TIMESTAMPTZ,
  
  has_requested_appraisal BOOLEAN DEFAULT FALSE,
  appraisal_request_at TIMESTAMPTZ,
  
  -- Manual Contact Management (Marie updates)
  contact_status VARCHAR(50) DEFAULT 'not_contacted',
  last_contact_at TIMESTAMPTZ,
  contact_notes TEXT,
  
  -- Conversion Tracking
  is_converted BOOLEAN DEFAULT FALSE,
  converted_at TIMESTAMPTZ,
  conversion_value DECIMAL(10, 2),  -- Louis only
  
  -- Follow-up Planning
  next_follow_up_at DATE,
  follow_up_type VARCHAR(50),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dma_campaign_id ON direct_mail_addresses(campaign_id);
CREATE INDEX IF NOT EXISTS idx_dma_suburb ON direct_mail_addresses(suburb);
CREATE INDEX IF NOT EXISTS idx_dma_tracking_code ON direct_mail_addresses(tracking_code);
CREATE INDEX IF NOT EXISTS idx_dma_contact_status ON direct_mail_addresses(contact_status);
CREATE INDEX IF NOT EXISTS idx_dma_next_follow_up ON direct_mail_addresses(next_follow_up_at);
CREATE INDEX IF NOT EXISTS idx_dma_has_downloaded ON direct_mail_addresses(has_downloaded);
CREATE INDEX IF NOT EXISTS idx_dma_has_requested_appraisal ON direct_mail_addresses(has_requested_appraisal);

CREATE UNIQUE INDEX IF NOT EXISTS idx_dma_campaign_address 
ON direct_mail_addresses(campaign_id, property_address);

COMMENT ON TABLE direct_mail_addresses IS 'Core table tracking all mailed addresses with download and conversion status';

-- ============================================================================
-- Ensure outreach_tasks table exists
-- ============================================================================

CREATE TABLE IF NOT EXISTS outreach_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Campaign Link (Optional)
  campaign_id UUID REFERENCES direct_mail_campaigns(id) ON DELETE SET NULL,
  
  -- Property Information (from Louis DB)
  property_id UUID NOT NULL,
  property_address TEXT NOT NULL,
  street VARCHAR(255),
  suburb VARCHAR(100) NOT NULL,
  
  -- Tracking
  tracking_code VARCHAR(50) UNIQUE NOT NULL,
  status VARCHAR(20) DEFAULT 'PENDING',  -- 'PENDING', 'SENT', 'RETURNED'
  
  -- Workflow Management
  added_by VARCHAR(255),
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  sent_by VARCHAR(255),
  
  -- Auto-updated Engagement
  has_downloaded BOOLEAN DEFAULT FALSE,
  has_requested_appraisal BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outreach_status ON outreach_tasks(status);
CREATE INDEX IF NOT EXISTS idx_outreach_suburb ON outreach_tasks(suburb);
CREATE INDEX IF NOT EXISTS idx_outreach_added_at ON outreach_tasks(added_at);
CREATE INDEX IF NOT EXISTS idx_outreach_sent_at ON outreach_tasks(sent_at);
CREATE INDEX IF NOT EXISTS idx_outreach_property_id ON outreach_tasks(property_id);
CREATE INDEX IF NOT EXISTS idx_outreach_tracking_code ON outreach_tasks(tracking_code);

CREATE UNIQUE INDEX IF NOT EXISTS idx_outreach_property_suburb 
ON outreach_tasks(property_address, suburb) WHERE status != 'RETURNED';

COMMENT ON TABLE outreach_tasks IS 'Queue of direct mail tasks - Properties selected from Louis DB to mail';

-- ============================================================================
-- Ensure suburb_reports table exists
-- ============================================================================

CREATE TABLE IF NOT EXISTS suburb_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Report Details
  suburb VARCHAR(100) NOT NULL,
  quarter VARCHAR(10) NOT NULL,  -- Format: 'Q1-2026', 'Q2-2026'
  year INT NOT NULL,
  
  -- File Information
  file_url TEXT NOT NULL,  -- Cloudflare R2 public URL
  file_name VARCHAR(255) NOT NULL,
  file_size INT,  -- Bytes
  
  -- Statistics
  download_count INT DEFAULT 0,
  view_count INT DEFAULT 0,
  
  -- Status
  status VARCHAR(20) DEFAULT 'active',  -- 'draft', 'active', 'archived'
  
  -- Metadata
  uploaded_by VARCHAR(255),
  notes TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_suburb_reports_suburb_quarter 
ON suburb_reports(suburb, quarter, year);

CREATE INDEX IF NOT EXISTS idx_suburb_reports_suburb ON suburb_reports(suburb);
CREATE INDEX IF NOT EXISTS idx_suburb_reports_quarter ON suburb_reports(quarter, year);
CREATE INDEX IF NOT EXISTS idx_suburb_reports_status ON suburb_reports(status);
CREATE INDEX IF NOT EXISTS idx_suburb_reports_uploaded_at ON suburb_reports(uploaded_at);

COMMENT ON TABLE suburb_reports IS 'Quarterly market reports stored in Cloudflare R2';

-- ============================================================================
-- Add updated_at triggers to tables that need them
-- ============================================================================

DROP TRIGGER IF EXISTS trg_direct_mail_campaigns_updated_at ON direct_mail_campaigns;
CREATE TRIGGER trg_direct_mail_campaigns_updated_at
BEFORE UPDATE ON direct_mail_campaigns
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_direct_mail_addresses_updated_at ON direct_mail_addresses;
CREATE TRIGGER trg_direct_mail_addresses_updated_at
BEFORE UPDATE ON direct_mail_addresses
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_outreach_tasks_updated_at ON outreach_tasks;
CREATE TRIGGER trg_outreach_tasks_updated_at
BEFORE UPDATE ON outreach_tasks
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_suburb_reports_updated_at ON suburb_reports;
CREATE TRIGGER trg_suburb_reports_updated_at
BEFORE UPDATE ON suburb_reports
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Verification queries
-- ============================================================================

-- Run these to verify the migration succeeded:

-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' 
-- AND table_name IN (
--   'report_downloads', 
--   'direct_mail_campaigns', 
--   'direct_mail_addresses',
--   'outreach_tasks',
--   'suburb_reports'
-- )
-- ORDER BY table_name;

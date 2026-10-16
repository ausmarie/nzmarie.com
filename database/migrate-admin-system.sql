-- ============================================================================
-- Admin System Migration - Safe Update Script
-- Database: Marie DB (Singapore)
-- Purpose: Add new tables for admin system without breaking existing data
-- ============================================================================

-- Step 1: Update existing appraisal_leads table
ALTER TABLE appraisal_leads 
ADD COLUMN IF NOT EXISTS suburb VARCHAR(100),
ADD COLUMN IF NOT EXISTS property_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'medium',
ADD COLUMN IF NOT EXISTS contact_status VARCHAR(50) DEFAULT 'not_contacted',
ADD COLUMN IF NOT EXISTS last_contact_at TIMESTAMPTZ;

-- Step 2: Create report_downloads table
CREATE TABLE IF NOT EXISTS report_downloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  suburb VARCHAR(100) NOT NULL,
  report_type VARCHAR(50) DEFAULT 'local_market',
  downloaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source VARCHAR(50),
  campaign_id UUID,
  tracking_code VARCHAR(50),
  user_agent TEXT,
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Step 3: Create direct_mail_campaigns table
CREATE TABLE IF NOT EXISTS direct_mail_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_name VARCHAR(200) NOT NULL,
  suburb VARCHAR(100) NOT NULL,
  sent_date DATE NOT NULL,
  total_addresses INT DEFAULT 0,
  status VARCHAR(50) DEFAULT 'planned',
  printing_cost DECIMAL(10, 2) DEFAULT 0,
  postage_cost DECIMAL(10, 2) DEFAULT 0,
  total_cost DECIMAL(10, 2) GENERATED ALWAYS AS (printing_cost + postage_cost) STORED,
  download_count INT DEFAULT 0,
  appraisal_count INT DEFAULT 0,
  conversion_count INT DEFAULT 0,
  total_revenue DECIMAL(12, 2) DEFAULT 0,
  created_by VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Step 4: Create direct_mail_addresses table
CREATE TABLE IF NOT EXISTS direct_mail_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES direct_mail_campaigns(id) ON DELETE CASCADE,
  property_address TEXT NOT NULL,
  suburb VARCHAR(100) NOT NULL,
  property_id UUID,
  mailed_date DATE NOT NULL,
  tracking_code VARCHAR(50) UNIQUE NOT NULL,
  has_downloaded BOOLEAN DEFAULT FALSE,
  download_count INT DEFAULT 0,
  first_download_at TIMESTAMPTZ,
  last_download_at TIMESTAMPTZ,
  has_requested_appraisal BOOLEAN DEFAULT FALSE,
  appraisal_request_at TIMESTAMPTZ,
  contact_status VARCHAR(50) DEFAULT 'not_contacted',
  last_contact_at TIMESTAMPTZ,
  contact_notes TEXT,
  is_converted BOOLEAN DEFAULT FALSE,
  converted_at TIMESTAMPTZ,
  conversion_value DECIMAL(10, 2),
  next_follow_up_at DATE,
  follow_up_type VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Step 5: Create outreach_tasks table
CREATE TABLE IF NOT EXISTS outreach_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES direct_mail_campaigns(id) ON DELETE SET NULL,
  property_id UUID NOT NULL,
  property_address TEXT NOT NULL,
  street VARCHAR(255),
  suburb VARCHAR(100) NOT NULL,
  tracking_code VARCHAR(50) UNIQUE NOT NULL,
  status VARCHAR(20) DEFAULT 'PENDING',
  added_by VARCHAR(255),
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  sent_by VARCHAR(255),
  has_downloaded BOOLEAN DEFAULT FALSE,
  has_requested_appraisal BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Step 6: Create suburb_reports table
CREATE TABLE IF NOT EXISTS suburb_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suburb VARCHAR(100) NOT NULL,
  quarter VARCHAR(10) NOT NULL,
  year INT NOT NULL,
  doc_label VARCHAR(100) NOT NULL DEFAULT 'Main Report',
  file_url TEXT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_size INT,
  download_count INT DEFAULT 0,
  view_count INT DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active',
  uploaded_by VARCHAR(255),
  notes TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Step 7: Create all indexes AFTER tables exist
CREATE INDEX IF NOT EXISTS idx_appraisal_suburb ON appraisal_leads(suburb);
CREATE INDEX IF NOT EXISTS idx_appraisal_contact_status ON appraisal_leads(contact_status);
CREATE INDEX IF NOT EXISTS idx_appraisal_priority ON appraisal_leads(priority);

CREATE INDEX IF NOT EXISTS idx_report_email_suburb ON report_downloads(email, suburb);
CREATE INDEX IF NOT EXISTS idx_report_downloaded_at ON report_downloads(downloaded_at);
CREATE INDEX IF NOT EXISTS idx_report_suburb ON report_downloads(suburb);
CREATE INDEX IF NOT EXISTS idx_report_tracking_code ON report_downloads(tracking_code);

CREATE INDEX IF NOT EXISTS idx_campaign_suburb ON direct_mail_campaigns(suburb);
CREATE INDEX IF NOT EXISTS idx_campaign_sent_date ON direct_mail_campaigns(sent_date);
CREATE INDEX IF NOT EXISTS idx_campaign_status ON direct_mail_campaigns(status);

CREATE INDEX IF NOT EXISTS idx_dma_campaign_id ON direct_mail_addresses(campaign_id);
CREATE INDEX IF NOT EXISTS idx_dma_suburb ON direct_mail_addresses(suburb);
CREATE INDEX IF NOT EXISTS idx_dma_tracking_code ON direct_mail_addresses(tracking_code);
CREATE INDEX IF NOT EXISTS idx_dma_contact_status ON direct_mail_addresses(contact_status);
CREATE INDEX IF NOT EXISTS idx_dma_next_follow_up ON direct_mail_addresses(next_follow_up_at);
CREATE INDEX IF NOT EXISTS idx_dma_has_downloaded ON direct_mail_addresses(has_downloaded);
CREATE INDEX IF NOT EXISTS idx_dma_has_requested_appraisal ON direct_mail_addresses(has_requested_appraisal);
CREATE UNIQUE INDEX IF NOT EXISTS idx_dma_campaign_address ON direct_mail_addresses(campaign_id, property_address);

CREATE INDEX IF NOT EXISTS idx_outreach_status ON outreach_tasks(status);
CREATE INDEX IF NOT EXISTS idx_outreach_suburb ON outreach_tasks(suburb);
CREATE INDEX IF NOT EXISTS idx_outreach_added_at ON outreach_tasks(added_at);
CREATE INDEX IF NOT EXISTS idx_outreach_sent_at ON outreach_tasks(sent_at);
CREATE INDEX IF NOT EXISTS idx_outreach_property_id ON outreach_tasks(property_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_outreach_property_suburb ON outreach_tasks(property_address, suburb) WHERE status != 'RETURNED';

CREATE UNIQUE INDEX IF NOT EXISTS idx_suburb_reports_suburb_quarter_label ON suburb_reports(suburb, quarter, year, doc_label);
CREATE INDEX IF NOT EXISTS idx_suburb_reports_doc_label ON suburb_reports(doc_label);
CREATE INDEX IF NOT EXISTS idx_suburb_reports_suburb ON suburb_reports(suburb);
CREATE INDEX IF NOT EXISTS idx_suburb_reports_quarter ON suburb_reports(quarter, year);
CREATE INDEX IF NOT EXISTS idx_suburb_reports_status ON suburb_reports(status);

-- Verification
SELECT 'Migration completed successfully!' AS status;

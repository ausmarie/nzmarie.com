-- ============================================================================
-- Admin System - Complete Database Schema
-- Database: Marie DB (Singapore) - Read/Write
-- Purpose: Admin system for nzmarie.com real estate CRM
-- Created: 2026-06-30
-- ============================================================================

-- Important Notes:
-- 1. Execute on Marie DB only (Singapore cluster)
-- 2. Louis DB (Jakarta) is READ-ONLY for properties data
-- 3. All tables use UUID as primary key
-- 4. Automatic triggers update engagement tracking
-- 5. Financial data columns are visible to Louis (super_admin) only

-- ============================================================================
-- SECTION 1: HELPER FUNCTIONS
-- ============================================================================

-- Note: For CockroachDB compatibility, we've removed complex triggers
-- updated_at columns will be managed in application layer
-- See lib/db-helpers.ts for update helpers

-- ============================================================================
-- SECTION 2: USER MANAGEMENT
-- ============================================================================

-- Table: admin_users
-- Purpose: Store admin user roles and permissions
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  role VARCHAR(50) NOT NULL,  -- 'super_admin' or 'admin'
  name VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_role ON admin_users(role);

-- Insert initial admin users
INSERT INTO admin_users (email, role, name) VALUES
  ('nzlouis.com@gmail.com', 'super_admin', 'Louis'),
  ('nzmarie.com@gmail.com', 'admin', 'Marie')
ON CONFLICT (email) DO NOTHING;

-- ============================================================================
-- SECTION 3: LEAD MANAGEMENT
-- ============================================================================

-- Table: appraisal_leads
-- Purpose: Store Free Property Appraisal requests from website
CREATE TABLE IF NOT EXISTS appraisal_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Contact Information
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  
  -- Property Information
  property_address TEXT NOT NULL,
  suburb VARCHAR(100) NOT NULL,  -- Required for tracking
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

CREATE INDEX IF NOT EXISTS idx_appraisal_suburb ON appraisal_leads(suburb);
CREATE INDEX IF NOT EXISTS idx_appraisal_contact_status ON appraisal_leads(contact_status);
CREATE INDEX IF NOT EXISTS idx_appraisal_follow_up_at ON appraisal_leads(follow_up_at);
CREATE INDEX IF NOT EXISTS idx_appraisal_priority ON appraisal_leads(priority);
CREATE INDEX IF NOT EXISTS idx_appraisal_created_at ON appraisal_leads(created_at);

COMMENT ON TABLE appraisal_leads IS 'Stores all Free Property Appraisal requests from the website';
COMMENT ON COLUMN appraisal_leads.suburb IS 'Required for tracking downloads and direct mail campaigns';
COMMENT ON COLUMN appraisal_leads.contact_status IS 'Current status of lead follow-up process';

-- ============================================================================
-- SECTION 4: DOWNLOAD TRACKING
-- ============================================================================

-- Table: report_downloads
-- Purpose: Track all Local Market Report PDF downloads with 5/month limit
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
-- SECTION 5: DIRECT MAIL CAMPAIGNS
-- ============================================================================

-- Table: direct_mail_campaigns
-- Purpose: Store marketing campaign metadata
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
COMMENT ON COLUMN direct_mail_campaigns.printing_cost IS 'Louis only - printing cost';
COMMENT ON COLUMN direct_mail_campaigns.postage_cost IS 'Louis only - postage cost';
COMMENT ON COLUMN direct_mail_campaigns.total_revenue IS 'Louis only - total conversion revenue';

-- Table: direct_mail_addresses
-- Purpose: Track individual addresses where direct mail was sent
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
  
  -- Automatic Tracking (updated by triggers)
  has_downloaded BOOLEAN DEFAULT FALSE,
  download_count INT DEFAULT 0,
  first_download_at TIMESTAMPTZ,
  last_download_at TIMESTAMPTZ,
  
  has_requested_appraisal BOOLEAN DEFAULT FALSE,
  appraisal_request_at TIMESTAMPTZ,
  
  -- Manual Contact Management (Marie updates)
  contact_status VARCHAR(50) DEFAULT 'not_contacted',  -- 'not_contacted', 'attempted', 'contacted', 'interested', 'not_interested'
  last_contact_at TIMESTAMPTZ,
  contact_notes TEXT,
  
  -- Conversion Tracking
  is_converted BOOLEAN DEFAULT FALSE,
  converted_at TIMESTAMPTZ,
  conversion_value DECIMAL(10, 2),  -- Louis only - commission amount
  
  -- Follow-up Planning
  next_follow_up_at DATE,
  follow_up_type VARCHAR(50),  -- 'q2_report', 'q3_report', 'seasonal_card', 'call'
  
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
COMMENT ON COLUMN direct_mail_addresses.tracking_code IS 'Unique code for QR code tracking';
COMMENT ON COLUMN direct_mail_addresses.has_downloaded IS 'Auto-updated by trigger when user downloads report';
COMMENT ON COLUMN direct_mail_addresses.has_requested_appraisal IS 'Auto-updated by trigger when user requests appraisal';
COMMENT ON COLUMN direct_mail_addresses.conversion_value IS 'Louis only - commission earned from this lead';

-- ============================================================================
-- SECTION 6: OUTREACH WORKFLOW
-- ============================================================================

-- Table: outreach_tasks
-- Purpose: Queue of properties to send direct mail to (Pending/Sent workflow)
CREATE TABLE IF NOT EXISTS outreach_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Campaign Link (Optional)
  campaign_id UUID REFERENCES direct_mail_campaigns(id) ON DELETE SET NULL,
  
  -- Property Information (from Louis DB)
  property_id UUID NOT NULL,  -- Links to Louis DB properties.id
  property_address TEXT NOT NULL,
  street VARCHAR(255),
  suburb VARCHAR(100) NOT NULL,
  
  -- Tracking
  tracking_code VARCHAR(50) UNIQUE NOT NULL,
  status VARCHAR(20) DEFAULT 'PENDING',  -- 'PENDING', 'SENT', 'RETURNED'
  
  -- Workflow Management
  added_by VARCHAR(255),  -- Who added this to queue
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  sent_by VARCHAR(255),  -- Who marked as sent (usually Louis)
  
  -- Auto-updated Engagement (from triggers)
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_outreach_property_suburb 
ON outreach_tasks(property_address, suburb) WHERE status != 'RETURNED';

COMMENT ON TABLE outreach_tasks IS 'Queue of direct mail tasks - Properties selected from Louis DB to mail';
COMMENT ON COLUMN outreach_tasks.status IS 'PENDING = ready to print/mail, SENT = already mailed, RETURNED = undeliverable';
COMMENT ON COLUMN outreach_tasks.tracking_code IS 'QR code identifier for download tracking';

-- ============================================================================
-- SECTION 7: SUBURB REPORTS
-- ============================================================================

-- Table: suburb_reports
-- Purpose: Store quarterly market report PDFs uploaded to Cloudflare R2
CREATE TABLE IF NOT EXISTS suburb_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Report Details
  suburb VARCHAR(100) NOT NULL,
  quarter VARCHAR(10) NOT NULL,  -- Format: 'Q1-2026', 'Q2-2026'
  year INT NOT NULL,
  doc_label VARCHAR(100) NOT NULL DEFAULT 'Main Report',  -- e.g. Main Report, Cover Letter, About Marie

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

CREATE UNIQUE INDEX IF NOT EXISTS idx_suburb_reports_suburb_quarter_label 
ON suburb_reports(suburb, quarter, year, doc_label);

CREATE INDEX IF NOT EXISTS idx_suburb_reports_doc_label ON suburb_reports(doc_label);

CREATE INDEX IF NOT EXISTS idx_suburb_reports_suburb ON suburb_reports(suburb);
CREATE INDEX IF NOT EXISTS idx_suburb_reports_quarter ON suburb_reports(quarter, year);
CREATE INDEX IF NOT EXISTS idx_suburb_reports_status ON suburb_reports(status);
CREATE INDEX IF NOT EXISTS idx_suburb_reports_uploaded_at ON suburb_reports(uploaded_at);

COMMENT ON TABLE suburb_reports IS 'Quarterly market reports stored in Cloudflare R2';
COMMENT ON COLUMN suburb_reports.quarter IS 'Format: Q1-2026, Q2-2026, etc.';
COMMENT ON COLUMN suburb_reports.file_url IS 'Public Cloudflare R2 URL';

-- ============================================================================
-- SECTION 8: NOTES ON AUTOMATIC TRACKING
-- ============================================================================

-- IMPORTANT: CockroachDB has limited support for complex triggers with PL/pgSQL
-- The following tracking logic must be implemented in the application layer:

-- 1. Download Tracking:
--    When a user downloads a report (report_downloads insert):
--    - Update direct_mail_addresses SET has_downloaded = TRUE WHERE tracking_code matches
--    - Update outreach_tasks SET has_downloaded = TRUE WHERE tracking_code matches

-- 2. Appraisal Tracking:
--    When a user requests an appraisal (appraisal_leads insert):
--    - Update direct_mail_addresses SET has_requested_appraisal = TRUE WHERE address+suburb matches
--    - Update outreach_tasks SET has_requested_appraisal = TRUE WHERE address+suburb matches

-- 3. Campaign Stats:
--    When direct_mail_addresses is updated:
--    - Recalculate direct_mail_campaigns stats (download_count, appraisal_count, conversion_count, total_revenue)

-- See implementation in:
-- - app/api/download-report/route.ts (for download tracking)
-- - app/api/submit-appraisal/route.ts (for appraisal tracking)
-- - lib/campaign-stats.ts (for campaign stats updates)

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Run these queries after migration to verify success:

-- 1. Check all tables exist
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' ORDER BY table_name;

-- 2. Check triggers exist
-- SELECT trigger_name, event_object_table 
-- FROM information_schema.triggers 
-- WHERE trigger_schema = 'public' ORDER BY trigger_name;

-- 3. Check admin users
-- SELECT email, role, name FROM admin_users;

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================

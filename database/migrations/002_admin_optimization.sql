-- =====================================================
-- Admin System Optimization Migration
-- Created: 2026-06-29
-- Purpose: Add download tracking, direct mail campaigns, and enhanced features
-- =====================================================

-- =====================================================
-- 1. Ensure appraisal_leads has suburb field (already exists, add if missing)
-- =====================================================
ALTER TABLE appraisal_leads 
ADD COLUMN IF NOT EXISTS suburb VARCHAR(100);

-- Add index if not exists
CREATE INDEX IF NOT EXISTS idx_appraisal_suburb ON appraisal_leads(suburb);

-- =====================================================
-- 2. Enhanced report_downloads table with tracking
-- =====================================================
-- Add new columns if they don't exist
ALTER TABLE report_downloads
ADD COLUMN IF NOT EXISTS name VARCHAR(255),
ADD COLUMN IF NOT EXISTS phone VARCHAR(50),
ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45),
ADD COLUMN IF NOT EXISTS user_agent TEXT,
ADD COLUMN IF NOT EXISTS tracking_code VARCHAR(50);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_downloads_tracking_code ON report_downloads(tracking_code);
CREATE INDEX IF NOT EXISTS idx_downloads_source ON report_downloads(source);

-- =====================================================
-- 3. Create direct_mail_campaigns table
-- =====================================================
CREATE TABLE IF NOT EXISTS direct_mail_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Campaign info
  campaign_name VARCHAR(200) NOT NULL,
  suburb VARCHAR(100) NOT NULL,
  campaign_type VARCHAR(50) DEFAULT 'quarterly_report',
  
  -- Timing
  planned_date DATE,
  sent_date DATE NOT NULL,
  quarter VARCHAR(10),
  
  -- Stats
  total_addresses INT DEFAULT 0,
  total_printed INT DEFAULT 0,
  total_delivered INT DEFAULT 0,
  
  -- Status
  status VARCHAR(50) DEFAULT 'planned',
  
  -- Financial (Louis only)
  printing_cost DECIMAL(10, 2),
  postage_cost DECIMAL(10, 2),
  total_cost DECIMAL(10, 2) GENERATED ALWAYS AS (
    COALESCE(printing_cost, 0) + COALESCE(postage_cost, 0)
  ) STORED,
  
  -- Metadata
  created_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT
);

-- Ensure all enhancement columns exist (the table may already exist, created
-- by 004_create_direct_mail_campaigns.sql, without the columns below)
ALTER TABLE direct_mail_campaigns
ADD COLUMN IF NOT EXISTS campaign_type VARCHAR(50) DEFAULT 'quarterly_report',
ADD COLUMN IF NOT EXISTS planned_date DATE,
ADD COLUMN IF NOT EXISTS quarter VARCHAR(10),
ADD COLUMN IF NOT EXISTS total_printed INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_delivered INT DEFAULT 0;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_campaigns_suburb ON direct_mail_campaigns(suburb);
CREATE INDEX IF NOT EXISTS idx_campaigns_sent_date ON direct_mail_campaigns(sent_date);
CREATE INDEX IF NOT EXISTS idx_campaigns_quarter ON direct_mail_campaigns(quarter);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON direct_mail_campaigns(status);

-- =====================================================
-- 4. Create direct_mail_addresses table (CORE TABLE)
-- =====================================================
CREATE TABLE IF NOT EXISTS direct_mail_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Campaign link
  campaign_id UUID NOT NULL REFERENCES direct_mail_campaigns(id) ON DELETE CASCADE,
  
  -- Property info
  property_id UUID,
  property_address TEXT NOT NULL,
  street VARCHAR(255),
  suburb VARCHAR(100) NOT NULL,
  
  -- Owner info (optional)
  owner_name VARCHAR(255),
  owner_email VARCHAR(255),
  owner_phone VARCHAR(50),
  
  -- Mailing info
  mailed_date DATE NOT NULL,
  tracking_code VARCHAR(50) UNIQUE NOT NULL,
  mail_status VARCHAR(20) DEFAULT 'SENT',
  
  -- Auto-tracking (updated by triggers)
  has_downloaded BOOLEAN DEFAULT FALSE,
  download_count INT DEFAULT 0,
  first_download_at TIMESTAMPTZ,
  last_download_at TIMESTAMPTZ,
  
  has_requested_appraisal BOOLEAN DEFAULT FALSE,
  appraisal_requested_at TIMESTAMPTZ,
  appraisal_lead_id UUID REFERENCES appraisal_leads(id) ON DELETE SET NULL,
  
  -- Marie's manual fields
  contact_status VARCHAR(50) DEFAULT 'not_contacted',
  contact_attempts INT DEFAULT 0,
  last_contact_at TIMESTAMPTZ,
  next_follow_up_at DATE,
  follow_up_type VARCHAR(50),
  agent_notes TEXT,
  priority VARCHAR(20) DEFAULT 'medium',
  
  -- Conversion (Louis only)
  is_converted BOOLEAN DEFAULT FALSE,
  converted_at TIMESTAMPTZ,
  conversion_value DECIMAL(12, 2),
  commission_rate DECIMAL(5, 2),
  commission_amount DECIMAL(10, 2),
  
  -- Quarterly follow-up
  next_quarter_action VARCHAR(100),
  next_quarter_scheduled_at DATE,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by VARCHAR(255)
);

-- Ensure all enhancement columns exist (the table may already exist, created
-- by 005_create_direct_mail_addresses.sql, without the columns below)
ALTER TABLE direct_mail_addresses
ADD COLUMN IF NOT EXISTS street VARCHAR(255),
ADD COLUMN IF NOT EXISTS owner_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS owner_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS owner_phone VARCHAR(50),
ADD COLUMN IF NOT EXISTS mail_status VARCHAR(20) DEFAULT 'SENT',
ADD COLUMN IF NOT EXISTS appraisal_requested_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS appraisal_lead_id UUID,
ADD COLUMN IF NOT EXISTS contact_attempts INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS agent_notes TEXT,
ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'medium',
ADD COLUMN IF NOT EXISTS commission_rate DECIMAL(5, 2),
ADD COLUMN IF NOT EXISTS commission_amount DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS next_quarter_action VARCHAR(100),
ADD COLUMN IF NOT EXISTS next_quarter_scheduled_at DATE,
ADD COLUMN IF NOT EXISTS created_by VARCHAR(255);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_dma_campaign_id ON direct_mail_addresses(campaign_id);
CREATE INDEX IF NOT EXISTS idx_dma_suburb ON direct_mail_addresses(suburb);
CREATE INDEX IF NOT EXISTS idx_dma_contact_status ON direct_mail_addresses(contact_status);
CREATE INDEX IF NOT EXISTS idx_dma_next_follow_up ON direct_mail_addresses(next_follow_up_at) WHERE next_follow_up_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dma_mailed_date ON direct_mail_addresses(mailed_date);
CREATE INDEX IF NOT EXISTS idx_dma_tracking_code ON direct_mail_addresses(tracking_code);
CREATE INDEX IF NOT EXISTS idx_dma_has_downloaded ON direct_mail_addresses(has_downloaded);
CREATE INDEX IF NOT EXISTS idx_dma_has_requested_appraisal ON direct_mail_addresses(has_requested_appraisal);
CREATE INDEX IF NOT EXISTS idx_dma_is_converted ON direct_mail_addresses(is_converted);
CREATE INDEX IF NOT EXISTS idx_dma_owner_email ON direct_mail_addresses(owner_email);

-- Unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_dma_campaign_address 
ON direct_mail_addresses(campaign_id, property_address);

-- =====================================================
-- 5. Helper Functions & Triggers
-- =====================================================
-- NOTE: The PL/pgSQL helper functions and database triggers originally defined
--       here cannot run on CockroachDB (PL/pgSQL functions containing DML and
--       DROP/CREATE TRIGGER are not supported). Their behaviour is implemented
--       in the application layer instead:
--         - lib/tracking.ts (updateDownloadTracking / updateAppraisalTracking)
--         - app/api/reports/download/route.ts
--       The simple updated_at trigger on each table is created by the matching
--       00X_create_*.sql migration, and check_download_limit is created by
--       003_add_missing_fields.sql.
-- =====================================================

-- =====================================================
-- Migration Complete
-- =====================================================

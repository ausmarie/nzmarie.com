-- Migration: 003 - Create report_downloads table
-- Database: Marie DB
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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_report_email_suburb ON report_downloads(email, suburb);
CREATE INDEX IF NOT EXISTS idx_report_downloaded_at ON report_downloads(downloaded_at);
CREATE INDEX IF NOT EXISTS idx_report_suburb ON report_downloads(suburb);
CREATE INDEX IF NOT EXISTS idx_report_tracking_code ON report_downloads(tracking_code);

-- Function to check download limit (5 per month per email+suburb)
-- NOTE: check_download_limit is created by 003_add_missing_fields.sql as a
--       PL/pgSQL function returning JSONB (CockroachDB-compatible). The
--       BOOLEAN variant defined here is omitted to avoid a conflicting
--       function signature.

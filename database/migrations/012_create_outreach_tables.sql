-- =====================================================
-- Migration 012: Create Outreach Management Tables
-- Created: 2026-07-02
-- Purpose: Create tables for direct mail campaign management
-- =====================================================

-- Table 1: outreach_properties
-- Stores all properties for direct mail campaigns with full lifecycle tracking
CREATE TABLE IF NOT EXISTS outreach_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Property Information
  louis_property_id VARCHAR(100),  -- Optional: link to Louis DB
  property_address TEXT NOT NULL,
  suburb VARCHAR(100) NOT NULL,
  city VARCHAR(100) NOT NULL,
  region VARCHAR(100) NOT NULL,
  street VARCHAR(200),
  owner_name VARCHAR(200),
  property_type VARCHAR(50),  -- 'House', 'Townhouse', 'Apartment', etc.
  
  -- Campaign & Status
  campaign VARCHAR(100) NOT NULL DEFAULT '2026_Q3_Report',
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  -- Status values: 'pending' | 'sent' | 'interacted' | 'converted'
  
  -- Lifecycle Timestamps
  sent_at TIMESTAMP,
  interacted_at TIMESTAMP,
  converted_at TIMESTAMP,
  
  -- Additional Info
  notes TEXT,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT unique_address_per_campaign UNIQUE(property_address, campaign)
);

-- Indexes for outreach_properties
CREATE INDEX IF NOT EXISTS idx_outreach_status ON outreach_properties(status);
CREATE INDEX IF NOT EXISTS idx_outreach_suburb ON outreach_properties(suburb);
CREATE INDEX IF NOT EXISTS idx_outreach_city ON outreach_properties(city);
CREATE INDEX IF NOT EXISTS idx_outreach_region ON outreach_properties(region);
CREATE INDEX IF NOT EXISTS idx_outreach_campaign ON outreach_properties(campaign);
CREATE INDEX IF NOT EXISTS idx_outreach_address ON outreach_properties(property_address);
CREATE INDEX IF NOT EXISTS idx_outreach_created_at ON outreach_properties(created_at DESC);

-- Table 2: outreach_qr_tokens
-- Generates unique QR codes for tracking mail recipient interactions
CREATE TABLE IF NOT EXISTS outreach_qr_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token VARCHAR(100) UNIQUE NOT NULL,  -- Short token like "abc123xyz"
  outreach_property_id UUID REFERENCES outreach_properties(id) ON DELETE CASCADE,
  
  -- Tracking
  created_at TIMESTAMP DEFAULT NOW(),
  scanned_at TIMESTAMP,
  scan_count INT DEFAULT 0,
  last_scan_ip VARCHAR(50),
  last_scan_user_agent TEXT
);

-- Indexes for outreach_qr_tokens
CREATE INDEX IF NOT EXISTS idx_qr_token ON outreach_qr_tokens(token);
CREATE INDEX IF NOT EXISTS idx_qr_property_id ON outreach_qr_tokens(outreach_property_id);

-- Comments for documentation
COMMENT ON TABLE outreach_properties IS 'Direct mail campaign properties with full lifecycle tracking from pending to converted';
COMMENT ON TABLE outreach_qr_tokens IS 'Unique QR code tokens for tracking mail recipient interactions';

COMMENT ON COLUMN outreach_properties.status IS 'Lifecycle status: pending (待发送) | sent (已发送) | interacted (已交互) | converted (已转预约)';
COMMENT ON COLUMN outreach_properties.campaign IS 'Campaign identifier (e.g., 2026_Q3_Report, 2027_New_Year_Calendar)';

-- =====================================================
-- Migration Complete
-- =====================================================

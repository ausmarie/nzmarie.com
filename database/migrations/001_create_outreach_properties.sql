-- Migration: Create outreach_properties table for Phase 3 lifecycle management
-- This replaces the simplified outreach_selected_properties table

CREATE TABLE IF NOT EXISTS outreach_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Property identification
  louis_property_id VARCHAR(100),
  property_address TEXT NOT NULL,
  suburb VARCHAR(100) NOT NULL,
  city VARCHAR(100) NOT NULL,
  region VARCHAR(100) NOT NULL,
  street VARCHAR(200),
  
  -- Property details
  owner_name VARCHAR(200),
  property_type VARCHAR(50),
  
  -- Campaign management
  campaign VARCHAR(100) NOT NULL DEFAULT '2026_Q3_Report',
  
  -- Status lifecycle: pending -> sent -> interacted -> converted
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'interacted', 'converted')),
  
  -- Timestamps for each status
  sent_at TIMESTAMP,
  interacted_at TIMESTAMP,
  converted_at TIMESTAMP,
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Prevent duplicate addresses in the same campaign
  CONSTRAINT unique_address_campaign UNIQUE(property_address, campaign)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_outreach_status ON outreach_properties(status);
CREATE INDEX IF NOT EXISTS idx_outreach_suburb ON outreach_properties(suburb);
CREATE INDEX IF NOT EXISTS idx_outreach_campaign ON outreach_properties(campaign);
CREATE INDEX IF NOT EXISTS idx_outreach_created_at ON outreach_properties(created_at DESC);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_outreach_properties_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_outreach_properties_updated_at
BEFORE UPDATE ON outreach_properties
FOR EACH ROW EXECUTE FUNCTION update_outreach_properties_updated_at();

-- QR Code tracking table
CREATE TABLE IF NOT EXISTS outreach_qr_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token VARCHAR(100) UNIQUE NOT NULL,
  outreach_property_id UUID REFERENCES outreach_properties(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  scanned_at TIMESTAMP,
  scan_count INT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_qr_token ON outreach_qr_tokens(token);
CREATE INDEX IF NOT EXISTS idx_qr_property ON outreach_qr_tokens(outreach_property_id);

-- Migration: 005 - Create direct_mail_addresses table
-- Database: Marie DB
-- Purpose: Track individual addresses where direct mail was sent, downloads, and conversions

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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_dma_campaign_id ON direct_mail_addresses(campaign_id);
CREATE INDEX IF NOT EXISTS idx_dma_suburb ON direct_mail_addresses(suburb);
CREATE INDEX IF NOT EXISTS idx_dma_tracking_code ON direct_mail_addresses(tracking_code);
CREATE INDEX IF NOT EXISTS idx_dma_contact_status ON direct_mail_addresses(contact_status);
CREATE INDEX IF NOT EXISTS idx_dma_next_follow_up ON direct_mail_addresses(next_follow_up_at);
CREATE INDEX IF NOT EXISTS idx_dma_has_downloaded ON direct_mail_addresses(has_downloaded);
CREATE INDEX IF NOT EXISTS idx_dma_has_requested_appraisal ON direct_mail_addresses(has_requested_appraisal);

-- Unique constraint: prevent duplicate mailings to same address in same campaign
CREATE UNIQUE INDEX IF NOT EXISTS idx_dma_campaign_address 
ON direct_mail_addresses(campaign_id, property_address);

-- Updated_at trigger
CREATE TRIGGER trg_direct_mail_addresses_updated_at
BEFORE UPDATE ON direct_mail_addresses
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE direct_mail_addresses IS 'Core table tracking all mailed addresses with download and conversion status';
COMMENT ON COLUMN direct_mail_addresses.tracking_code IS 'Unique code for QR code tracking';
COMMENT ON COLUMN direct_mail_addresses.has_downloaded IS 'Auto-updated by trigger when user downloads report';
COMMENT ON COLUMN direct_mail_addresses.has_requested_appraisal IS 'Auto-updated by trigger when user requests appraisal';
COMMENT ON COLUMN direct_mail_addresses.conversion_value IS 'Louis only - commission earned from this lead';

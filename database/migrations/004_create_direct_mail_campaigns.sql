-- Migration: 004 - Create direct_mail_campaigns table
-- Database: Marie DB
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_campaign_suburb ON direct_mail_campaigns(suburb);
CREATE INDEX IF NOT EXISTS idx_campaign_sent_date ON direct_mail_campaigns(sent_date);
CREATE INDEX IF NOT EXISTS idx_campaign_status ON direct_mail_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaign_created_at ON direct_mail_campaigns(created_at);

-- Updated_at trigger
CREATE TRIGGER trg_direct_mail_campaigns_updated_at
BEFORE UPDATE ON direct_mail_campaigns
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE direct_mail_campaigns IS 'Marketing campaign metadata with financial tracking';
COMMENT ON COLUMN direct_mail_campaigns.printing_cost IS 'Louis only - printing cost';
COMMENT ON COLUMN direct_mail_campaigns.postage_cost IS 'Louis only - postage cost';
COMMENT ON COLUMN direct_mail_campaigns.total_revenue IS 'Louis only - total conversion revenue';

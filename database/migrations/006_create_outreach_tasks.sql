-- Migration: 006 - Create outreach_tasks table
-- Database: Marie DB
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_outreach_status ON outreach_tasks(status);
CREATE INDEX IF NOT EXISTS idx_outreach_suburb ON outreach_tasks(suburb);
CREATE INDEX IF NOT EXISTS idx_outreach_added_at ON outreach_tasks(added_at);
CREATE INDEX IF NOT EXISTS idx_outreach_sent_at ON outreach_tasks(sent_at);
CREATE INDEX IF NOT EXISTS idx_outreach_property_id ON outreach_tasks(property_id);

-- Unique constraint: prevent duplicate tasks for same property+suburb
CREATE UNIQUE INDEX IF NOT EXISTS idx_outreach_property_suburb 
ON outreach_tasks(property_address, suburb) WHERE status != 'RETURNED';

-- Updated_at trigger
CREATE TRIGGER trg_outreach_tasks_updated_at
BEFORE UPDATE ON outreach_tasks
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE outreach_tasks IS 'Queue of direct mail tasks - Properties selected from Louis DB to mail';
COMMENT ON COLUMN outreach_tasks.status IS 'PENDING = ready to print/mail, SENT = already mailed, RETURNED = undeliverable';
COMMENT ON COLUMN outreach_tasks.tracking_code IS 'QR code identifier for download tracking';

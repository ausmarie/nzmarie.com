-- Create leads table for outreach-to-lead conversions and manual leads
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_address TEXT NOT NULL,
  street VARCHAR(200),
  suburb VARCHAR(100),
  city VARCHAR(100),
  region VARCHAR(100),
  owner_name VARCHAR(200),
  owner_email VARCHAR(200),
  owner_phone VARCHAR(50),
  source VARCHAR(50) NOT NULL DEFAULT 'manual',
  source_outreach_id UUID REFERENCES outreach_properties(id) ON DELETE SET NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'new',
  priority VARCHAR(20) NOT NULL DEFAULT 'medium',
  summary TEXT,
  notes TEXT,
  next_action TEXT,
  next_action_at TIMESTAMPTZ,
  last_contacted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_priority ON leads(priority);
CREATE INDEX IF NOT EXISTS idx_leads_suburb ON leads(suburb);
CREATE INDEX IF NOT EXISTS idx_leads_source ON leads(source);
CREATE INDEX IF NOT EXISTS idx_leads_source_outreach ON leads(source_outreach_id);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_next_action ON leads(next_action_at) WHERE next_action_at IS NOT NULL;

-- Create lead_events table for timeline of interactions
CREATE TABLE IF NOT EXISTS lead_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  created_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_events_lead_id ON lead_events(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_events_created_at ON lead_events(created_at DESC);

-- Add converted_to_lead_id to outreach_properties for tracking conversions
ALTER TABLE outreach_properties ADD COLUMN IF NOT EXISTS converted_to_lead_id UUID REFERENCES leads(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_outreach_converted_to_lead ON outreach_properties(converted_to_lead_id) WHERE converted_to_lead_id IS NOT NULL;

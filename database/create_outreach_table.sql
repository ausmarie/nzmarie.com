CREATE TABLE IF NOT EXISTS outreach_selected_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  louis_property_id UUID NOT NULL,
  property_address TEXT NOT NULL,
  suburb VARCHAR(100) NOT NULL,
  street VARCHAR(255),
  city VARCHAR(100),
  
  bedrooms INTEGER,
  bathrooms INTEGER,
  rv_value DECIMAL(10,2),
  
  status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'COMPLETED')),
  
  selected_by VARCHAR(255) NOT NULL,
  selected_at TIMESTAMPTZ DEFAULT NOW(),
  sent_by VARCHAR(255),
  sent_at TIMESTAMPTZ,
  
  tracking_code VARCHAR(50) UNIQUE,
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outreach_status ON outreach_selected_properties(status);
CREATE INDEX IF NOT EXISTS idx_outreach_suburb ON outreach_selected_properties(suburb);
CREATE INDEX IF NOT EXISTS idx_outreach_selected_at ON outreach_selected_properties(selected_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_property_user ON outreach_selected_properties(louis_property_id, selected_by);

CREATE OR REPLACE FUNCTION update_outreach_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER IF NOT EXISTS trigger_update_outreach_updated_at
BEFORE UPDATE ON outreach_selected_properties
FOR EACH ROW EXECUTE FUNCTION update_outreach_updated_at();
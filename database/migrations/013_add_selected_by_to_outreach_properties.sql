-- Migration: 013 - Add selected_by and selected_at to outreach_properties
-- Purpose: Record who selected a property for outreach and when

ALTER TABLE outreach_properties
  ADD COLUMN IF NOT EXISTS selected_by VARCHAR(255);

ALTER TABLE outreach_properties
  ADD COLUMN IF NOT EXISTS selected_at TIMESTAMPTZ;

-- Ensure indexes / quick lookup by selector
CREATE INDEX IF NOT EXISTS idx_outreach_selected_by ON outreach_properties(selected_by);

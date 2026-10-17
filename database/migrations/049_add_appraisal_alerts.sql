-- Add alert columns to appraisal_leads for homepage "Book Appraisal" submissions.
-- alert_status: NULL = legacy/ignored, 'pending' = needs admin attention, 'resolved' = converted to lead
-- lead_id: set when the appraisal is converted into a lead (clears the alert permanently)

ALTER TABLE appraisal_leads
  ADD COLUMN IF NOT EXISTS alert_status VARCHAR(20),
  ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS alert_converted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_appraisal_leads_alert_status
  ON appraisal_leads(alert_status)
  WHERE alert_status = 'pending';

-- Lead-attached reports for the Leads page Reports mode (migration 050)
-- Adds lead_id to report_documents so each lead can own editable BlockNote reports.

ALTER TABLE report_documents
  ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES leads(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_documents_lead
  ON report_documents(lead_id)
  WHERE lead_id IS NOT NULL;

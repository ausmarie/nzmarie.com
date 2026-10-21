ALTER TABLE report_documents DROP CONSTRAINT IF EXISTS check_doc_type;
ALTER TABLE report_documents ADD CONSTRAINT check_doc_type
  CHECK (doc_type IN ('report', 'letter', 'suburb_intro', 'general', 'lead_intro'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_lead_intro
  ON report_documents(lead_id)
  WHERE doc_type = 'lead_intro' AND status != 'archived';

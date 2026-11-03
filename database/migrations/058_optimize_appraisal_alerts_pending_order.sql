CREATE INDEX IF NOT EXISTS idx_appraisal_leads_pending_created_at
  ON appraisal_leads(created_at DESC)
  WHERE alert_status = 'pending';

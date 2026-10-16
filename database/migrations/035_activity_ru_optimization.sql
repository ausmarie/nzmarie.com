-- Migration 035: Activity page RU optimization (CockroachDB compatible)
-- Note: CockroachDB does not support pg_trgm GIN extension.
-- ILIKE '%search%' on CockroachDB uses inverted indexes only on JSONB/ARRAY columns.
-- For text ILIKE, CockroachDB 23+ supports trigram indexes via CREATE INDEX ... USING GIN (col gin_trgm_ops)
-- if pg_trgm is available. Since it is not, we rely on composite B-tree indexes for equality/prefix
-- filtering and accept that full-text search remains a seq scan (mitigated by 500ms debounce + small table).

-- ============================================================
-- 1. Composite index for appraisal_leads: status + priority + created_at
--    Covers the most common filtered list queries in the Appraisals tab
--    (no search filter active: just status/priority dropdowns + pagination)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_appraisal_status_priority_created
  ON appraisal_leads (contact_status, priority, created_at DESC);

-- ============================================================
-- 2. Expression index to fix the non-sargable JOIN in campaign-stats:
--    REPLACE(op.property_id::text, '-', '') = p.id
--    CockroachDB supports expression indexes (computed column indexes)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_properties_id_no_dash
  ON properties (replace(id::text, '-', ''));

-- ============================================================
-- 3. Partial index for outreach_send_logs: campaign stats query
--    WHERE campaign_key = $1 AND sent_at IS NOT NULL
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_outreach_send_logs_key_sent
  ON outreach_send_logs (campaign_key, sent_at ASC)
  WHERE sent_at IS NOT NULL;

-- ============================================================
-- 4. Composite index for outreach_properties: campaign stats status query
--    WHERE last_campaign = $1 AND status IN ('interacted', 'converted')
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_outreach_props_last_campaign_status
  ON outreach_properties (last_campaign, status);

-- ============================================================
-- 5. Composite index for campaign_visit_logs: LOWER(campaign_key) grouping
--    Supports GROUP BY TO_CHAR(created_at AT TIME ZONE 'Pacific/Auckland', ...)
--    with WHERE LOWER(campaign_key) = LOWER($1)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_visit_logs_lower_campaign_created
  ON campaign_visit_logs (LOWER(campaign_key), created_at DESC);

-- ============================================================
-- 6. Composite index for report_downloads filtered queries
--    Covers: source filter + downloaded_at ordering (downloads tab)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_report_downloads_source_date
  ON report_downloads (source, downloaded_at DESC);

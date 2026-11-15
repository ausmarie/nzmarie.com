CREATE TABLE IF NOT EXISTS page_view_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL UNIQUE,
  page_type VARCHAR(16) NOT NULL
    CHECK (page_type IN ('home', 'market_report')),
  report_id UUID,
  language VARCHAR(2) NOT NULL
    CHECK (language IN ('en', 'zh')),
  page_path VARCHAR(512) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (page_type = 'home' AND report_id IS NULL)
    OR (page_type = 'market_report' AND report_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS page_view_events_type_created_at_idx
  ON page_view_events (page_type, created_at DESC);

CREATE INDEX IF NOT EXISTS page_view_events_report_created_at_idx
  ON page_view_events (report_id, created_at DESC)
  WHERE report_id IS NOT NULL;

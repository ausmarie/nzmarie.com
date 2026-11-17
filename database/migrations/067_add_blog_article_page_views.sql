ALTER TABLE page_view_events
  ADD COLUMN IF NOT EXISTS blog_post_id UUID REFERENCES blog_posts(id) ON DELETE CASCADE;

ALTER TABLE page_view_events
  DROP CONSTRAINT IF EXISTS page_view_events_page_type_check;

ALTER TABLE page_view_events
  ADD CONSTRAINT page_view_events_page_type_check
  CHECK (page_type IN ('home', 'market_report', 'blog_article'));

ALTER TABLE page_view_events
  DROP CONSTRAINT IF EXISTS page_view_events_check;

ALTER TABLE page_view_events
  DROP CONSTRAINT IF EXISTS page_view_events_page_reference_check;

ALTER TABLE page_view_events
  ADD CONSTRAINT page_view_events_page_reference_check
  CHECK (
    (page_type = 'home' AND report_id IS NULL AND blog_post_id IS NULL)
    OR (page_type = 'market_report' AND report_id IS NOT NULL AND blog_post_id IS NULL)
    OR (page_type = 'blog_article' AND report_id IS NULL AND blog_post_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS page_view_events_blog_post_created_at_idx
  ON page_view_events (blog_post_id, created_at DESC)
  WHERE blog_post_id IS NOT NULL;

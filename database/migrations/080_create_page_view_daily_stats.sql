CREATE TABLE IF NOT EXISTS page_view_daily_stats (
  view_date DATE NOT NULL,
  page_type VARCHAR(16) NOT NULL
    CHECK (page_type IN ('home', 'market_report', 'blog_article')),
  content_key VARCHAR(36) NOT NULL,
  language VARCHAR(2) NOT NULL
    CHECK (language IN ('en', 'zh')),
  view_count INT8 NOT NULL CHECK (view_count >= 0),
  PRIMARY KEY (view_date, page_type, content_key, language)
);

INSERT INTO page_view_daily_stats (
  view_date,
  page_type,
  content_key,
  language,
  view_count
)
SELECT
  (created_at AT TIME ZONE 'Pacific/Auckland')::DATE,
  page_type,
  COALESCE(report_id::STRING, blog_post_id::STRING, 'home'),
  language,
  COUNT(*)::INT8
FROM page_view_events
GROUP BY 1, 2, 3, 4
ON CONFLICT (view_date, page_type, content_key, language)
DO UPDATE SET view_count = excluded.view_count;

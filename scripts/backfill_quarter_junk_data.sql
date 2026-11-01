CREATE TABLE IF NOT EXISTS outreach_quarter_junk_reclass_backup_20261101 AS
SELECT *
FROM outreach_property_quarter_status
WHERE year = 2026
  AND quarter IN ('Q2', 'Q3')
  AND is_junk = TRUE;

CREATE TABLE IF NOT EXISTS admin_data_migrations (
  migration_key STRING PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

BEGIN;

DELETE FROM outreach_property_quarter_status
WHERE year = 2026
  AND quarter IN ('Q2', 'Q3')
  AND status = 'pending'
  AND is_junk = TRUE
  AND NOT EXISTS (
    SELECT 1
    FROM admin_data_migrations
    WHERE migration_key = '2026-quarter-junk-send-window-v1'
  );

WITH active_reports AS (
  SELECT suburb_report_id, suburb, quarter, year
  FROM (
    SELECT
      id AS suburb_report_id,
      suburb,
      quarter,
      year,
      ROW_NUMBER() OVER (
        PARTITION BY year, quarter, suburb
        ORDER BY uploaded_at DESC, id DESC
      ) AS report_rank
    FROM suburb_reports
    WHERE year = 2026
      AND quarter IN ('Q2', 'Q3')
      AND status = 'active'
  ) ranked
  WHERE report_rank = 1
),
send_events AS (
  SELECT
    sl.suburb,
    CASE
      WHEN sl.campaign_key ~ '^[0-9]{4}[_-]Q[1-4]'
        THEN SUBSTRING(sl.campaign_key FROM '^([0-9]{4})')::INT
      WHEN sr.quarter ~ '^Q[1-4]$' AND sr.year IS NOT NULL
        THEN sr.year::INT
    END AS year,
    CASE
      WHEN sl.campaign_key ~ '^[0-9]{4}[_-]Q[1-4]'
        THEN 'Q' || SUBSTRING(sl.campaign_key FROM '[_-]Q([1-4])')
      WHEN sr.quarter ~ '^Q[1-4]$' AND sr.year IS NOT NULL
        THEN sr.quarter
    END AS quarter,
    sl.sent_at
  FROM outreach_send_logs sl
  LEFT JOIN suburb_reports sr ON sr.id = sl.suburb_report_id
  WHERE sl.suburb IS NOT NULL
    AND sl.sent_at IS NOT NULL
    AND (
      sl.campaign_key ~ '^2026[_-]Q[23]'
      OR (sr.year = 2026 AND sr.quarter IN ('Q2', 'Q3'))
    )
    AND NOT EXISTS (
      SELECT 1
      FROM outreach_property_quarter_status returned
      WHERE returned.outreach_property_id = sl.outreach_property_id
        AND returned.suburb_report_id = sl.suburb_report_id
        AND returned.status = 'pending'
    )
),
send_windows AS (
  SELECT suburb, year, quarter, MIN(sent_at) AS first_sent_at, MAX(sent_at) AS last_sent_at
  FROM send_events
  GROUP BY suburb, year, quarter
),
candidate_junks AS (
  SELECT
    op.id AS outreach_property_id,
    report.suburb_report_id,
    report.suburb,
    report.quarter,
    report.year,
    p.no_junk_mail_updated_at AS junk_at
  FROM active_reports report
  JOIN send_windows sw
    ON sw.suburb = report.suburb
   AND sw.year = report.year
   AND sw.quarter = report.quarter
  JOIN outreach_properties op ON op.suburb = report.suburb
  JOIN properties p ON REPLACE(op.property_id::TEXT, '-', '') = p.id
  WHERE p.no_junk_mail IS TRUE
    AND p.no_junk_mail_updated_at BETWEEN sw.first_sent_at AND sw.last_sent_at
    AND NOT EXISTS (
      SELECT 1
      FROM outreach_send_logs sl
      LEFT JOIN suburb_reports sent_report ON sent_report.id = sl.suburb_report_id
      WHERE sl.outreach_property_id = op.id
        AND CASE
          WHEN sl.campaign_key ~ '^[0-9]{4}[_-]Q[1-4]'
            THEN substring(sl.campaign_key from '^([0-9]{4})') || '-Q' || substring(sl.campaign_key from '[_-]Q([1-4])')
          WHEN sent_report.quarter ~ '^Q[1-4]$' AND sent_report.year IS NOT NULL
            THEN sent_report.year || '-' || sent_report.quarter
        END = report.year::TEXT || '-' || report.quarter
        AND NOT EXISTS (
          SELECT 1
          FROM outreach_property_quarter_status returned
          WHERE returned.outreach_property_id = sl.outreach_property_id
            AND returned.suburb_report_id = sl.suburb_report_id
            AND returned.status = 'pending'
        )
    )
    AND NOT EXISTS (
      SELECT 1
      FROM outreach_property_quarter_status existing
      WHERE existing.outreach_property_id = op.id
        AND existing.suburb_report_id = report.suburb_report_id
        AND existing.status IN ('sent', 'partial')
    )
    AND NOT EXISTS (
      SELECT 1
      FROM admin_data_migrations
      WHERE migration_key = '2026-quarter-junk-send-window-v1'
    )
)
INSERT INTO outreach_property_quarter_status (
  outreach_property_id,
  suburb_report_id,
  suburb,
  quarter,
  year,
  status,
  is_junk,
  junk_at
)
SELECT
  outreach_property_id,
  suburb_report_id,
  suburb,
  quarter,
  year,
  'pending',
  TRUE,
  junk_at
FROM candidate_junks
ON CONFLICT (outreach_property_id, suburb_report_id) DO UPDATE SET
  is_junk = TRUE,
  junk_at = EXCLUDED.junk_at,
  updated_at = NOW()
WHERE outreach_property_quarter_status.status NOT IN ('sent', 'partial');

INSERT INTO admin_data_migrations (migration_key)
VALUES ('2026-quarter-junk-send-window-v1')
ON CONFLICT (migration_key) DO NOTHING;

COMMIT;

UPDATE appraisal_leads
SET priority = CASE timeline
  WHEN 'within-3-months' THEN 'high'
  WHEN '3-6-months' THEN 'medium'
  WHEN '6-12-months' THEN 'low'
  WHEN 'just-exploring' THEN 'low'
END,
    priority_source = 'auto'
WHERE COALESCE(priority_source, 'auto') = 'auto'
  AND timeline IN ('within-3-months', '3-6-months', '6-12-months', 'just-exploring')
  AND priority IS DISTINCT FROM CASE timeline
    WHEN 'within-3-months' THEN 'high'
    WHEN '3-6-months' THEN 'medium'
    WHEN '6-12-months' THEN 'low'
    WHEN 'just-exploring' THEN 'low'
  END;

-- 056 - Backfill appraisal priority from the timeline.
--
-- Only auto (NULL) rows are touched. Manual overrides are preserved. Kept in a
-- separate migration file because CockroachDB needs the ADD COLUMN schema
-- change from 055 to be visible before the column can be written.

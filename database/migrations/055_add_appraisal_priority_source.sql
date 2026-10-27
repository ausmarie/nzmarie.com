ALTER TABLE appraisal_leads
  ADD COLUMN IF NOT EXISTS priority_source VARCHAR(20);

-- 055 - Track where an appraisal priority came from.
--
-- priority_source:
--   NULL/'auto' = priority is derived from appraisal_leads.timeline
--   'manual'    = an admin explicitly overrode the priority
--
-- The column is nullable on purpose: CockroachDB backfills NOT NULL/DEFAULT
-- columns, which blocks later statements in the same migration batch. All
-- inserts write the source explicitly and NULL is treated as 'auto'.

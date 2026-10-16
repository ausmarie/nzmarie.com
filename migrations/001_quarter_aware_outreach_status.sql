-- ============================================================================
-- Migration: Add Quarter-Aware Outreach Status Persistence
-- Version: 001
-- Date: 2026
-- Description: Add persistent quarter-aware outreach status tables and materialized views
-- RU Optimization: Index-only scans, materialized views, zero JOIN reads
-- ============================================================================

-- ============================================================================
-- SECTION 1: Core Persistence Table
-- ============================================================================

-- Quarter-aware property status table (core write table)
CREATE TABLE IF NOT EXISTS outreach_property_quarter_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outreach_property_id UUID NOT NULL REFERENCES outreach_properties(id) ON DELETE CASCADE,
    suburb_report_id UUID NOT NULL REFERENCES suburb_reports(id) ON DELETE CASCADE,
    suburb VARCHAR(100) NOT NULL,                          -- Denormalized: avoids JOIN suburb_reports
    quarter VARCHAR(2) NOT NULL,                           -- 'Q1' | 'Q2' | 'Q3' | 'Q4'
    year INT NOT NULL,                                      -- 2026, 2027...
    quarter_key VARCHAR(8) GENERATED ALWAYS AS (year || '-' || quarter) STORED, -- '2026-Q3'
    status VARCHAR(20) NOT NULL DEFAULT 'pending',         -- 'pending' | 'sent' | 'partial'
    sent_count INT DEFAULT 0,
    first_sent_at TIMESTAMPTZ,
    last_sent_at TIMESTAMPTZ,
    campaign_keys TEXT[] DEFAULT '{}',                      -- Campaign keys used this quarter
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE (outreach_property_id, suburb_report_id)
);

-- Core indexes for Dashboard + Dispatch Timeline query patterns
CREATE INDEX IF NOT EXISTS idx_opqs_suburb_quarter_year_status 
  ON outreach_property_quarter_status (suburb, quarter, year, status);
CREATE INDEX IF NOT EXISTS idx_opqs_quarter_key_status 
  ON outreach_property_quarter_status (quarter_key, status);
CREATE INDEX IF NOT EXISTS idx_opqs_property_report 
  ON outreach_property_quarter_status (outreach_property_id, suburb_report_id);
CREATE INDEX IF NOT EXISTS idx_opqs_suburb_quarter_key 
  ON outreach_property_quarter_status (suburb, quarter_key);
CREATE INDEX IF NOT EXISTS idx_opqs_status_quarter_year 
  ON outreach_property_quarter_status (status, quarter, year);

-- Updated at trigger (reuse existing function, don't drop/recreate)
-- The function update_updated_at_column already exists and is used by other tables
-- Just create the trigger on our new table

CREATE TRIGGER update_opqs_updated_at
    BEFORE UPDATE ON outreach_property_quarter_status
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SECTION 2: Materialized Views (Read Layer - Zero JOIN Reads)
-- ============================================================================

-- 2.1 Suburb × Quarter Summary (Dashboard suburb detail)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_suburb_quarter_summary AS
SELECT 
    suburb,
    quarter,
    year,
    quarter_key,
    COUNT(*) as total_properties,
    COUNT(*) FILTER (WHERE status = 'sent') as sent_count,
    COUNT(*) FILTER (WHERE status = 'pending') as unsent_count,
    COUNT(*) FILTER (WHERE status = 'partial') as partial_count,
    SUM(sent_count) as total_send_events,
    MIN(first_sent_at) as first_send_at,
    MAX(last_sent_at) as last_sent_at,
    NOW() as refreshed_at
FROM outreach_property_quarter_status
GROUP BY suburb, quarter, year, quarter_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_sqs_suburb_quarter_key 
  ON mv_suburb_quarter_summary (suburb, quarter_key);
CREATE INDEX IF NOT EXISTS idx_mv_sqs_quarter_key ON mv_suburb_quarter_summary (quarter_key);
CREATE INDEX IF NOT EXISTS idx_mv_sqs_suburb ON mv_suburb_quarter_summary (suburb);

-- 2.2 Quarter Overview (Dashboard top cards)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_quarter_overview AS
SELECT 
    quarter_key,
    quarter,
    year,
    COUNT(DISTINCT suburb) as suburbs_count,
    SUM(total_properties) as total_properties,
    SUM(sent_count) as total_sent,
    SUM(unsent_count) as total_unsent,
    SUM(partial_count) as total_partial,
    SUM(total_send_events) as total_send_events,
    NOW() as refreshed_at
FROM mv_suburb_quarter_summary
GROUP BY quarter_key, quarter, year
ORDER BY year DESC, quarter DESC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_qo_quarter_key ON mv_quarter_overview (quarter_key);

-- 2.3 Dispatch Timeline Detail (Suburb × Quarter × Status detail)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_dispatch_timeline AS
SELECT 
    opqs.suburb,
    opqs.quarter_key,
    opqs.quarter,
    opqs.year,
    opqs.status,
    opqs.sent_count,
    opqs.first_sent_at,
    opqs.last_sent_at,
    opqs.campaign_keys,
    op.updated_at as property_updated_at
FROM outreach_property_quarter_status opqs
JOIN outreach_properties op ON op.id = opqs.outreach_property_id
WHERE op.status IN ('pending', 'sent');

CREATE INDEX IF NOT EXISTS idx_mv_dt_suburb_quarter ON mv_dispatch_timeline (suburb, quarter_key);
CREATE INDEX IF NOT EXISTS idx_mv_dt_quarter_status ON mv_dispatch_timeline (quarter_key, status);
CREATE INDEX IF NOT EXISTS idx_mv_dt_quarter ON mv_dispatch_timeline (quarter_key);

-- ============================================================================
-- SECTION 3: Helper Functions for Materialized View Refresh
-- ============================================================================

-- Refresh all quarter materialized views (call daily via cron)
CREATE OR REPLACE FUNCTION refresh_quarter_materialized_views()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    -- CONCURRENTLY allows reads during refresh (requires unique indexes)
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_suburb_quarter_summary;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_quarter_overview;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dispatch_timeline;
END;
$$;

-- Incremental refresh for specific quarter (call after batch sends)
CREATE OR REPLACE FUNCTION refresh_quarter_mv_incremental(p_quarter_key VARCHAR)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    -- For now, full refresh is fast enough with indexes
    -- Can be optimized to incremental later if needed
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_suburb_quarter_summary;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_quarter_overview;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dispatch_timeline;
END;
$$;

-- ============================================================================
-- SECTION 4: Backfill Historical Data (Run Once After Table Creation)
-- ============================================================================

-- Backfill outreach_property_quarter_status from existing send_logs
-- Run ONCE after table creation, then disable
-- Expected runtime: ~30-60 seconds for ~100k properties

-- Commenting out the backfill for now - run manually if needed
-- INSERT INTO outreach_property_quarter_status 
--     (outreach_property_id, suburb_report_id, suburb, quarter, year, 
--      status, sent_count, first_sent_at, last_sent_at, campaign_keys)
-- SELECT 
--     sl.outreach_property_id,
--     sr.id as suburb_report_id,
--     op.suburb,
--     sr.quarter,
--     sr.year,
--     CASE WHEN COUNT(*) > 0 THEN 'sent' ELSE 'pending' END as status,
--     COUNT(*) as sent_count,
--     MIN(sl.sent_at) as first_sent_at,
--     MAX(sl.sent_at) as last_sent_at,
--     ARRAY_AGG(DISTINCT sl.campaign_key) as campaign_keys
-- FROM outreach_send_logs sl
-- JOIN suburb_reports sr ON sl.suburb_report_id = sr.id
-- JOIN outreach_properties op ON op.id = sl.outreach_property_id
-- WHERE op.status IN ('pending', 'sent')
-- GROUP BY sl.outreach_property_id, sr.id, sr.quarter, sr.year, op.suburb
-- ON CONFLICT (outreach_property_id, suburb_report_id) DO UPDATE SET
--     status = EXCLUDED.status,
--     sent_count = EXCLUDED.sent_count,
--     first_sent_at = EXCLUDED.first_sent_at,
--     last_sent_at = EXCLUDED.last_sent_at,
--     campaign_keys = EXCLUDED.campaign_keys,
--     updated_at = NOW();

-- Update properties quarter_statuses snapshot (JSONB)
-- First, add the column if it doesn't exist
ALTER TABLE outreach_properties ADD COLUMN IF NOT EXISTS quarter_statuses JSONB DEFAULT '{}';

UPDATE outreach_properties op
SET quarter_statuses = (
    SELECT jsonb_object_agg(opqs.quarter_key, opqs.status)
    FROM outreach_property_quarter_status opqs
    WHERE opqs.outreach_property_id = op.id
)
WHERE id IN (
    SELECT DISTINCT outreach_property_id FROM outreach_property_quarter_status
);

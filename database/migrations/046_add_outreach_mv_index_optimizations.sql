-- Migration 046: Add outreach materialized view and send-log indexes for filter/sort performance
-- Purpose: improve admin outreach list performance for campaign/last_campaign filters,
-- sent-log membership checks, and time-sorted MV queries.

-- 1) Support `last_campaign = $1` filtering on outreach_enriched
CREATE INDEX IF NOT EXISTS idx_mv_last_campaign
  ON outreach_enriched (last_campaign);

-- 2) Support `sort_mode=time` with recent send date ordering
CREATE INDEX IF NOT EXISTS idx_mv_status_latest_sent_at
  ON outreach_enriched (status ASC, latest_sent_at DESC);

-- 3) Support campaign-key EXISTS lookups for outreach_send_logs
CREATE INDEX IF NOT EXISTS idx_outreach_send_logs_outreach_prop_campaign
  ON outreach_send_logs (outreach_property_id, campaign_key ASC);

-- 4) Support lookup of send log rows by property + suburb report relationship
CREATE INDEX IF NOT EXISTS idx_outreach_send_logs_outreach_prop_suburb_report
  ON outreach_send_logs (outreach_property_id, suburb_report_id ASC);

-- 5) Support ILIKE filtering on region/city/suburb in outreach_enriched
CREATE INDEX IF NOT EXISTS idx_mv_region_lower
  ON outreach_enriched (lower(region));
CREATE INDEX IF NOT EXISTS idx_mv_city_lower
  ON outreach_enriched (lower(city));
CREATE INDEX IF NOT EXISTS idx_mv_suburb_lower
  ON outreach_enriched (lower(suburb));

-- 6) Support region search on properties list page using LOWER(p.region)
CREATE INDEX IF NOT EXISTS idx_properties_region_lower
  ON properties (lower(region));

CREATE MATERIALIZED VIEW outreach_enriched AS
SELECT
  op.id,
  op.property_id,
  op.property_address,
  op.suburb,
  op.city,
  op.region,
  op.street,
  op.owner_name,
  op.property_type,
  op.campaign,
  op.status,
  op.created_at,
  op.sent_at,
  op.notes,
  op.selected_by,
  op.selected_at,
  op.last_campaign,
  op.total_send_count,
  op.last_sent_at,
  p.id as joined_property_id,
  p.property_url,
  p.cover_image_url,
  p.bedrooms,
  p.bathrooms,
  p.car_spaces,
  p.floor_size,
  p.land_area,
  p.last_sold_price,
  p.last_sold_date,
  p.capital_value,
  p.year_built,
  p.description,
  p.has_rental_history,
  p.is_currently_rented,
  p.property_history,
  p.estimated_value_low,
  p.estimated_value_high,
  p.suburb_median_price,
  p.suburb_days_on_market,
  p.no_junk_mail,
  COALESCE(re.original_link, rer.original_link, re.property_url, rer.property_url) as realestate_url,
  CASE WHEN re.id IS NOT NULL THEN true ELSE false END as on_market_sale,
  re.status as sale_listing_status,
  re.price_display as sale_price,
  re.agent_name as sale_agent,
  CASE WHEN rer.id IS NOT NULL THEN true ELSE false END as on_market_rent,
  rer.status as rent_listing_status,
  rer.price_display as rent_price,
  ls.report_title as latest_send_title,
  ls.sent_at as latest_sent_at,
  ls.campaign_key as latest_campaign,
  ls.quarter as latest_send_quarter,
  ls.year as latest_send_year,
  ls.report_suburb as latest_send_report_suburb
FROM outreach_properties op
LEFT JOIN properties p ON REPLACE(op.property_id::text, '-', '') = p.id
LEFT JOIN real_estate re ON TRIM(LOWER(SPLIT_PART(re.address, ',', 1))) = TRIM(LOWER(p.address)) AND TRIM(LOWER(re.suburb)) = TRIM(LOWER(p.suburb))
LEFT JOIN real_estate_rent rer ON TRIM(LOWER(SPLIT_PART(rer.address, ',', 1))) = TRIM(LOWER(p.address)) AND TRIM(LOWER(rer.suburb)) = TRIM(LOWER(p.suburb))
LEFT JOIN LATERAL (
  SELECT sl.report_title, sl.sent_at, sl.campaign_key, sr.quarter, sr.year, sr.suburb as report_suburb
  FROM outreach_send_logs sl
  LEFT JOIN suburb_reports sr ON sl.suburb_report_id = sr.id
  WHERE sl.outreach_property_id = op.id
  ORDER BY sl.sent_at DESC
  LIMIT 1
) ls ON true;

CREATE INDEX idx_mv_status_created ON outreach_enriched (status, created_at DESC);
CREATE INDEX idx_mv_suburb ON outreach_enriched (suburb, created_at DESC);
CREATE INDEX idx_mv_street ON outreach_enriched (street, created_at DESC);
CREATE INDEX idx_mv_campaign ON outreach_enriched (campaign);
CREATE INDEX idx_mv_property_type ON outreach_enriched (property_type);
CREATE INDEX idx_mv_created_at ON outreach_enriched (created_at DESC);
CREATE INDEX idx_mv_selected_by ON outreach_enriched (selected_by);
CREATE INDEX idx_mv_no_junk_mail ON outreach_enriched (no_junk_mail);
CREATE INDEX idx_mv_city ON outreach_enriched (city);
CREATE INDEX idx_mv_region ON outreach_enriched (region);

-- Cover period-keyed send-log reads that collect property IDs by campaign.
CREATE INDEX IF NOT EXISTS idx_outreach_send_logs_campaign_property
  ON outreach_send_logs (campaign_key, outreach_property_id);

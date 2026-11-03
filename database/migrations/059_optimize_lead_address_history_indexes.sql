CREATE INDEX IF NOT EXISTS idx_leads_property_id_normalized
  ON leads (REPLACE(property_id::text, '-', ''));

CREATE INDEX IF NOT EXISTS idx_leads_address_suburb_normalized
  ON leads (
    LOWER(REGEXP_REPLACE(TRIM(SPLIT_PART(property_address, ',', 1)), '[^[:alnum:]/]', '', 'g')),
    LOWER(REGEXP_REPLACE(COALESCE(suburb, ''), '[^[:alnum:]]', '', 'g'))
  );

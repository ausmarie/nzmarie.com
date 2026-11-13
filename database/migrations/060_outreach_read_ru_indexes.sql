-- Match the expressions used by the outreach listing joins and lead history fallback.
-- These composite indexes avoid scanning listing and address tables for each request.
CREATE INDEX IF NOT EXISTS idx_real_estate_outreach_address_suburb
  ON real_estate (
    TRIM(LOWER(SPLIT_PART(address, ',', 1))),
    TRIM(LOWER(suburb))
  );

CREATE INDEX IF NOT EXISTS idx_real_estate_rent_outreach_address_suburb
  ON real_estate_rent (
    TRIM(LOWER(SPLIT_PART(address, ',', 1))),
    TRIM(LOWER(suburb))
  );

CREATE INDEX IF NOT EXISTS idx_properties_outreach_history_address_suburb
  ON properties (
    LOWER(REGEXP_REPLACE(
      REGEXP_REPLACE(
        REGEXP_REPLACE(TRIM(SPLIT_PART(address, ',', 1)), '[0-9]{7,}$', ''),
        '[[:space:]]*/[[:space:]]*', '/', 'g'
      ),
      '[^[:alnum:]/]', '', 'g'
    )),
    LOWER(REGEXP_REPLACE(TRIM(suburb), '[^[:alnum:]]', '', 'g'))
  );

CREATE INDEX IF NOT EXISTS idx_outreach_history_address_suburb
  ON outreach_properties (
    LOWER(REGEXP_REPLACE(
      REGEXP_REPLACE(
        REGEXP_REPLACE(TRIM(SPLIT_PART(property_address, ',', 1)), '[0-9]{7,}$', ''),
        '[[:space:]]*/[[:space:]]*', '/', 'g'
      ),
      '[^[:alnum:]/]', '', 'g'
    )),
    LOWER(REGEXP_REPLACE(TRIM(suburb), '[^[:alnum:]]', '', 'g'))
  );

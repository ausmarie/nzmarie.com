CREATE TABLE IF NOT EXISTS report_suburbs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(200) NOT NULL UNIQUE,
  region        VARCHAR(100) NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_report_suburbs_region ON report_suburbs(region);
CREATE INDEX IF NOT EXISTS idx_report_suburbs_active ON report_suburbs(is_active);

INSERT INTO report_suburbs (name, region, sort_order)
SELECT DISTINCT TRIM(suburb), 'North Shore', ROW_NUMBER() OVER (ORDER BY TRIM(suburb))
FROM properties
WHERE suburb IS NOT NULL AND TRIM(suburb) != ''
ON CONFLICT (name) DO NOTHING;

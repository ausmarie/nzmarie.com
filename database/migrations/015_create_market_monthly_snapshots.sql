-- Migration: 015 - Create market_monthly_snapshots table
-- Purpose: Store REINZ monthly market data for suburbs & districts
-- Note: All tracking logic is in application layer (lib/tracking.ts)
--        CockroachDB has limited trigger support so no triggers here

CREATE TABLE IF NOT EXISTS market_monthly_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Region classification
    region_type VARCHAR(20) NOT NULL,       -- 'suburb' or 'district'
    region_name VARCHAR(50) NOT NULL,       -- 'Oteha', 'North Shore City'
    city VARCHAR(50) DEFAULT '',            -- 'Auckland'
    property_type VARCHAR(20) DEFAULT 'House',

    -- Time dimension
    period_month DATE NOT NULL,             -- First of month: '2026-05-01'

    -- Core metrics
    median_price INT,
    sales_count INT NOT NULL DEFAULT 0,
    days_to_sell INT,

    -- Enhanced metrics (from real CSV data)
    median_price_1yr_prior INT,
    price_diff_1yr_pct DECIMAL(5,2),
    median_price_3yrs_prior INT,
    price_diff_3yrs_pct DECIMAL(5,2),
    median_valuation INT,
    median_list_price INT,
    sale_to_valuation_pct INT,
    list_to_valuation_pct INT,
    total_volume BIGINT,
    pct_of_national_sales DECIMAL(5,2),
    house_price_index INT,
    price_diff_mom_pct DECIMAL(5,2),

    -- Metadata
    data_source VARCHAR(50) DEFAULT 'REINZ',
    imported_at TIMESTAMPTZ DEFAULT NOW(),
    imported_by VARCHAR(255),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prevent duplicate imports
CREATE UNIQUE INDEX IF NOT EXISTS idx_snapshots_region_period
ON market_monthly_snapshots(region_name, period_month, property_type);

-- Query optimization indexes
CREATE INDEX IF NOT EXISTS idx_snapshots_period ON market_monthly_snapshots(period_month);
CREATE INDEX IF NOT EXISTS idx_snapshots_region ON market_monthly_snapshots(region_name);
CREATE INDEX IF NOT EXISTS idx_snapshots_type ON market_monthly_snapshots(region_type);

COMMENT ON TABLE market_monthly_snapshots IS 'REINZ monthly market data snapshots for suburbs and districts';
COMMENT ON COLUMN market_monthly_snapshots.median_price IS 'Median sale price (NZD), nullable for Low Vol. months';
COMMENT ON COLUMN market_monthly_snapshots.region_type IS 'suburb=suburb level (e.g. Oteha), district=district level (e.g. North Shore City)';

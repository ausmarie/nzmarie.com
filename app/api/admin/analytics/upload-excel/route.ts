import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query } from '@/lib/db';
import { isAdmin } from '@/lib/permissions';
import { parseREINZExcel, validateREINZData } from '@/lib/excel-parser';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const parsed = parseREINZExcel(buffer);

    // Auto-create table if not exists (safe — uses IF NOT EXISTS)
    await query(`CREATE TABLE IF NOT EXISTS market_monthly_snapshots (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      region_type VARCHAR(20) NOT NULL,
      region_name VARCHAR(50) NOT NULL,
      city VARCHAR(50) DEFAULT '',
      property_type VARCHAR(20) DEFAULT 'House',
      period_month DATE NOT NULL,
      median_price INT, sales_count INT NOT NULL DEFAULT 0, days_to_sell INT,
      median_price_1yr_prior INT, price_diff_1yr_pct DECIMAL(5,2),
      median_price_3yrs_prior INT, price_diff_3yrs_pct DECIMAL(5,2),
      median_valuation INT, median_list_price INT,
      sale_to_valuation_pct INT, list_to_valuation_pct INT,
      total_volume BIGINT, pct_of_national_sales DECIMAL(5,2),
      house_price_index INT, price_diff_mom_pct DECIMAL(5,2),
      data_source VARCHAR(50) DEFAULT 'REINZ',
      imported_at TIMESTAMPTZ DEFAULT NOW(), imported_by VARCHAR(255),
      created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    // Add city column if upgrading from a migration without it
    await query(`ALTER TABLE market_monthly_snapshots ADD COLUMN IF NOT EXISTS city VARCHAR(50) DEFAULT ''`);
    await query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_snapshots_region_period
      ON market_monthly_snapshots(region_name, period_month, property_type)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_snapshots_period ON market_monthly_snapshots(period_month)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_snapshots_region ON market_monthly_snapshots(region_name)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_snapshots_type ON market_monthly_snapshots(region_type)`);

    // Pre-check which months already exist in the DB for this region
    const existingResult = await query<{ period_month: string }>(
      `SELECT DISTINCT period_month::text FROM market_monthly_snapshots
       WHERE region_name = $1`,
      [parsed.suburb_name]
    );
    const existingMonths = new Set(existingResult.rows.map(r => r.period_month.slice(0, 7)));

    let inserted = 0;
    let updated = 0;
    let validationSkipped = 0;

    for (const row of parsed.rows) {
      if (!validateREINZData(row)) {
        validationSkipped++;
        continue;
      }

      const monthKey = row.period_month.slice(0, 7);
      const isExisting = existingMonths.has(monthKey);

      await query(
        `INSERT INTO market_monthly_snapshots (
          region_type, region_name, city, property_type, period_month,
          median_price, sales_count, days_to_sell,
          median_price_1yr_prior, price_diff_1yr_pct,
          median_price_3yrs_prior, price_diff_3yrs_pct,
          median_valuation, median_list_price,
          sale_to_valuation_pct, list_to_valuation_pct,
          total_volume, pct_of_national_sales, house_price_index,
          price_diff_mom_pct, imported_by
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8,
          $9, $10,
          $11, $12,
          $13, $14,
          $15, $16,
          $17, $18, $19,
          $20, $21
        ) ON CONFLICT (region_name, period_month, property_type) DO UPDATE SET
          region_type = COALESCE(EXCLUDED.region_type, market_monthly_snapshots.region_type),
          city = COALESCE(EXCLUDED.city, market_monthly_snapshots.city),
          median_price = COALESCE(EXCLUDED.median_price, market_monthly_snapshots.median_price),
          sales_count = COALESCE(EXCLUDED.sales_count, market_monthly_snapshots.sales_count),
          days_to_sell = COALESCE(EXCLUDED.days_to_sell, market_monthly_snapshots.days_to_sell),
          median_price_1yr_prior = COALESCE(EXCLUDED.median_price_1yr_prior, market_monthly_snapshots.median_price_1yr_prior),
          price_diff_1yr_pct = COALESCE(EXCLUDED.price_diff_1yr_pct, market_monthly_snapshots.price_diff_1yr_pct),
          median_price_3yrs_prior = COALESCE(EXCLUDED.median_price_3yrs_prior, market_monthly_snapshots.median_price_3yrs_prior),
          price_diff_3yrs_pct = COALESCE(EXCLUDED.price_diff_3yrs_pct, market_monthly_snapshots.price_diff_3yrs_pct),
          median_valuation = COALESCE(EXCLUDED.median_valuation, market_monthly_snapshots.median_valuation),
          median_list_price = COALESCE(EXCLUDED.median_list_price, market_monthly_snapshots.median_list_price),
          sale_to_valuation_pct = COALESCE(EXCLUDED.sale_to_valuation_pct, market_monthly_snapshots.sale_to_valuation_pct),
          list_to_valuation_pct = COALESCE(EXCLUDED.list_to_valuation_pct, market_monthly_snapshots.list_to_valuation_pct),
          total_volume = COALESCE(EXCLUDED.total_volume, market_monthly_snapshots.total_volume),
          pct_of_national_sales = COALESCE(EXCLUDED.pct_of_national_sales, market_monthly_snapshots.pct_of_national_sales),
          house_price_index = COALESCE(EXCLUDED.house_price_index, market_monthly_snapshots.house_price_index),
          price_diff_mom_pct = COALESCE(EXCLUDED.price_diff_mom_pct, market_monthly_snapshots.price_diff_mom_pct),
          imported_by = COALESCE(EXCLUDED.imported_by, market_monthly_snapshots.imported_by),
          updated_at = NOW()`,
        [
          parsed.region_type, row.region_name, row.city, 'House', row.period_month,
          row.median_price, row.sales_count, row.days_to_sell,
          row.median_price_1yr_prior, row.price_diff_1yr_pct,
          row.median_price_3yrs_prior, row.price_diff_3yrs_pct,
          row.median_valuation, row.median_list_price,
          row.sale_to_valuation_pct, row.list_to_valuation_pct,
          row.total_volume, row.pct_of_national_sales, row.house_price_index,
          row.price_diff_mom_pct, session.user.email,
        ]
      );

      if (isExisting) {
        updated++;
      } else {
        inserted++;
      }
    }

    return NextResponse.json({
      success: true,
      suburb: parsed.suburb_name,
      city: parsed.city,
      period_start: parsed.period_start,
      period_end: parsed.period_end,
      inserted_count: inserted,
      updated_count: updated,
      already_existed: updated,
      validation_skipped: validationSkipped,
      total_rows: parsed.count,
      message: `Imported ${inserted} new rows and updated ${updated} existing rows for ${parsed.suburb_name} (${parsed.period_start} to ${parsed.period_end})`,
    });
  } catch (error) {
    console.error('Error uploading Excel:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process file' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { marieDB } from '@/lib/db';
import { isSuperAdmin } from '@/lib/permissions';

/**
 * POST /api/admin/migrate
 * Run pending database migrations.
 * Super admin only.
 */
export async function POST() {
  const session = await auth();

  if (!session?.user?.email || !isSuperAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const results: { migration: string; status: string; message: string }[] = [];

  try {
    // --- Migration 011: Add region and city to appraisal_leads ---
    try {
      await marieDB.query(`
        ALTER TABLE appraisal_leads 
        ADD COLUMN IF NOT EXISTS region VARCHAR(100)
      `);
      await marieDB.query(`
        ALTER TABLE appraisal_leads 
        ADD COLUMN IF NOT EXISTS city VARCHAR(100)
      `);
      await marieDB.query(`
        CREATE INDEX IF NOT EXISTS idx_appraisal_leads_region ON appraisal_leads(region)
      `);
      await marieDB.query(`
        CREATE INDEX IF NOT EXISTS idx_appraisal_leads_city ON appraisal_leads(city)
      `);
      results.push({
        migration: '011_add_region_city_to_appraisal_leads',
        status: 'success',
        message: 'Added region and city columns to appraisal_leads',
      });
    } catch (err) {
      results.push({
        migration: '011_add_region_city_to_appraisal_leads',
        status: 'error',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }

    // --- Migration 012: Create outreach tables ---
    try {
      // Create outreach_properties table
      await marieDB.query(`
        CREATE TABLE IF NOT EXISTS outreach_properties (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          louis_property_id VARCHAR(100),
          property_address TEXT NOT NULL,
          suburb VARCHAR(100) NOT NULL,
          city VARCHAR(100) NOT NULL,
          region VARCHAR(100) NOT NULL,
          street VARCHAR(200),
          owner_name VARCHAR(200),
          property_type VARCHAR(50),
          campaign VARCHAR(100) NOT NULL DEFAULT '2026_Q3_Report',
          status VARCHAR(50) NOT NULL DEFAULT 'pending',
          sent_at TIMESTAMP,
          interacted_at TIMESTAMP,
          converted_at TIMESTAMP,
          notes TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          CONSTRAINT unique_address_per_campaign UNIQUE(property_address, campaign)
        )
      `);

      // Create indexes for outreach_properties
      await marieDB.query(`CREATE INDEX IF NOT EXISTS idx_outreach_status ON outreach_properties(status)`);
      await marieDB.query(`CREATE INDEX IF NOT EXISTS idx_outreach_suburb ON outreach_properties(suburb)`);
      await marieDB.query(`CREATE INDEX IF NOT EXISTS idx_outreach_city ON outreach_properties(city)`);
      await marieDB.query(`CREATE INDEX IF NOT EXISTS idx_outreach_region ON outreach_properties(region)`);
      await marieDB.query(`CREATE INDEX IF NOT EXISTS idx_outreach_campaign ON outreach_properties(campaign)`);
      await marieDB.query(`CREATE INDEX IF NOT EXISTS idx_outreach_address ON outreach_properties(property_address)`);

      // Create outreach_qr_tokens table
      await marieDB.query(`
        CREATE TABLE IF NOT EXISTS outreach_qr_tokens (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          token VARCHAR(100) UNIQUE NOT NULL,
          outreach_property_id UUID REFERENCES outreach_properties(id) ON DELETE CASCADE,
          created_at TIMESTAMP DEFAULT NOW(),
          scanned_at TIMESTAMP,
          scan_count INT DEFAULT 0,
          last_scan_ip VARCHAR(50),
          last_scan_user_agent TEXT
        )
      `);

      await marieDB.query(`CREATE INDEX IF NOT EXISTS idx_qr_token ON outreach_qr_tokens(token)`);
      await marieDB.query(`CREATE INDEX IF NOT EXISTS idx_qr_property_id ON outreach_qr_tokens(outreach_property_id)`);

      results.push({
        migration: '012_create_outreach_tables',
        status: 'success',
        message: 'Created outreach_properties and outreach_qr_tokens tables with indexes',
      });
    } catch (err) {
      results.push({
        migration: '012_create_outreach_tables',
        status: 'error',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Migration failed', detail: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/migrate
 * Check migration status — which columns exist on appraisal_leads.
 */
export async function GET() {
  const session = await auth();

  if (!session?.user?.email || !isSuperAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const result = await marieDB.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'appraisal_leads'
      ORDER BY ordinal_position
    `);

    const columns = result.rows.map(r => r.column_name);
    const hasRegion = columns.includes('region');
    const hasCity = columns.includes('city');

    return NextResponse.json({
      columns,
      migrations: {
        '011_add_region_city': hasRegion && hasCity ? 'applied' : 'pending',
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to check migration status' },
      { status: 500 }
    );
  }
}

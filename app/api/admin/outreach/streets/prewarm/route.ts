import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { marieDB } from '@/lib/db';
import { isSuperAdmin } from '@/lib/permissions';

/**
 * POST /api/admin/outreach/streets/prewarm
 * Rebuild street_locations from the properties table (free - no external API).
 * Idempotent. Uses admin_settings flag to skip if already warmed recently.
 *
 * Body (optional): { force: true } to force a rebuild regardless of flag.
 */
export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.email || !isSuperAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let force = false;
  try {
    const body = await request.json();
    force = !!body?.force;
  } catch {
    // no body - treat as non-forced
  }

  try {
    await marieDB.ensureOutreachTablesExist?.();

    if (!force) {
      const flag = await marieDB.query(
        `SELECT setting_value FROM admin_settings WHERE setting_key = 'street_geo_prewarmed'`
      );
      if (flag.rows.length > 0 && flag.rows[0].setting_value === 'true') {
        return NextResponse.json({
          success: true,
          skipped: true,
          message: 'Already prewarmed. Send { force: true } to rebuild.',
        });
      }
    }

    await marieDB.query(
      `
      INSERT INTO street_locations (suburb, street, center_lat, center_lng, source, property_count)
      SELECT
        op.suburb,
        op.street,
        AVG(p.latitude) AS center_lat,
        AVG(p.longitude) AS center_lng,
        'properties' AS source,
        COUNT(*) AS property_count
      FROM outreach_properties op
      JOIN properties p ON REPLACE(op.property_id::text, '-', '') = p.id
      WHERE op.street IS NOT NULL
        AND TRIM(op.street) <> ''
        AND p.latitude IS NOT NULL
        AND p.longitude IS NOT NULL
      GROUP BY op.suburb, op.street
      ON CONFLICT (suburb, street) DO UPDATE
        SET center_lat = EXCLUDED.center_lat,
            center_lng = EXCLUDED.center_lng,
            source = 'properties',
            property_count = EXCLUDED.property_count,
            updated_at = NOW()
      `
    );

    await marieDB.query(
      `
      INSERT INTO admin_settings (setting_key, setting_value, updated_at)
      VALUES ('street_geo_prewarmed', 'true', NOW())
      ON CONFLICT (setting_key) DO UPDATE
        SET setting_value = 'true', updated_at = NOW()
      `
    );

    const count = await marieDB.query(`SELECT COUNT(*) AS total FROM street_locations`);
    const missing = await marieDB.query(`
      SELECT COUNT(DISTINCT op.street) AS missing
      FROM outreach_properties op
      WHERE op.street IS NOT NULL AND TRIM(op.street) <> ''
        AND NOT EXISTS (
          SELECT 1 FROM street_locations sl
          WHERE sl.suburb = op.suburb AND sl.street = op.street
        )
    `);

    return NextResponse.json({
      success: true,
      skipped: false,
      totalStreets: Number(count.rows[0].total),
      missingCoordinates: Number(missing.rows[0].missing),
    });
  } catch (error) {
    console.error('Error prewarming street locations:', error);
    return NextResponse.json(
      { error: 'Failed to prewarm street locations' },
      { status: 500 }
    );
  }
}

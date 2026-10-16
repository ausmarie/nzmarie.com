import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { marieDB } from '@/lib/db';
import { findLocationBySuburb } from '@/lib/geo-data';
import { isSuperAdmin } from '@/lib/permissions';

export async function GET() {
  const session = await auth();

  if (!session?.user?.email || !isSuperAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    // Check whether region/city columns exist first
    const colCheck = await marieDB.query<{ column_name: string }>(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'appraisal_leads'
        AND column_name IN ('region', 'city')
    `);
    const hasLocationColumns = colCheck.rows.length === 2;

    if (!hasLocationColumns) {
      return NextResponse.json({
        success: true,
        locations: [],
        regions: [],
        total: 0,
        note: 'Migration 011 not yet applied — run migrations to enable location analytics.',
      });
    }

    // Query location distribution from appraisal_leads
    const result = await marieDB.query(`
      SELECT
        COALESCE(region, 'Unknown') as region,
        COALESCE(city, 'Unknown') as city,
        COALESCE(suburb, 'Unknown') as suburb,
        COUNT(*) as count
      FROM appraisal_leads
      GROUP BY region, city, suburb
      ORDER BY count DESC, region, city
      LIMIT 50
    `);

    const suburbRows = result.rows.map((row) => {
      const fallback = findLocationBySuburb(String(row.suburb || '').trim());
      const region = row.region !== 'Unknown' ? row.region : fallback?.region || 'Unknown';
      const city = row.city !== 'Unknown' ? row.city : fallback?.city || 'Unknown';
      const suburb = row.suburb || fallback?.suburb || 'Unknown';

      return {
        region,
        city,
        suburb,
        count: parseInt(row.count),
      };
    });

    const cityMap = new Map<string, { region: string; city: string; count: number }>();

    suburbRows.forEach((row) => {
      const key = `${row.region}|${row.city}`;
      const existing = cityMap.get(key);
      if (existing) {
        existing.count += row.count;
      } else {
        cityMap.set(key, {
          region: row.region,
          city: row.city,
          count: row.count,
        });
      }
    });

    const locations = Array.from(cityMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    // Regional summary
    const regionMap = new Map<string, number>();
    locations.forEach(loc => {
      regionMap.set(loc.region, (regionMap.get(loc.region) || 0) + loc.count);
    });

    const regions = Array.from(regionMap.entries())
      .map(([region, count]) => ({ region, count }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({
      success: true,
      locations,
      regions,
      total: suburbRows.reduce((sum, row) => sum + row.count, 0),
    });
  } catch (error) {
    console.error('Error fetching location analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch location analytics' },
      { status: 500 }
    );
  }
}

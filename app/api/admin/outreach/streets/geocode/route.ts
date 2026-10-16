import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { marieDB } from '@/lib/db';
import { isAdmin, isSuperAdmin } from '@/lib/permissions';

async function sleep(ms: number) { return new Promise((res) => setTimeout(res, ms)); }

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const suburb = searchParams.get('suburb');
  if (!suburb) return NextResponse.json({ error: 'Missing suburb' }, { status: 400 });

  // Return number of properties missing coords (informational)
  try {
    const { rows } = await marieDB.query(`SELECT COUNT(*)::int AS cnt FROM outreach_properties op LEFT JOIN properties p ON REPLACE(op.property_id::text,'-','') = p.id WHERE op.suburb = $1 AND (p.latitude IS NULL OR p.longitude IS NULL)`, [suburb]);
    return NextResponse.json({ missing: rows?.[0]?.cnt ?? 0 });
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

/**
 * POST /api/admin/outreach/streets/geocode
 * Geocodes streets missing coordinates via the Google Geocoding API.
 * Only processes streets that have no street_locations row.
 * Bounded batch size to control API cost.
 *
 * Body: { suburb?, limit? }  limit defaults to 50, max 100.
 */
export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.email || !isSuperAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'GEOCODE API KEY is not configured' }, { status: 500 });
  }

  let suburbFilter: string | null = null;
  let limit = 50;
  try {
    const body = await request.json();
    suburbFilter = body?.suburb || null;
    limit = Math.min(100, Math.max(1, parseInt(body?.limit || '50', 10) || 50));
  } catch {
    // no body
  }

  try {
    await marieDB.ensureOutreachTablesExist?.();

    const params: unknown[] = [limit];
    let whereSql = `op.street IS NOT NULL AND TRIM(op.street) <> ''
        AND NOT EXISTS (
          SELECT 1 FROM street_locations sl
          WHERE sl.suburb = op.suburb AND sl.street = op.street
        )`;
    if (suburbFilter) {
      whereSql += ` AND op.suburb = $2`;
      params.push(suburbFilter);
    }

    const { rows } = await marieDB.query(
      `
      SELECT op.suburb, op.street
      FROM outreach_properties op
      WHERE ${whereSql}
      ORDER BY op.suburb ASC, op.street ASC
      LIMIT $1
      `,
      params
    );

    const unique = new Map<string, { suburb: string; street: string }>();
    for (const r of rows) {
      const key = `${r.suburb}::${r.street}`;
      if (!unique.has(key)) unique.set(key, { suburb: r.suburb, street: r.street });
    }

    const results: {
      suburb: string;
      street: string;
      status: 'ok' | 'error';
      lat?: number;
      lng?: number;
    }[] = [];

    for (const { suburb, street } of unique.values()) {
      try {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
          `${street}, ${suburb}, New Zealand`
        )}&key=${apiKey}`;
        const res = await fetch(url);
        const data = await res.json();
        const loc = data?.results?.[0]?.geometry?.location;
        if (loc && typeof loc.lat === 'number') {
          await marieDB.query(
            `
            INSERT INTO street_locations (suburb, street, center_lat, center_lng, source, geocoded_at)
            VALUES ($1, $2, $3, $4, 'geocoding', NOW())
            ON CONFLICT (suburb, street) DO UPDATE
              SET center_lat = EXCLUDED.center_lat,
                  center_lng = EXCLUDED.center_lng,
                  source = 'geocoding',
                  geocoded_at = NOW(),
                  updated_at = NOW()
            `,
            [suburb, street, loc.lat, loc.lng]
          );
          results.push({ suburb, street, status: 'ok', lat: loc.lat, lng: loc.lng });
        } else {
          results.push({ suburb, street, status: 'error' });
        }
      } catch {
        results.push({ suburb, street, status: 'error' });
      }
      // Respect a gentle rate limit
      await sleep(600);
    }

    return NextResponse.json({
      success: true,
      attempted: unique.size,
      geocoded: results.filter((r) => r.status === 'ok').length,
      failed: results.filter((r) => r.status === 'error').length,
      results,
    });
  } catch (error) {
    console.error('Error geocoding street locations:', error);
    return NextResponse.json({ error: 'Failed to geocode street locations' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { marieDB } from '@/lib/db';
import { isAdmin } from '@/lib/permissions';
import { haversineMeters } from '@/lib/street-clustering';

/**
 * GET /api/admin/outreach/nearby-streets
 * Returns streets within `radius` meters of a given street center point.
 * Backup / debug endpoint - the main flow uses street-clusters.
 *
 * Query params:
 *   - suburb: suburb of the reference street (required)
 *   - street: reference street name (required)
 *   - radius: search radius in meters (default 800)
 *   - status: which status to count (default 'pending')
 */
export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const suburb = searchParams.get('suburb');
  const street = searchParams.get('street');
  const radius = Math.min(
    2000,
    Math.max(100, parseInt(searchParams.get('radius') || '800', 10) || 800)
  );
  const status = searchParams.get('status') || 'pending';

  if (!suburb || !street) {
    return NextResponse.json(
      { error: 'Missing suburb or street parameter' },
      { status: 400 }
    );
  }

  try {
    await marieDB.ensureOutreachTablesExist?.();

    const centerResult = await marieDB.query(
      `
      SELECT suburb, street, center_lat, center_lng, source
      FROM street_locations
      WHERE suburb = $1 AND street = $2
      LIMIT 1
      `,
      [suburb, street]
    );

    if (centerResult.rows.length === 0) {
      return NextResponse.json({
        success: true,
        center: null,
        has_coords: false,
        radius,
        streets: [],
      });
    }

    const center = centerResult.rows[0];
    const centerLat = Number(center.center_lat);
    const centerLng = Number(center.center_lng);

    const { rows } = await marieDB.query(
      `
      SELECT sl.suburb, sl.street, sl.center_lat, sl.center_lng,
        COALESCE((
          SELECT COUNT(*)
          FROM outreach_properties op
          WHERE op.suburb = sl.suburb
            AND op.street = sl.street
            AND op.status = $1
        ), 0) AS pending_count
      FROM street_locations sl
      WHERE sl.suburb = $2
        AND sl.street <> $3
        AND sl.center_lat IS NOT NULL
        AND sl.center_lng IS NOT NULL
      ORDER BY sl.street ASC
      `,
      [status, suburb, street]
    );

    const nearby = rows
      .map((r) => {
        const lat = Number(r.center_lat);
        const lng = Number(r.center_lng);
        return {
          suburb: r.suburb,
          street: r.street,
          distance_m: Math.round(haversineMeters(centerLat, centerLng, lat, lng)),
          pending_count: Number(r.pending_count) || 0,
          has_coords: true,
        };
      })
      .filter((s) => s.distance_m <= radius)
      .sort((a, b) => a.distance_m - b.distance_m);

    return NextResponse.json({
      success: true,
      center: {
        lat: centerLat,
        lng: centerLng,
        source: center.source || 'properties',
      },
      has_coords: true,
      radius,
      streets: nearby,
    });
  } catch (error) {
    console.error('Error fetching nearby streets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch nearby streets' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { marieDB } from '@/lib/db';
import { isAdmin } from '@/lib/permissions';
import { extractStreetName } from '@/lib/google-maps';
import { invalidateStreetClustersForSuburb } from '@/lib/redis';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await marieDB.ensureOutreachTablesExist?.();
    const { searchParams } = new URL(request.url);
    const propertyIds = searchParams.get('property_ids')?.split(',').filter(Boolean);

    if (!propertyIds || propertyIds.length === 0) {
      return NextResponse.json({ liked_ids: [] });
    }

    const formatUuid = (id: string) => {
      const clean = id.replace(/-/g, '');
      if (clean.length === 32) {
        return `${clean.slice(0, 8)}-${clean.slice(8, 12)}-${clean.slice(12, 16)}-${clean.slice(16, 20)}-${clean.slice(20)}`;
      }
      return id;
    };

    const formattedUuids = propertyIds.map(formatUuid);

    const result = await marieDB.query(
      `SELECT property_id, louis_property_id FROM outreach_properties 
       WHERE (property_id = ANY($1::uuid[]) OR louis_property_id = ANY($2::text[])) 
         AND status = 'liked'`,
      [formattedUuids, propertyIds]
    );

    const likedIds = result.rows
      .map(r => (r.property_id ? r.property_id.replace(/-/g, '') : r.louis_property_id))
      .filter(Boolean);

    return NextResponse.json({ liked_ids: likedIds });
  } catch (error) {
    console.error('Error fetching liked properties:', error);
    return NextResponse.json({ error: 'Failed to fetch liked properties' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await marieDB.ensureOutreachTablesExist?.();
    const body = await request.json() as {
      property_id: string;
      property_address: string;
      suburb: string;
      city: string;
      region: string;
      street?: string;
    };

    const { property_id, property_address, suburb, city, region, street } = body;

    if (!property_id || !property_address || !suburb || !city || !region) {
      return NextResponse.json(
        { error: 'property_id, property_address, suburb, city, and region are required' },
        { status: 400 }
      );
    }

    // Derive the street name from the address when the caller didn't supply
    // one (e.g. the Properties page Like button). Without this, liked records
    // get street = NULL and are dropped by street-filtered views (Today's Run,
    // per-street filters) in the outreach page.
    const derivedStreet =
      street?.trim() ||
      extractStreetName(property_address);

    const existing = await marieDB.query(
      `SELECT id, status FROM outreach_properties WHERE property_id = $1 LIMIT 1`,
      [property_id]
    );

    if (existing.rows.length > 0) {
      const current = existing.rows[0];
      if (current.status === 'liked') {
        await marieDB.query(`DELETE FROM outreach_properties WHERE id = $1`, [current.id]);
        if (process.env.USE_OUTREACH_MV === 'true') {
          marieDB.query('REFRESH MATERIALIZED VIEW CONCURRENTLY outreach_enriched')
            .catch(err => console.error('MV refresh failed (non-critical):', err));
        }
        // Invalidate street-clusters cache so Today's Run reflects the change
        invalidateStreetClustersForSuburb(suburb).catch(() => { });
        return NextResponse.json({ liked: false });
      }
      await marieDB.query(
        `UPDATE outreach_properties
         SET status = 'liked', campaign = 'favorites',
             street = COALESCE(NULLIF(TRIM(street), ''), $2)
         WHERE id = $1`,
        [current.id, derivedStreet]
      );
      if (process.env.USE_OUTREACH_MV === 'true') {
        marieDB.query('REFRESH MATERIALIZED VIEW CONCURRENTLY outreach_enriched')
          .catch(err => console.error('MV refresh failed (non-critical):', err));
      }
      invalidateStreetClustersForSuburb(suburb).catch(() => { });
      return NextResponse.json({ liked: true });
    }

    await marieDB.query(
      `INSERT INTO outreach_properties (property_id, property_address, suburb, city, region, street, campaign, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'favorites', 'liked')`,
      [property_id, property_address.trim(), suburb.trim(), city.trim(), region.trim(), derivedStreet]
    );

    if (process.env.USE_OUTREACH_MV === 'true') {
      marieDB.query('REFRESH MATERIALIZED VIEW CONCURRENTLY outreach_enriched')
        .catch(err => console.error('MV refresh failed (non-critical):', err));
    }
    invalidateStreetClustersForSuburb(suburb).catch(() => { });

    return NextResponse.json({ liked: true });
  } catch (error) {
    console.error('Error toggling like:', error);
    return NextResponse.json({ error: 'Failed to toggle like' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { marieDB } from '@/lib/db';
import { isAdmin } from '@/lib/permissions';
import { haversineMeters } from '@/lib/street-clustering';

/**
 * GET /api/admin/outreach/liked-streets
 *
 * Returns all liked streets for a suburb (alphabetical) plus, when
 * start_street is provided, an ordered_streets list built by a greedy
 * nearest-neighbour walk.  Each street is anchored by its lowest-house-number
 * liked address so the order reflects natural walking sequence.
 *
 * Query params:
 *   suburb        - required
 *   start_street  - optional; triggers ordered_streets computation
 */
export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const suburb = searchParams.get('suburb')?.trim() ?? '';
  const startStreet = searchParams.get('start_street')?.trim() ?? '';

  if (!suburb) {
    return NextResponse.json({ error: 'suburb is required' }, { status: 400 });
  }

  try {
    await marieDB.ensureOutreachTablesExist?.();

    // ─── Step 1: All liked streets (alphabetical) with address count ──────────
    const { rows: streetRows } = await marieDB.query(
      `
      SELECT
        op.street,
        COUNT(*) AS address_count
      FROM outreach_properties op
      WHERE op.suburb = $1
        AND op.status = 'liked'
        AND op.street IS NOT NULL
        AND TRIM(op.street) <> ''
      GROUP BY op.street
      ORDER BY op.street ASC
      `,
      [suburb]
    );

    const allStreets: Array<{ street: string; count: number }> = streetRows.map((r) => ({
      street: r.street as string,
      count: Number(r.address_count),
    }));

    // ─── Step 2: Greedy ordered streets when start_street is given ────────────
    let orderedStreets: Array<{ street: string; count: number; distance_m: number }> = [];

    if (startStreet) {
      // For each street, find the coordinate of the liked address with the
      // LOWEST house number.  This represents the "first door" on that street,
      // giving a natural walking-order anchor point.
      const { rows: coordRows } = await marieDB.query(
        `
        SELECT
          op.street,
          p.latitude  AS lat,
          p.longitude AS lng,
          CAST(
            NULLIF(
              REGEXP_REPLACE(
                REGEXP_REPLACE(op.property_address, '^\\d+/', ''),
                '^(\\d+).*', '\\1'
              ),
              ''
            ) AS INTEGER
          ) AS house_num
        FROM outreach_properties op
        JOIN properties p
          ON REPLACE(op.property_id::text, '-', '') = p.id
        WHERE op.suburb = $1
          AND op.status = 'liked'
          AND op.street IS NOT NULL
          AND TRIM(op.street) <> ''
          AND p.latitude  IS NOT NULL
          AND p.longitude IS NOT NULL
        ORDER BY op.street ASC, house_num ASC NULLS LAST
        `,
        [suburb]
      );

      // Build a map: street → coordinate of its lowest-house-number address
      const streetAnchor = new Map<string, { lat: number; lng: number }>();
      for (const r of coordRows) {
        const s = r.street as string;
        if (!streetAnchor.has(s)) {
          streetAnchor.set(s, { lat: Number(r.lat), lng: Number(r.lng) });
        }
      }

      const anchor = streetAnchor.get(startStreet);

      if (anchor) {
        // Candidates: all streets except start_street that have coordinates
        const candidates = allStreets
          .filter((s) => s.street !== startStreet && streetAnchor.has(s.street))
          .map((s) => {
            const a = streetAnchor.get(s.street)!;
            return { street: s.street, count: s.count, lat: a.lat, lng: a.lng };
          });

        // Greedy nearest-neighbour walk from the start street's anchor
        const visited = new Set<string>();
        const ordered: typeof orderedStreets = [];
        let curLat = anchor.lat;
        let curLng = anchor.lng;

        while (visited.size < candidates.length) {
          let bestIdx = -1;
          let bestDist = Infinity;

          for (let i = 0; i < candidates.length; i++) {
            const c = candidates[i];
            if (visited.has(c.street)) continue;
            const d = haversineMeters(curLat, curLng, c.lat, c.lng);
            if (d < bestDist) {
              bestDist = d;
              bestIdx = i;
            }
          }

          if (bestIdx === -1) break;
          const next = candidates[bestIdx];
          visited.add(next.street);
          ordered.push({ street: next.street, count: next.count, distance_m: Math.round(bestDist) });
          curLat = next.lat;
          curLng = next.lng;
        }

        // Append streets with no coordinates at the end (alphabetical)
        for (const s of allStreets) {
          if (s.street !== startStreet && !streetAnchor.has(s.street)) {
            ordered.push({ street: s.street, count: s.count, distance_m: -1 });
          }
        }

        orderedStreets = ordered;
      }
    }

    return NextResponse.json({
      success: true,
      suburb,
      start_street: startStreet || null,
      all_streets: allStreets,
      ordered_streets: orderedStreets,
    });
  } catch (error) {
    console.error('Error fetching liked streets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch liked streets' },
      { status: 500 }
    );
  }
}

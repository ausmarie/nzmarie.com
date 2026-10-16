import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { marieDB } from '@/lib/db';
import { isAdmin } from '@/lib/permissions';
import { invalidateStreetClustersForSuburb } from '@/lib/redis';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await marieDB.ensureOutreachTablesExist?.();
    const body = await request.json() as { property_id?: string; louis_property_id?: string };
    const { property_id, louis_property_id } = body;
    if (!property_id && !louis_property_id) {
      return NextResponse.json({ error: 'property_id or louis_property_id required' }, { status: 400 });
    }

    const formatUuid = (id: string) => {
      const clean = id.replace(/-/g, '');
      if (clean.length === 32) {
        return `${clean.slice(0, 8)}-${clean.slice(8, 12)}-${clean.slice(12, 16)}-${clean.slice(16, 20)}-${clean.slice(20)}`;
      }
      return id;
    };

    const formatted = property_id ? formatUuid(property_id) : null;

    const result = await marieDB.query(
      `DELETE FROM outreach_properties WHERE property_id = $1 OR louis_property_id = $2 RETURNING id, property_id, status, suburb`,
      [formatted, louis_property_id || property_id]
    );

    const affectedSuburbs = new Set<string>();
    for (const r of result.rows) {
      if (r.suburb) affectedSuburbs.add(r.suburb);
    }
    for (const suburb of affectedSuburbs) {
      invalidateStreetClustersForSuburb(suburb).catch(() => { });
    }

    if (process.env.USE_OUTREACH_MV === 'true') {
      marieDB.query('REFRESH MATERIALIZED VIEW CONCURRENTLY outreach_enriched').catch(() => {});
    }

    return NextResponse.json({ success: true, deleted: result.rows.length });
  } catch (error) {
    console.error('Error unselecting outreach property:', error);
    return NextResponse.json({ error: 'Failed to unselect property' }, { status: 500 });
  }
}

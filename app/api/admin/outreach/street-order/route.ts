import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { marieDB } from '@/lib/db';
import { isAdmin } from '@/lib/permissions';
import { buildOutreachFilter } from '@/lib/outreach-filter';
import { buildStreetSummaries, toOrderable, AddressRow } from '@/lib/outreach-streets';
import { orderStreetsGreedily } from '@/lib/street-ordering';
import { invalidateStreetClustersForSuburb } from '@/lib/redis';

const KEY_PREFIX = 'outreach_street_order:';
const MAX_ORDER_STREETS = 500;

function parseOrder(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.filter((s): s is string => typeof s === 'string' && s.trim().length > 0);
    }
  } catch {
    // ignore malformed values
  }
  return [];
}

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const suburb = searchParams.get('suburb');
  const status = searchParams.get('status') || 'pending';
  const reportQuarter = searchParams.get('report_quarter');
  const sentStatus = (searchParams.get('sent_status') || 'unsent') as 'all' | 'unsent' | 'sent';

  if (!suburb) {
    return NextResponse.json({ error: 'Missing suburb parameter' }, { status: 400 });
  }

  try {
    await marieDB.ensureOutreachTablesExist?.();

    const { sql: where, params } = buildOutreachFilter({
      suburb,
      status,
      sentStatus,
      reportQuarter,
    });

    const { rows } = await marieDB.query(
      `
      SELECT op.street, op.house_number, op.property_address,
             p.latitude AS lat, p.longitude AS lng
      FROM outreach_properties op
      LEFT JOIN properties p ON REPLACE(op.property_id::text, '-', '') = p.id
      WHERE ${where}
      ORDER BY op.street ASC, op.house_number ASC NULLS LAST, op.property_address ASC
      `,
      params
    );

    const summaries = buildStreetSummaries(rows as AddressRow[], suburb);
    const streets = summaries.map((s) => ({
      street: s.street,
      suburb,
      address_count: s.address_count,
      has_coords: s.has_coords,
    }));

    const stored = await marieDB.query(
      `SELECT setting_value FROM admin_settings WHERE setting_key = $1 LIMIT 1`,
      [`${KEY_PREFIX}${suburb}`]
    );
    const rawOrder = parseOrder(stored?.rows?.[0]?.setting_value ?? null);
    const streetSet = new Set(streets.map((s) => s.street));
    const savedOrder = rawOrder.filter((s) => streetSet.has(s));

    let ordered: string[];
    if (savedOrder.length > 0) {
      const known = new Set(savedOrder);
      const rest = streets
        .filter((s) => !known.has(s.street))
        .map((s) => s.street)
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
      ordered = [...savedOrder, ...rest];
    } else {
      ordered = orderStreetsGreedily(summaries.map(toOrderable));
    }

    const orderIndex = new Map(ordered.map((name, i) => [name, i]));
    const orderedStreets = [...streets].sort((a, b) => {
      const ia = orderIndex.get(a.street);
      const ib = orderIndex.get(b.street);
      if (ia !== undefined && ib !== undefined) return ia - ib;
      if (ia !== undefined) return -1;
      if (ib !== undefined) return 1;
      return a.street.localeCompare(b.street, undefined, { sensitivity: 'base' });
    });

    return NextResponse.json({
      success: true,
      suburb,
      streets: orderedStreets,
      savedOrder,
      hasSavedOrder: savedOrder.length > 0,
    });
  } catch (error) {
    console.error('Error fetching street order:', error);
    return NextResponse.json({ error: 'Failed to fetch street order' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const session = await auth();

  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let suburb = '';
  let streets: unknown = [];
  try {
    const body = await request.json();
    suburb = typeof body?.suburb === 'string' ? body.suburb.trim() : '';
    streets = body?.streets;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!suburb) {
    return NextResponse.json({ error: 'suburb is required' }, { status: 400 });
  }
  if (!Array.isArray(streets)) {
    return NextResponse.json({ error: 'streets must be an array' }, { status: 400 });
  }

  const seen = new Set<string>();
  const clean: string[] = [];
  for (const s of streets) {
    if (typeof s !== 'string') continue;
    const trimmed = s.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    clean.push(trimmed);
    if (clean.length >= MAX_ORDER_STREETS) break;
  }

  try {
    await marieDB.ensureOutreachTablesExist?.();
    const value = JSON.stringify(clean);
    await marieDB.query(
      `INSERT INTO admin_settings (setting_key, setting_value, updated_at, updated_by)
       VALUES ($1, $2, NOW(), $3)
       ON CONFLICT (setting_key)
       DO UPDATE SET setting_value = $2, updated_at = NOW(), updated_by = $3`,
      [`${KEY_PREFIX}${suburb}`, value, session.user.email]
    );
    invalidateStreetClustersForSuburb(suburb).catch(() => {});
    return NextResponse.json({ success: true, suburb, order: clean });
  } catch (error) {
    console.error('Error saving street order:', error);
    return NextResponse.json({ error: 'Failed to save street order' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await auth();

  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const suburb = searchParams.get('suburb');

  if (!suburb) {
    return NextResponse.json({ error: 'Missing suburb parameter' }, { status: 400 });
  }

  try {
    await marieDB.ensureOutreachTablesExist?.();
    await marieDB.query(
      `DELETE FROM admin_settings WHERE setting_key = $1`,
      [`${KEY_PREFIX}${suburb}`]
    );
    invalidateStreetClustersForSuburb(suburb).catch(() => {});
    return NextResponse.json({ success: true, suburb });
  } catch (error) {
    console.error('Error clearing street order:', error);
    return NextResponse.json({ error: 'Failed to clear street order' }, { status: 500 });
  }
}

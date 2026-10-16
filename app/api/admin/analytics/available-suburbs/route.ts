import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query } from '@/lib/db';
import { isSuperAdmin } from '@/lib/permissions';

export async function GET() {
  const session = await auth();
  if (!session?.user?.email || !isSuperAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const tableCheck = await query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'market_monthly_snapshots'
      ) AS exists`
    );
    if (!tableCheck.rows[0]?.exists) {
      return NextResponse.json({ availableSuburbs: [] });
    }

    const result = await query<{ region_name: string }>(
      `SELECT DISTINCT region_name FROM market_monthly_snapshots
       WHERE region_type = 'suburb' ORDER BY region_name`
    );
    return NextResponse.json({ availableSuburbs: result.rows.map(r => r.region_name) });
  } catch {
    return NextResponse.json({ availableSuburbs: [] });
  }
}

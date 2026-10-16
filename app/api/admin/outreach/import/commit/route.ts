import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { marieDB } from '@/lib/db';
import { isAdmin } from '@/lib/permissions';

interface Row {
  property_address: string;
  suburb?: string;
  city?: string;
  region?: string;
  owner_name?: string;
  property_type?: string;
  campaign?: string;
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { rows } = await request.json() as { rows: Row[] };
    if (!Array.isArray(rows)) {
      return NextResponse.json({ error: 'rows array is required' }, { status: 400 });
    }

    const insertResults = await Promise.all(rows.map(async (r) => {
      if (!r.property_address) return { skipped: true, reason: 'invalid' };
      const campaign = r.campaign ?? '2026_Q3_Report';
      try {
        const res = await marieDB.query(
          `INSERT INTO outreach_properties
           (louis_property_id, property_address, suburb, street, city, region, owner_name, property_type, campaign, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
           ON CONFLICT (property_address, campaign) DO NOTHING
           RETURNING id`,
          [null, r.property_address.trim(), r.suburb ?? 'Unknown', null, r.city ?? 'Auckland City', r.region ?? 'Auckland', r.owner_name ?? null, r.property_type ?? null, campaign]
        );
        if (res.rows.length > 0) return { skipped: false, id: res.rows[0].id };
        return { skipped: true, reason: 'duplicate' };
      } catch (err) {
        console.error('Import commit insert failed:', err);
        return { skipped: true, reason: 'error' };
      }
    }));

    const added = insertResults.filter(r => !r.skipped).length;
    const skipped = insertResults.length - added;

    return NextResponse.json({ success: true, added, skipped, details: insertResults });
  } catch (err) {
    console.error('Import commit failed:', err);
    return NextResponse.json({ error: 'Failed to commit import' }, { status: 500 });
  }
}

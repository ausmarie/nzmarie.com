import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { marieDB } from '@/lib/db';
import { isAdmin } from '@/lib/permissions';

interface Row {
  property_address?: string;
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

    const previewNew: Row[] = [];
    const previewDuplicate: Row[] = [];
    const previewInvalid: Row[] = [];

    await Promise.all(rows.map(async (r) => {
      if (!r.property_address || typeof r.property_address !== 'string') {
        previewInvalid.push(r);
        return;
      }

      const campaign = r.campaign ?? '2026_Q3_Report';
      const dup = await marieDB.query(
        `SELECT id FROM outreach_properties WHERE property_address ILIKE $1 AND campaign = $2 LIMIT 1`,
        [r.property_address.trim(), campaign]
      );

      if (dup.rows.length > 0) previewDuplicate.push(r);
      else previewNew.push(r);
    }));

    return NextResponse.json({
      total: rows.length,
      new: previewNew.length,
      duplicate: previewDuplicate.length,
      invalid: previewInvalid.length,
      newAddresses: previewNew,
      duplicateAddresses: previewDuplicate,
      invalidAddresses: previewInvalid,
    });
  } catch (err) {
    console.error('Import preview failed:', err);
    return NextResponse.json({ error: 'Failed to preview import' }, { status: 500 });
  }
}

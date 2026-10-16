import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { marieDB } from '@/lib/db';
import { isAdmin } from '@/lib/permissions';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { property_ids, new_campaign } = await request.json();
    if (!Array.isArray(property_ids) || property_ids.length === 0 || !new_campaign) {
      return NextResponse.json({ error: 'property_ids and new_campaign are required' }, { status: 400 });
    }

    // Insert copies of selected properties into the same table with new campaign and reset status to pending
    const res = await marieDB.query(
      `INSERT INTO outreach_properties
       (louis_property_id, property_address, suburb, street, city, region, owner_name, property_type, campaign, status)
       SELECT louis_property_id, property_address, suburb, street, city, region, owner_name, property_type, $1, 'pending'
       FROM outreach_properties
       WHERE id = ANY($2::uuid[])
       ON CONFLICT (property_address, campaign) DO NOTHING
       RETURNING id`,
      [new_campaign, property_ids]
    );

    return NextResponse.json({ success: true, added: res.rows.length });
  } catch (err) {
    console.error('Failed to copy campaign properties:', err);
    return NextResponse.json({ error: 'Failed to copy properties' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { marieDB } from '@/lib/db';
import { isAdmin } from '@/lib/permissions';

export async function GET() {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await marieDB.query(
      `SELECT id, client_name, property_address, suburb, region, city,
              email, phone, timeline, motivation, language_preference, heard_from,
              created_at
       FROM appraisal_leads
       WHERE alert_status = 'pending'
       ORDER BY created_at DESC
       LIMIT 100`
    );

    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching appraisal alerts:', error);
    return NextResponse.json({ error: 'Failed to fetch appraisal alerts' }, { status: 500 });
  }
}

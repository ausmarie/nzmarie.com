import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { marieDB } from '@/lib/db';
import { isAdmin } from '@/lib/permissions';

// Lightweight lead list for the Leads Reports-mode sidebar (address + suburb only)
export async function GET() {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await marieDB.query(
      `SELECT id, property_address, suburb, status, priority
       FROM leads
       ORDER BY created_at DESC
       LIMIT 1000`
    );
    return NextResponse.json({ success: true, leads: result.rows });
  } catch (error) {
    console.error('Error fetching leads list:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch leads' }, { status: 500 });
  }
}

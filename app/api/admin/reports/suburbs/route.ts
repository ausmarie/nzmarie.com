import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query as marieQuery } from '@/lib/db';
import { isAdmin } from '@/lib/permissions';

export async function GET() {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const result = await marieQuery(
      `SELECT * FROM report_suburbs WHERE is_active = TRUE ORDER BY sort_order ASC, name ASC`
    );
    return NextResponse.json({ success: true, suburbs: result.rows });
  } catch (error) {
    console.error('Error fetching suburbs:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch suburbs' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { name, region } = body;

    if (!name || !region) {
      return NextResponse.json({ success: false, error: 'name and region are required' }, { status: 400 });
    }

    const result = await marieQuery<{ id: string }>(
      `INSERT INTO report_suburbs (name, region) VALUES ($1, $2) RETURNING id`,
      [name, region]
    );

    return NextResponse.json({ success: true, id: result.rows[0].id });
  } catch (error) {
    console.error('Error creating suburb:', error);
    return NextResponse.json({ success: false, error: 'Failed to create suburb' }, { status: 500 });
  }
}

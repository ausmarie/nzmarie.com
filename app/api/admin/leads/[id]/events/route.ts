import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { marieDB } from '@/lib/db';
import { isAdmin } from '@/lib/permissions';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const result = await marieDB.query(
      `SELECT * FROM lead_events WHERE lead_id = $1 ORDER BY created_at DESC`,
      [id]
    );

    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching lead events:', error);
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json() as {
      event_type?: string;
      title?: string;
      description?: string;
    };

    const { event_type, title, description } = body;

    if (!event_type || !title) {
      return NextResponse.json(
        { error: 'Event type and title are required' },
        { status: 400 }
      );
    }

    // Verify lead exists
    const leadCheck = await marieDB.query(
      `SELECT id FROM leads WHERE id = $1`,
      [id]
    );
    if (leadCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    const result = await marieDB.query(
      `INSERT INTO lead_events (lead_id, event_type, title, description, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [id, event_type, title, description?.trim() || null, session.user.email]
    );

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error creating lead event:', error);
    return NextResponse.json({ error: 'Failed to create event' }, { status: 500 });
  }
}

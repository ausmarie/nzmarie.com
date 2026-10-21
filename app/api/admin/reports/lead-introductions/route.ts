import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query as marieQuery } from '@/lib/db';
import { isAdmin } from '@/lib/permissions';
import { ensureAllLeadIntroductions, ensureLeadIntroduction } from '@/lib/lead-introduction-server';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const rawBody = await request.text();
    let body: Record<string, unknown> = {};
    if (rawBody) {
      try {
        body = JSON.parse(rawBody) as Record<string, unknown>;
      } catch {
        body = {};
      }
    }

    const adminResult = await marieQuery<{ id: string }>(
      `SELECT id FROM admin_users WHERE email = $1 LIMIT 1`,
      [session.user.email]
    );
    if (adminResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }
    const userId = adminResult.rows[0].id;

    if (typeof body.lead_id === 'string' && body.lead_id.length > 0) {
      const id = await ensureLeadIntroduction(body.lead_id, userId);
      return NextResponse.json({ success: true, id, created: id ? 1 : 0 });
    }

    const created = await ensureAllLeadIntroductions(userId);
    return NextResponse.json({ success: true, created });
  } catch (error) {
    console.error('Error ensuring lead introductions:', error);
    return NextResponse.json({ success: false, error: 'Failed to ensure lead introductions' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { marieDB } from '@/lib/db';
import { isAdmin } from '@/lib/permissions';
import { invalidateStreetClustersForSuburb } from '@/lib/redis';

export async function PATCH(
  _request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const session = await auth();

  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    await marieDB.ensureOutreachTablesExist?.();
    const result = await marieDB.query(
      `UPDATE outreach_properties
       SET status = 'sent',
           sent_at = NOW(),
           sent_by = $1
       WHERE id = $2
       RETURNING *`,
      [session.user.email, params.id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    // Invalidate street-clusters cache for this suburb
    const suburban = result.rows[0]?.suburb;
    if (suburban) {
      invalidateStreetClustersForSuburb(suburban).catch(() => { });
    }

    return NextResponse.json({ success: true, data: result.rows[0], message: 'Marked as sent successfully' });
  } catch (error) {
    console.error('Error marking as sent:', error);
    return NextResponse.json({ error: 'Failed to mark as sent' }, { status: 500 });
  }
}

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
    const body = await _request.json() as { status: string };
    const { status } = body;

    const validStatuses = ['liked', 'pending', 'sent', 'interacted', 'converted'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    await marieDB.ensureOutreachTablesExist?.();
    const result = await marieDB.query(
      `UPDATE outreach_properties
       SET status = $1,
           total_send_count = CASE WHEN $1 = 'pending' THEN 0 ELSE total_send_count END,
           last_sent_at = CASE WHEN $1 = 'pending' THEN NULL ELSE last_sent_at END,
           last_campaign = CASE WHEN $1 = 'pending' THEN NULL ELSE last_campaign END,
           sent_at = CASE WHEN $1 = 'pending' THEN NULL ELSE sent_at END,
           sent_by = CASE WHEN $1 = 'pending' THEN NULL ELSE sent_by END,
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [status, params.id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    // When rolling back to pending, also clear send logs and sent fields
    if (status === 'pending') {
      await marieDB.query(
        `DELETE FROM outreach_send_logs WHERE outreach_property_id = $1`,
        [params.id]
      );
      try {
        await marieDB.query(
          `DELETE FROM outreach_property_quarter_status WHERE outreach_property_id = $1`,
          [params.id]
        );
      } catch {
        // quarter-status table may not exist yet (migration not applied)
      }
    }

    // Invalidate street-clusters cache for this suburb
    const suburban = result.rows[0]?.suburb;
    if (suburban) {
      invalidateStreetClustersForSuburb(suburban).catch(() => { });
    }

    if (process.env.USE_OUTREACH_MV === 'true') {
      marieDB.query('REFRESH MATERIALIZED VIEW CONCURRENTLY outreach_enriched')
        .catch(err => console.error('MV refresh failed (non-critical):', err));
    }

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error updating status:', error);
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
  }
}

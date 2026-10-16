import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { marieDB } from '@/lib/db';
import { isAdmin } from '@/lib/permissions';

export async function GET(
  _request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const session = await auth();

  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await marieDB.ensureOutreachTablesExist?.();
    const result = await marieDB.query(
      `SELECT 
        l.id as log_id,
        l.outreach_property_id,
        l.suburb_report_id,
        l.report_title,
        l.campaign_key,
        l.suburb,
        l.sent_at,
        l.sent_by,
        l.notes,
        sr.file_url as pdf_file_url,
        sr.file_name as pdf_file_name,
        COALESCE(SUM(qt.scan_count), 0)::INTEGER as scan_count
       FROM outreach_send_logs l
       LEFT JOIN suburb_reports sr ON l.suburb_report_id = sr.id
       LEFT JOIN outreach_qr_tokens qt ON l.id = qt.send_log_id
       WHERE l.outreach_property_id = $1
       GROUP BY l.id, sr.id
       ORDER BY l.sent_at DESC`,
      [params.id]
    );

    return NextResponse.json({
      success: true,
      history: result.rows,
    });
  } catch (error) {
    console.error('Error fetching outreach send history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch send history' },
      { status: 500 }
    );
  }
}

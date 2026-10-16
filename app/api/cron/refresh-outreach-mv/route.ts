import { NextResponse } from 'next/server';
import { marieDB } from '@/lib/db';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await Promise.all([
      marieDB.query('REFRESH MATERIALIZED VIEW CONCURRENTLY outreach_enriched'),
      marieDB.query('REFRESH MATERIALIZED VIEW mv_suburb_quarter_summary'),
      marieDB.query('REFRESH MATERIALIZED VIEW mv_quarter_overview'),
      marieDB.query('REFRESH MATERIALIZED VIEW mv_dispatch_timeline'),
    ]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Cron MV refresh failed:', error);
    return NextResponse.json({ error: 'Refresh failed' }, { status: 500 });
  }
}

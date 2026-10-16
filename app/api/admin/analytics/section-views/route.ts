import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { marieDB } from '@/lib/db';
import { isSuperAdmin } from '@/lib/permissions';

const PERIOD_INTERVALS: Record<string, string> = {
  week: '7 days',
  month: '30 days',
  quarter: '90 days',
  year: '365 days',
};

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.email || !isSuperAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'month';
    const suburb = searchParams.get('suburb');
    const interval = PERIOD_INTERVALS[period] || PERIOD_INTERVALS.month;

    const conditions = [`created_at >= NOW() - INTERVAL '${interval}'`];
    const params: unknown[] = [];

    if (suburb && suburb !== 'all') {
      params.push(suburb);
      conditions.push(`campaign_key = $${params.length}`);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const [summaryResult, bySuburbResult, bySectionResult, dailyTrendResult, recentLogsResult] = await Promise.all([
      marieDB.query(`
        SELECT
          COUNT(DISTINCT visitor_hash)::int as total_users,
          COUNT(*)::int as total_section_views,
          COUNT(*) FILTER (WHERE is_new_device = true)::int as new_devices,
          COUNT(*) FILTER (WHERE is_new_device = false)::int as repeat_devices
        FROM section_view_logs
        ${whereClause}
      `, params),

      marieDB.query(`
        SELECT
          COALESCE(campaign_key, 'unknown') as suburb,
          COUNT(DISTINCT visitor_hash)::int as users,
          COUNT(*) FILTER (WHERE is_new_device = true)::int as new_devices,
          COUNT(*) FILTER (WHERE is_new_device = false)::int as repeat_devices,
          MAX(created_at) as last_visited_at
        FROM section_view_logs
        ${whereClause}
        GROUP BY campaign_key
        ORDER BY users DESC
      `, params),

      marieDB.query(`
        SELECT
          section_name,
          COUNT(*)::int as total_views,
          COUNT(DISTINCT visitor_hash)::int as unique_users,
          COUNT(*) FILTER (WHERE is_new_device = true)::int as new_devices,
          COUNT(*) FILTER (WHERE is_new_device = false)::int as repeat_devices
        FROM section_view_logs
        ${whereClause}
        GROUP BY section_name
        ORDER BY total_views DESC
      `, params),

      marieDB.query(`
        SELECT
          TO_CHAR(created_at AT TIME ZONE 'Pacific/Auckland', 'YYYY-MM-DD') as date,
          section_name,
          COUNT(*)::int as view_count
        FROM section_view_logs
        ${whereClause}
        GROUP BY date, section_name
        ORDER BY date ASC, section_name ASC
      `, params),

      marieDB.query(`
        SELECT
          created_at as time,
          COALESCE(campaign_key, 'unknown') as suburb,
          is_new_device,
          section_name
        FROM section_view_logs
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT 50
      `, params),
    ]);

    const dailyTrendMap: Record<string, Record<string, number>> = {};
    for (const row of dailyTrendResult.rows) {
      if (!dailyTrendMap[row.date]) dailyTrendMap[row.date] = {};
      dailyTrendMap[row.date][row.section_name] = row.view_count;
    }
    const dailyTrend = Object.entries(dailyTrendMap).map(([date, sections]) => ({
      date,
      ...sections,
    }));

    const recentLogsMap: Record<string, { time: string; suburb: string; is_new_device: boolean; sections: string[] }> = {};
    for (const row of recentLogsResult.rows) {
      const key = `${row.time}_${row.suburb}`;
      if (!recentLogsMap[key]) {
        recentLogsMap[key] = {
          time: row.time,
          suburb: row.suburb,
          is_new_device: row.is_new_device,
          sections: [],
        };
      }
      if (!recentLogsMap[key].sections.includes(row.section_name)) {
        recentLogsMap[key].sections.push(row.section_name);
      }
    }

    return NextResponse.json({
      success: true,
      summary: summaryResult.rows[0] || { total_users: 0, total_section_views: 0, new_devices: 0, repeat_devices: 0 },
      by_suburb: bySuburbResult.rows,
      by_section: bySectionResult.rows,
      daily_trend: dailyTrend,
      recent_logs: Object.values(recentLogsMap).slice(0, 20),
    });
  } catch (error) {
    console.error('Error fetching section views:', error);
    return NextResponse.json(
      { error: 'Failed to fetch section views' },
      { status: 500 }
    );
  }
}

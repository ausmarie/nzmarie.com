import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { marieDB } from '@/lib/db';
import { isSuperAdmin } from '@/lib/permissions';
import { ensureCampaignTablesExist } from '@/lib/campaign-tracker';

const RANGE_DAYS: Record<string, number> = {
  '1h': 1,
  '6h': 1,
  '1d': 1,
  '2d': 2,
  '1w': 7,
  '2w': 14,
  '1m': 30,
  '2m': 60,
  '3m': 90,
  '6m': 180,
  '1y': 365,
};

const SUB_DAY_RANGES = new Set(['1h', '6h']);

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.email || !isSuperAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    await ensureCampaignTablesExist();

    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || '1m';
    const days = RANGE_DAYS[range] || 30;
    const isSubDay = SUB_DAY_RANGES.has(range);

    const cutoff = new Date();
    if (isSubDay) {
      const hours = range === '1h' ? 1 : 6;
      cutoff.setHours(cutoff.getHours() - hours);
    } else {
      cutoff.setDate(cutoff.getDate() - days);
    }

    const timeExpr = isSubDay
      ? "TO_CHAR(created_at AT TIME ZONE 'Pacific/Auckland', 'YYYY-MM-DD\"T\"HH24:00:00')"
      : "TO_CHAR(created_at AT TIME ZONE 'Pacific/Auckland', 'YYYY-MM-DD')";
    const timeAlias = 'time_slot';

    const result = await marieDB.query(`
      SELECT
        ${timeExpr} as ${timeAlias},
        campaign_key,
        COUNT(*) as total_pv,
        COUNT(DISTINCT visitor_hash) as total_uv,
        COUNT(*) FILTER (WHERE is_new_device = true) as new_devices
      FROM campaign_visit_logs
      WHERE created_at >= $1
      GROUP BY ${timeExpr}, campaign_key
      ORDER BY ${timeAlias} ASC, campaign_key ASC
    `, [cutoff]);

    const rows = result.rows;
    const timeMap: Record<string, Record<string, { pv: number; uv: number; newDevices: number }>> = {};
    const campaignSet = new Set<string>();
    const campaignNames: Record<string, string> = {};

    for (const row of rows) {
      const raw = row.time_slot;
      const label = String(raw);
      const ck = row.campaign_key;
      if (!timeMap[label]) timeMap[label] = {};
      timeMap[label][ck] = { pv: parseInt(row.total_pv || '0', 10), uv: parseInt(row.total_uv || '0', 10), newDevices: parseInt(row.new_devices || '0', 10) };
      campaignSet.add(ck);
      campaignNames[ck] = ck.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
    }

    const campaigns = Array.from(campaignSet).map(key => ({
      key,
      name: campaignNames[key],
    }));

    const data = Object.entries(timeMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([time, camps]) => {
        const point: Record<string, unknown> = { time };
        let newDevicesTotal = 0;
        for (const ck of campaignSet) {
          point[ck] = camps[ck]?.pv ?? 0;
          newDevicesTotal += camps[ck]?.newDevices ?? 0;
        }
        point.newDevices = newDevicesTotal;
        return point;
      });

    return NextResponse.json({ success: true, data, campaigns, isSubDay });
  } catch (error) {
    console.error('Error fetching scan trends:', error);
    return NextResponse.json(
      { error: 'Failed to fetch scan trends' },
      { status: 500 }
    );
  }
}

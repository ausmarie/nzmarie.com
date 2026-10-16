import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { marieDB } from '@/lib/db';
import { isSuperAdmin } from '@/lib/permissions';
import { ensureCampaignTablesExist } from '@/lib/campaign-tracker';

// ─── In-memory cache (30 s TTL) ──────────────────────────────────────────────
const scansCache = new Map<string, { data: unknown; expiry: number }>();

function getCached<T>(key: string): T | null {
  const entry = scansCache.get(key);
  if (entry && entry.expiry > Date.now()) return entry.data as T;
  scansCache.delete(key);
  return null;
}

function setCache(key: string, data: unknown, ttlMs: number) {
  if (scansCache.size > 20) {
    const oldest = [...scansCache.keys()].slice(0, 5);
    oldest.forEach(k => scansCache.delete(k));
  }
  scansCache.set(key, { data, expiry: Date.now() + ttlMs });
}

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.email || !isSuperAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    await ensureCampaignTablesExist();

    const { searchParams } = new URL(request.url);
    const selectedCampaign = searchParams.get('campaign');
    const typeFilter = searchParams.get('type');
    const dateFilter = searchParams.get('date');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const limitRaw = parseInt(searchParams.get('limit') || '20', 10) || 20;
    const limit = Math.min(Math.max(1, limitRaw), 500);
    const offset = (page - 1) * limit;
    const cacheKey = `scans_${selectedCampaign ?? 'all'}_${typeFilter ?? 'all'}_${dateFilter ?? 'all'}_p${page}_l${limit}`;

    const cached = getCached<unknown>(cacheKey);
    if (cached) return NextResponse.json(cached);

    const columns = 'id, campaign_key, visitor_hash, ip_address, user_agent, device_type, referrer, is_unique, is_new_device, visit_count, first_scanned_at, last_scanned_at, created_at';

    const conditions: string[] = [];
    const baseParams: unknown[] = [];

    if (selectedCampaign && selectedCampaign !== 'all') {
      baseParams.push(selectedCampaign);
      conditions.push(`campaign_key = $${baseParams.length}`);
    }

    if (typeFilter === 'new_device') {
      conditions.push('is_new_device = true');
    } else if (typeFilter === 'repeat') {
      conditions.push('is_new_device = false');
    }

    if (dateFilter) {
      baseParams.push(dateFilter);
      conditions.push(`TO_CHAR(created_at AT TIME ZONE 'Pacific/Auckland', 'YYYY-MM-DD') = $${baseParams.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const summaryPromise = marieDB.query(`
      SELECT
        COALESCE(SUM(total_pv), 0) as total_pv,
        COALESCE(SUM(total_uv), 0) as total_uv,
        (SELECT COUNT(*)::int FROM campaign_visit_logs WHERE is_new_device = true) as total_new_devices
      FROM campaign_analytics
    `);
    const campaignsPromise = marieDB.query(`
      SELECT
        ca.campaign_key,
        ca.campaign_name,
        ca.total_pv,
        ca.total_uv,
        ca.last_visited_at,
        COALESCE(vl.new_devices, 0)::int as new_devices
      FROM campaign_analytics ca
      LEFT JOIN (
        SELECT campaign_key, COUNT(*)::int as new_devices
        FROM campaign_visit_logs
        WHERE is_new_device = true
        GROUP BY campaign_key
      ) vl ON vl.campaign_key = ca.campaign_key
      ORDER BY COALESCE(vl.new_devices, 0) DESC, ca.total_pv DESC, ca.campaign_name ASC
    `);

    const providedPage = searchParams.has('page') || searchParams.has('limit');
    if (!providedPage) {
      const logsQueryNoLimit = `SELECT ${columns}
         FROM campaign_visit_logs
         ${whereClause}
         ORDER BY created_at DESC LIMIT 100`;

      const [summaryResult, campaignsResult, logsResult] = await Promise.all([
        summaryPromise,
        campaignsPromise,
        marieDB.query(logsQueryNoLimit, baseParams),
      ]);

      const capitalize = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

      const response = {
        success: true,
        total_scans: parseInt(summaryResult.rows[0]?.total_pv || '0', 10),
        total_unique: parseInt(summaryResult.rows[0]?.total_uv || '0', 10),
        total_new_devices: parseInt(summaryResult.rows[0]?.total_new_devices || '0', 10),
        campaigns: campaignsResult.rows.map(row => ({
          campaign_key: row.campaign_key,
          campaign_name: capitalize(row.campaign_name || row.campaign_key),
          total_pv: parseInt(row.total_pv || '0', 10),
          total_uv: parseInt(row.total_uv || '0', 10),
          new_devices: parseInt(row.new_devices || '0', 10),
          last_visited_at: row.last_visited_at,
        })).sort((a, b) => {
          if (b.new_devices !== a.new_devices) return b.new_devices - a.new_devices;
          if (b.total_pv !== a.total_pv) return b.total_pv - a.total_pv;
          return a.campaign_name.localeCompare(b.campaign_name);
        }),
        logs: logsResult.rows,
      };

      setCache(cacheKey, response, 30_000);
      return NextResponse.json(response);
    }

    const newDeviceWhere = selectedCampaign && selectedCampaign !== 'all'
      ? 'WHERE campaign_key = $1 AND is_new_device = true'
      : 'WHERE is_new_device = true';
    const repeatWhere = selectedCampaign && selectedCampaign !== 'all'
      ? 'WHERE campaign_key = $1 AND is_new_device = false'
      : 'WHERE is_new_device = false';
    const newDeviceCountPromise = marieDB.query(
      `SELECT COUNT(*)::int as cnt FROM campaign_visit_logs ${newDeviceWhere}`,
      selectedCampaign && selectedCampaign !== 'all' ? [selectedCampaign] : []
    );
    const repeatCountPromise = marieDB.query(
      `SELECT COUNT(*)::int as cnt FROM campaign_visit_logs ${repeatWhere}`,
      selectedCampaign && selectedCampaign !== 'all' ? [selectedCampaign] : []
    );

    const logsQuery = `SELECT ${columns}
       FROM campaign_visit_logs
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${baseParams.length + 1} OFFSET $${baseParams.length + 2}`;

    const countQuery = `SELECT COUNT(*)::int as total FROM campaign_visit_logs ${whereClause}`;

    const logsPromise = marieDB.query(logsQuery, [...baseParams, limit, offset]);
    const countPromise = marieDB.query(countQuery, baseParams);

    const [summaryResult, campaignsResult, logsResult, countResult, newDeviceCountResult, repeatCountResult] = await Promise.all([
      summaryPromise,
      campaignsPromise,
      logsPromise,
      countPromise,
      newDeviceCountPromise,
      repeatCountPromise,
    ]);

    const capitalize = (s: string) =>
      s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    const response = {
      success: true,
      total_scans: parseInt(summaryResult.rows[0]?.total_pv || '0', 10),
      total_unique: parseInt(summaryResult.rows[0]?.total_uv || '0', 10),
      total_new_devices: parseInt(summaryResult.rows[0]?.total_new_devices || '0', 10),
      campaigns: campaignsResult.rows.map(row => ({
        campaign_key: row.campaign_key,
        campaign_name: capitalize(row.campaign_name || row.campaign_key),
        total_pv: parseInt(row.total_pv || '0', 10),
        total_uv: parseInt(row.total_uv || '0', 10),
        new_devices: parseInt(row.new_devices || '0', 10),
        last_visited_at: row.last_visited_at,
      })).sort((a, b) => {
        if (b.new_devices !== a.new_devices) return b.new_devices - a.new_devices;
        if (b.total_pv !== a.total_pv) return b.total_pv - a.total_pv;
        return a.campaign_name.localeCompare(b.campaign_name);
      }),
      logs: logsResult.rows,
      total_logs: countResult.rows[0]?.total ?? 0,
      new_device_count: newDeviceCountResult.rows[0]?.cnt ?? 0,
      repeat_count: repeatCountResult.rows[0]?.cnt ?? 0,
      page,
      limit,
    };

    setCache(cacheKey, response, 30_000);
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching scan analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch scan analytics' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isAdmin } from '@/lib/permissions';
import { getDashboardStatsCached } from '@/lib/redis';
import { db } from '@/lib/drizzle';
import { ensureCampaignTablesExist } from '@/lib/campaign-tracker';
import { formatReportKey } from '@/lib/format-report';
import { campaignMatchesPeriod, campaignPatternForPeriod, latestPeriodKey, parsePeriodParts, periodLabel, periodSortValue } from '@/lib/report-period';
import { sql } from 'drizzle-orm';

interface SuburbCountRow {
  suburb?: string;
  sent_count?: string | number;
}

interface OutreachSuburbRow {
  suburb?: string;
  pending_count?: string | number;
  sent_count?: string | number;
  total_count?: string | number;
  last_sent_at?: string | Date | null;
}

interface SentSummaryItem {
  suburb: string;
  sent_count: number;
}

interface ScanCampaignItem {
  campaign_key: string;
  campaign_name: string;
  total_pv: number;
  total_uv: number;
  new_devices: number;
}

interface ScanCampaignRow {
  campaign_key?: string;
  campaign_name?: string | null;
  total_pv?: string | number;
  total_uv?: string | number;
  new_devices?: string | number;
}

interface SuburbDownloadRow {
  suburb?: string;
  download_count?: string | number;
}

interface TodaySentSuburbRow {
  suburb?: string;
  sent_count?: string | number;
}

interface RecentAppraisalRow {
  id?: string;
  client_name?: string | null;
  email?: string | null;
  phone?: string | null;
  suburb?: string | null;
  property_address?: string | null;
  contact_status?: string | null;
  created_at?: string | Date | null;
}

interface TrendRow {
  suburb?: string;
  campaign_key?: string;
  bucket?: string;
  sent?: string | number;
  junk?: string | number;
}

interface SuburbDispatchRow {
  suburb?: string;
  campaign_key?: string;
  period_key?: string | null;
  sent_count?: string | number;
  junk_count?: string | number;
  total_count?: string | number;
  unsent_count?: string | number;
  first_sent_at?: string | Date | null;
  last_sent_at?: string | Date | null;
}

interface TrendBucket {
  bucket: string;
  sent: number;
  junk: number;
}

interface BuiltTrend {
  all: TrendBucket[];
  bySuburb: Record<string, TrendBucket[]>;
}

interface QuarterOverviewRow {
  quarter_key: string;
  quarter: string;
  year: number;
  suburbs_count: string | number;
  total_properties: string | number;
  total_sent: string | number;
  total_unsent: string | number;
  total_partial: string | number;
  total_send_events: string | number;
}

interface SuburbQuarterDetailRow {
  suburb: string;
  total_properties: string | number;
  sent_count: string | number;
  unsent_count: string | number;
  partial_count: string | number;
  last_sent_at: string | null;
}

interface QuarterlySuburbSentRow {
  quarter_key?: string | null;
  suburb?: string;
  sent_count?: string | number;
  last_sent_at?: string | Date | null;
}

interface ActiveReportRow {
  suburb?: string;
  quarter?: string;
  year?: number | string;
  file_url?: string;
}

interface QuarterlySentSuburb {
  suburb: string;
  sent_count: number;
  last_sent_at: string | null;
  report_url: string | null;
}

interface QuarterlySentSummary {
  quarter_key: string;
  total_sent: number;
  suburbs: QuarterlySentSuburb[];
}

interface QuarterOverviewTotalRow {
  quarter_key: string;
  total_sent: string | number;
}

interface QuarterOverview {
  quarterKey: string;
  quarter: string;
  year: number;
  suburbsCount: number;
  totalProperties: number;
  totalSent: number;
  totalUnsent: number;
  totalPartial: number;
  totalSendEvents: number;
}

interface SuburbQuarterDetail {
  suburb: string;
  total: number;
  sent: number;
  unsent: number;
  partial: number;
  lastSentAt: string | null;
}

interface QuarterData {
  quarterKey: string;
  quarter: string;
  year: number;
  overview: {
    suburbsCount: number;
    totalProperties: number;
    totalSent: number;
    totalUnsent: number;
    totalPartial: number;
    totalSendEvents: number;
  };
  suburbs: SuburbQuarterDetail[];
}

interface OutreachSuburbSummary {
  suburb: string;
  pending_count: number;
  sent_count: number;
  total_count: number;
  last_sent_at: string | null;
}

interface RecentAppraisalSummary {
  id: string;
  client_name: string;
  email: string;
  phone: string;
  suburb: string;
  property_address: string;
  contact_status: string;
  created_at: string | null;
}

interface SentSummaryResult {
  total_sent: number;
  suburb_count: number;
  suburbs: SentSummaryItem[];
  today: { total_sent: number; suburbs: SentSummaryItem[] };
  quarterly: QuarterlySentSummary[];
}

function buildTrend(sentRows: TrendRow[], junkRows: TrendRow[]): BuiltTrend {
  const bySuburb: Record<string, Map<string, TrendBucket>> = {};
  const allMap = new Map<string, TrendBucket>();
  const ensure = (reportName: string, bucket: string): TrendBucket => {
    if (!bySuburb[reportName]) bySuburb[reportName] = new Map();
    let b = bySuburb[reportName].get(bucket);
    if (!b) {
      b = { bucket, sent: 0, junk: 0 };
      bySuburb[reportName].set(bucket, b);
    }
    return b;
  };
  for (const r of sentRows) {
    if (!r.suburb || !r.bucket) continue;
    const reportKey = formatReportKey(r.campaign_key || r.suburb, r.suburb);
    ensure(reportKey, r.bucket).sent += Number(r.sent) || 0;
  }
  for (const r of junkRows) {
    if (!r.suburb || !r.bucket) continue;
    const reportKey = formatReportKey(r.campaign_key || r.suburb, r.suburb);
    ensure(reportKey, r.bucket).junk += Number(r.junk) || 0;
  }
  const sortArr = (arr: TrendBucket[]) => arr.sort((a, b) => a.bucket.localeCompare(b.bucket));
  const perSuburb: Record<string, TrendBucket[]> = {};
  for (const [suburb, map] of Object.entries(bySuburb)) {
    const buckets = sortArr([...map.values()]);
    perSuburb[suburb] = buckets;
    for (const b of buckets) {
      const cur = allMap.get(b.bucket) ?? { bucket: b.bucket, sent: 0, junk: 0 };
      cur.sent += b.sent;
      cur.junk += b.junk;
      allMap.set(b.bucket, cur);
    }
  }
  return { all: sortArr([...allMap.values()]), bySuburb: perSuburb };
}

function toTrendRows(value: unknown): TrendRow[] {
  return Array.isArray(value) ? value as TrendRow[] : [];
}

function mapOutreachBySuburb(value: unknown): OutreachSuburbSummary[] {
  return (Array.isArray(value) ? value as OutreachSuburbRow[] : []).map((item) => ({
    suburb: item?.suburb || 'Unknown',
    pending_count: Number(item?.pending_count) || 0,
    sent_count: Number(item?.sent_count) || 0,
    total_count: Number(item?.total_count) || 0,
    last_sent_at: item?.last_sent_at ? new Date(item.last_sent_at).toISOString() : null,
  }));
}

function mapRecentAppraisals(value: unknown): RecentAppraisalSummary[] {
  return (Array.isArray(value) ? value as RecentAppraisalRow[] : [])
    .filter((item) => !!item?.id)
    .map((item) => ({
      id: item.id as string,
      client_name: item.client_name || 'Unknown',
      email: item.email || '',
      phone: item.phone || '',
      suburb: item.suburb || '',
      property_address: item.property_address || '',
      contact_status: item.contact_status || '',
      created_at: item.created_at ? new Date(item.created_at).toISOString() : null,
    }))
    .sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : Number.NEGATIVE_INFINITY;
      const tb = b.created_at ? new Date(b.created_at).getTime() : Number.NEGATIVE_INFINITY;
      return tb - ta;
    });
}

function buildReportsMap(rows: unknown): Map<string, string> {
  const map = new Map<string, string>();
  for (const r of (Array.isArray(rows) ? rows as ActiveReportRow[] : [])) {
    if (!r.suburb || !r.quarter || r.year == null) continue;
    const key = `${r.suburb.trim().toLowerCase()}|${periodLabel(Number(r.year), r.quarter).toUpperCase()}`;
    if (!map.has(key)) map.set(key, r.file_url || '');
  }
  return map;
}

function buildQuarterlySentSummaries(
  value: unknown,
  reportsMap: Map<string, string>
): QuarterlySentSummary[] {
  const quarterlyMap = new Map<string, QuarterlySentSuburb[]>();
  for (const item of (Array.isArray(value) ? value as QuarterlySuburbSentRow[] : [])) {
    if (!item.quarter_key || !item.suburb) continue;
    const reportUrl = /^[0-9]{4}-Q[1-4]$/.test(item.quarter_key)
      ? reportsMap.get(`${item.suburb.trim().toLowerCase()}|${item.quarter_key.toUpperCase()}`) || null
      : null;
    let arr = quarterlyMap.get(item.quarter_key);
    if (!arr) { arr = []; quarterlyMap.set(item.quarter_key, arr); }
    arr.push({
      suburb: item.suburb,
      sent_count: Number(item.sent_count) || 0,
      last_sent_at: item.last_sent_at ? new Date(item.last_sent_at).toISOString() : null,
      report_url: reportUrl,
    });
  }

  return Array.from(quarterlyMap.entries())
    .map(([quarterKey, suburbs]) => ({
      quarter_key: quarterKey,
      total_sent: suburbs.reduce((sum, s) => sum + s.sent_count, 0),
      suburbs: suburbs.sort((a, b) => {
        if (b.sent_count !== a.sent_count) return b.sent_count - a.sent_count;
        const ta = a.last_sent_at ? new Date(a.last_sent_at).getTime() : Number.NEGATIVE_INFINITY;
        const tb = b.last_sent_at ? new Date(b.last_sent_at).getTime() : Number.NEGATIVE_INFINITY;
        return tb - ta;
      }),
    }))
    .sort((a, b) => periodSortValue(b.quarter_key) - periodSortValue(a.quarter_key));
}

function buildSentSummary(
  row: Record<string, unknown>,
  outreachBySuburb: OutreachSuburbSummary[],
  reportsMap: Map<string, string>,
  options: { quarterTotals?: boolean } = {}
): SentSummaryResult {
  const sentSummarySuburbs: SuburbCountRow[] =
    Array.isArray(row.sent_summary_suburbs) && (row.sent_summary_suburbs as SuburbCountRow[]).length > 0
      ? row.sent_summary_suburbs as SuburbCountRow[]
      : outreachBySuburb.filter((item) => Number(item?.sent_count) > 1);

  const sentSummary: SentSummaryItem[] = sentSummarySuburbs.map((item) => ({
    suburb: item?.suburb || 'Unknown',
    sent_count: Number(item?.sent_count) || 0,
  }));

  const todaySentSuburbs: SentSummaryItem[] = (Array.isArray(row.today_suburb_sent) ? row.today_suburb_sent as TodaySentSuburbRow[] : [])
    .filter((item) => !!item?.suburb)
    .map((item) => ({
      suburb: item.suburb as string,
      sent_count: Number(item.sent_count) || 0,
    }))
    .filter((item) => item.sent_count > 0)
    .sort((a, b) => b.sent_count - a.sent_count || a.suburb.localeCompare(b.suburb));

  // The single source of truth for "sent" is the quarter materialized view, so
  // the Total Sent headline can never disagree with the quarter cards below it.
  const quarterTotals = options.quarterTotals && Array.isArray(row.quarter_overview_totals)
    ? row.quarter_overview_totals as QuarterOverviewTotalRow[]
    : [];

  const quarterlySentSummaries = quarterTotals.length > 0
    ? buildQuarterlySentSummariesFromTotals(quarterTotals)
    : buildQuarterlySentSummaries(row.quarterly_suburb_sent, reportsMap);

  return {
    total_sent: quarterTotals.length > 0
      ? quarterTotals.reduce((sum, q) => sum + (Number(q.total_sent) || 0), 0)
      : quarterlySentSummaries.length > 0
        ? quarterlySentSummaries.reduce((sum, q) => sum + q.total_sent, 0)
        : Number(row.sent_summary_total_sent) || sentSummary.reduce((sum: number, item) => sum + Number(item.sent_count || 0), 0),
    suburb_count: Number(row.sent_summary_suburb_count) || sentSummary.length,
    suburbs: sentSummary,
    today: {
      total_sent: todaySentSuburbs.reduce((sum, item) => sum + item.sent_count, 0),
      suburbs: todaySentSuburbs,
    },
    quarterly: quarterlySentSummaries,
  };
}

function buildQuarterlySentSummariesFromTotals(rows: QuarterOverviewTotalRow[]): QuarterlySentSummary[] {
  return rows
    .filter((item) => !!item?.quarter_key && /^[0-9]{4}-(Q[1-4]|M[0-9]{2})$/.test(item.quarter_key))
    .map((item) => ({
      quarter_key: item.quarter_key,
      total_sent: Number(item.total_sent) || 0,
      suburbs: [],
    }))
    .sort((a, b) => periodSortValue(b.quarter_key) - periodSortValue(a.quarter_key));
}

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const suburb = searchParams.get('suburb');
  const quarterKey = searchParams.get('quarterKey');
  const part = searchParams.get('part');
  let targetQuarterKey = quarterKey || '2026-Q2';
  // Bumped whenever the underlying data changed so two loads triggered in quick
  // succession (e.g. a React effect firing twice) don't both run the heavy
  // aggregation and burn Registers twice. It also makes a stale cached payload
  // from before a fix impossible to keep serving for the whole TTL.
  const cacheVersion = 8;

  try {
    await ensureCampaignTablesExist();

    // Lightweight payload used to paint the two priority cards (Total Sent and
    // Total Appraisals) before the full dashboard query finishes.
    if (part === 'summary') {
      const summaryCacheKey = `dashboard:stats:summary:v${cacheVersion}:${suburb || 'all'}:${quarterKey || 'all'}`;
      const summaryResult = await getDashboardStatsCached(
        summaryCacheKey,
        async () => {
          const suburbFilter = suburb && suburb !== 'all';
          const suburbSql = suburbFilter ? sql`AND op.suburb = ${suburb}` : sql``;

          const summaryRows = await db.execute(sql`
            WITH
              outreach_by_suburb_full_cte AS MATERIALIZED (
                SELECT
                  op.suburb,
                  COUNT(*) FILTER (WHERE op.status IN ('pending', 'sent'))::int AS pending_count,
                  COUNT(*) FILTER (WHERE op.status = 'sent')::int AS sent_count,
                  COUNT(*)::int AS total_count
                FROM outreach_properties op
                WHERE op.suburb IS NOT NULL
                  ${suburbSql}
                GROUP BY op.suburb
              ),
              sent_summary_cte AS (
                SELECT suburb, sent_count
                FROM outreach_by_suburb_full_cte
                WHERE sent_count > 0
                ORDER BY sent_count DESC, suburb ASC
              ),
              today_sent_cte AS MATERIALIZED (
                SELECT
                  sl.suburb,
                  COUNT(DISTINCT sl.outreach_property_id)::int AS sent_count
                FROM outreach_send_logs sl
                WHERE sl.sent_at IS NOT NULL
                  AND date_trunc('day', sl.sent_at AT TIME ZONE 'Pacific/Auckland')
                    = date_trunc('day', CURRENT_TIMESTAMP AT TIME ZONE 'Pacific/Auckland')
                  AND NOT EXISTS (
                    SELECT 1
                    FROM outreach_property_quarter_status returned
                    WHERE returned.outreach_property_id = sl.outreach_property_id
                      AND returned.suburb_report_id = sl.suburb_report_id
                      AND returned.status = 'pending'
                  )
                  ${suburbFilter ? sql`AND sl.suburb = ${suburb}` : sql``}
                GROUP BY sl.suburb
              ),
              quarterly_suburb_sent_cte AS (
                SELECT
                  CASE WHEN sl.campaign_key ~ '^[0-9]{4}[_-]Q[1-4]'
                    THEN substring(sl.campaign_key from '^([0-9]{4})') || '-' || substring(sl.campaign_key from '[_-](Q[1-4])')
                    WHEN sl.campaign_key ~ '^[0-9]{4}[_-]M[0-9]{2}'
                    THEN substring(sl.campaign_key from '^([0-9]{4})') || '-' || substring(sl.campaign_key from '[_-]M([0-9]{2})')
                    WHEN sr.quarter ~ '^Q[1-4]$' AND sr.year IS NOT NULL
                    THEN sr.year || '-' || sr.quarter
                    WHEN sr.quarter ~ '^M[0-9]{2}$' AND sr.year IS NOT NULL
                    THEN sr.year || '-' || substring(sr.quarter from 'M([0-9]{2})')
                  END AS quarter_key,
                  sl.suburb,
                  COUNT(DISTINCT sl.outreach_property_id) AS sent_count,
                  MAX(sl.sent_at) AS last_sent_at
                FROM outreach_send_logs sl
                LEFT JOIN suburb_reports sr ON sr.id = sl.suburb_report_id
                WHERE sl.suburb IS NOT NULL
                  AND NOT EXISTS (
                    SELECT 1
                    FROM outreach_property_quarter_status returned
                    WHERE returned.outreach_property_id = sl.outreach_property_id
                      AND returned.suburb_report_id = sl.suburb_report_id
                      AND returned.status = 'pending'
                  )
                  ${suburbFilter ? sql`AND sl.suburb = ${suburb}` : sql``}
                GROUP BY 1, 2
              )
            SELECT
              (SELECT COALESCE(json_agg(row_to_json(s)), '[]') FROM sent_summary_cte s) as sent_summary_suburbs,
              (SELECT COUNT(*) FROM sent_summary_cte) as sent_summary_suburb_count,
              (SELECT COALESCE(SUM(sent_count), 0) FROM sent_summary_cte) as sent_summary_total_sent,
              (SELECT COALESCE(json_agg(row_to_json(q) ORDER BY q.year DESC, q.quarter DESC), '[]')
                 FROM mv_quarter_overview q) as quarter_overview_totals,
              (SELECT COALESCE(json_agg(row_to_json(s)), '[]') FROM (
                SELECT suburb, sent_count FROM today_sent_cte
                ORDER BY sent_count DESC, suburb ASC
              ) s) as today_suburb_sent,
              (SELECT COALESCE(json_agg(row_to_json(q) ORDER BY q.year DESC, q.quarter DESC), '[]')
                 FROM mv_quarter_overview q) as quarter_overview_totals,
              (SELECT COUNT(*) FROM appraisal_leads) as total_bookings,
              (SELECT COALESCE(json_agg(row_to_json(a)), '[]') FROM (
                SELECT id, client_name, email, phone, suburb, property_address, contact_status, created_at
                FROM appraisal_leads
                ORDER BY created_at DESC
                LIMIT 5
              ) a) as recent_appraisals
          `);

          const row = (summaryRows.rows[0] || {}) as Record<string, unknown>;
          // Summary cards do not render report links, so skip the extra
          // suburb_reports round trip. The target quarter follows the same
          // rule as the full payload: the newest quarter present in the view.
          const summaryTargetQuarterKey = quarterKey
            || latestPeriodKey((Array.isArray(row.quarter_overview_totals)
              ? row.quarter_overview_totals as QuarterOverviewTotalRow[]
              : []).map((item) => item?.quarter_key))
            || latestPeriodKey((Array.isArray(row.quarterly_suburb_sent)
              ? row.quarterly_suburb_sent as QuarterlySuburbSentRow[]
              : []).map((item) => item?.quarter_key))
            || '2026-Q2';

          return {
            sentSummary: buildSentSummary(row, [], new Map(), { quarterTotals: true }),
            totalBookings: Number(row.total_bookings) || 0,
            recentAppraisals: mapRecentAppraisals(row.recent_appraisals),
            targetQuarterKey: summaryTargetQuarterKey,
          };
        },
        300
      );

      return NextResponse.json({
        success: true,
        part: 'summary',
        stats: summaryResult,
        suburb: suburb || 'all',
        quarterKey: summaryResult.targetQuarterKey,
        timestamp: new Date().toISOString(),
      });
    }

    const cacheKey = `dashboard:stats:v${cacheVersion}:${suburb || 'all'}:${quarterKey || 'all'}`;

    const result = await getDashboardStatsCached(
      cacheKey,
      async () => {
        const suburbFilter = suburb && suburb !== 'all';
        const suburbCondition = suburbFilter ? sql`AND suburb = ${suburb}` : sql``;

        // Fetch quarter overview from materialized view (all quarters). The
        // active sending quarter is whatever the view reports as the newest
        // quarter: the view is refreshed by the cron job and after each send
        // batch, so keeping it as the single source of truth means the
        // dashboard never disagrees with the Top Cards. Outside the request,
        // live data is only used as a fallback while the view is still empty.
        const quarterOverviewResult = await db.execute(sql`
          WITH
            latest_live_quarter AS (
              SELECT quarter_key, quarter_index
              FROM (
                SELECT
                  quarter_key,
                  substring(quarter_key from '^([0-9]{4})')::int * 4
                    + (substring(quarter_key from 'Q([1-4])')::int - 1) AS quarter_index
                FROM outreach_property_quarter_status
                WHERE quarter_key ~ '^[0-9]{4}-Q[1-4]$'
                  AND (
                    status = 'sent'
                    OR (status = 'partial' AND COALESCE(sent_count, 0) > 0)
                  )
              ) sent
              ORDER BY quarter_index DESC
              LIMIT 1
            ),
            latest_report_quarter AS (
              SELECT
                year::text || '-Q' || substring(quarter from 'Q([1-4])') AS quarter_key,
                year::int * 4 + (substring(quarter from 'Q([1-4])')::int - 1) AS quarter_index
              FROM suburb_reports
              WHERE status = 'active'
                AND year IS NOT NULL
                AND quarter ~ '^Q[1-4]$'
              ORDER BY quarter_index DESC
              LIMIT 1
            ),
            latest_mv_quarter AS (
              SELECT quarter_key
              FROM mv_quarter_overview
              WHERE quarter_key ~ '^[0-9]{4}-Q[1-4]$'
              ORDER BY year DESC, quarter DESC
              LIMIT 1
            )
          SELECT
            q.quarter_key, q.quarter, q.year, q.suburbs_count, q.total_properties,
            q.total_sent, q.total_unsent, q.total_partial, q.total_send_events,
            COALESCE(
              (SELECT quarter_key FROM latest_mv_quarter),
              (SELECT quarter_key FROM latest_live_quarter),
              (SELECT quarter_key FROM latest_report_quarter)
            ) AS latest_quarter_key
          FROM mv_quarter_overview q
          ORDER BY q.year DESC, q.quarter DESC
        `);

        // Determine target quarter
        targetQuarterKey = quarterKey
          || ((quarterOverviewResult.rows[0] as unknown as { latest_quarter_key?: string })?.latest_quarter_key)
          || (quarterOverviewResult.rows[0] as unknown as QuarterOverviewRow)?.quarter_key
          || '2026-Q2';

        const targetPeriodParts = parsePeriodParts(targetQuarterKey);
        const targetCampaignPattern = targetPeriodParts
          ? campaignPatternForPeriod(targetPeriodParts.year, targetPeriodParts.code)
          : null;

        // Fetch suburb detail for target quarter from materialized view
        const suburbDetailQuery = suburbFilter
          ? sql`SELECT suburb, total_properties, sent_count, unsent_count, partial_count, last_sent_at
                FROM mv_suburb_quarter_summary
                WHERE quarter_key = ${targetQuarterKey}
                AND suburb = ${suburb}
                ORDER BY sent_count DESC, suburb`
          : sql`SELECT suburb, total_properties, sent_count, unsent_count, partial_count, last_sent_at
                FROM mv_suburb_quarter_summary
                WHERE quarter_key = ${targetQuarterKey}
                ORDER BY sent_count DESC, suburb`;

        const suburbDetailResult = await db.execute(suburbDetailQuery);

        const quarterOverview: QuarterOverview[] = (quarterOverviewResult.rows as unknown as QuarterOverviewRow[]).map((row) => ({
          quarterKey: row.quarter_key,
          quarter: row.quarter,
          year: Number(row.year),
          suburbsCount: Number(row.suburbs_count) || 0,
          totalProperties: Number(row.total_properties) || 0,
          totalSent: Number(row.total_sent) || 0,
          totalUnsent: Number(row.total_unsent) || 0,
          totalPartial: Number(row.total_partial) || 0,
          totalSendEvents: Number(row.total_send_events) || 0,
        }));

        const targetQuarterOverview = quarterOverview.find((q) => q.quarterKey === targetQuarterKey) || quarterOverview[0];

        const suburbDetails: SuburbQuarterDetail[] = (suburbDetailResult.rows as unknown as SuburbQuarterDetailRow[]).map((row) => ({
          suburb: row.suburb,
          total: Number(row.total_properties) || 0,
          sent: Number(row.sent_count) || 0,
          unsent: Number(row.unsent_count) || 0,
          partial: Number(row.partial_count) || 0,
          lastSentAt: row.last_sent_at ? new Date(row.last_sent_at).toISOString() : null,
        }));

        // Fetch overall stats (non-quarter-aware, for general stats)
        
        const dbResult = await db.execute(sql`
          WITH
            new_leads_cte AS (
              SELECT COUNT(*) as count FROM appraisal_leads
              WHERE created_at >= date_trunc('month', CURRENT_TIMESTAMP)
              ${suburbCondition}
            ),
            high_priority_cte AS (
              SELECT COUNT(*) as count FROM appraisal_leads
              WHERE priority = 'high'
              ${suburbCondition}
            ),
            today_followups_cte AS (
              SELECT COUNT(*) as count FROM appraisal_leads
              WHERE follow_up_at::date = CURRENT_DATE
              AND contact_status NOT IN ('converted', 'lost')
              ${suburbCondition}
            ),
            overdue_followups_cte AS (
              SELECT COUNT(*) as count FROM appraisal_leads
              WHERE follow_up_at::date < CURRENT_DATE
              AND contact_status NOT IN ('converted', 'lost')
              ${suburbCondition}
            ),
            outreach_status_cte AS (
              SELECT
                COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
                COUNT(*) FILTER (WHERE status = 'sent') as sent_count,
                COUNT(*) as total_count
              FROM outreach_properties
              WHERE status IN ('pending', 'sent', 'partial')
              ${suburbCondition}
            ),
            downloads_summary_cte AS (
              SELECT
                COUNT(*) FILTER (WHERE downloaded_at::date = CURRENT_DATE) as today_count,
                COUNT(*) as total_count,
                COUNT(*) FILTER (WHERE downloaded_at >= date_trunc('month', CURRENT_TIMESTAMP)) as month_count
              FROM report_downloads
            ),
            bookings_summary_cte AS (
              SELECT
                COUNT(*) as total_count,
                COUNT(*) FILTER (WHERE created_at >= date_trunc('month', CURRENT_TIMESTAMP)) as month_count
              FROM appraisal_leads
            ),
            qr_codes_cte AS (
              SELECT COUNT(*) as count FROM suburb_qr_codes
            ),
            pdf_reports_cte AS (
              SELECT COUNT(*) as count FROM suburb_reports
              WHERE status = 'active'
            ),
            outreach_by_suburb_full_cte AS MATERIALIZED (
              SELECT
                op.suburb,
                COUNT(*) FILTER (WHERE op.status IN ('pending', 'sent'))::int as pending_count,
                COUNT(*) FILTER (WHERE op.status = 'sent')::int as sent_count,
                COUNT(*)::int as total_count,
                MAX(sl.last_sent_at) AS last_sent_at
              FROM outreach_properties op
              LEFT JOIN (
                SELECT outreach_property_id, MAX(sent_at) AS last_sent_at
                FROM outreach_send_logs
                GROUP BY outreach_property_id
              ) sl ON sl.outreach_property_id = op.id
              WHERE op.suburb IS NOT NULL
              GROUP BY op.suburb
            ),
            outreach_by_suburb_cte AS (
              SELECT * FROM outreach_by_suburb_full_cte
              ORDER BY last_sent_at DESC NULLS LAST, total_count DESC
              LIMIT 20
            ),
            sent_summary_cte AS (
              SELECT
                suburb,
                sent_count
              FROM outreach_by_suburb_full_cte
              WHERE sent_count > 0
              ORDER BY sent_count DESC, suburb ASC
            ),
            scans_summary_cte AS (
              SELECT
                COALESCE(SUM(total_pv), 0) as total_pv,
                COALESCE(SUM(total_uv), 0) as total_uv,
                (SELECT COUNT(*)::int FROM campaign_visit_logs WHERE is_new_device = true) as total_new_devices
              FROM campaign_analytics
            ),
            scans_by_campaign_cte AS (
              SELECT
                ca.campaign_key,
                ca.campaign_name,
                ca.total_pv,
                ca.total_uv,
                COALESCE(vl.new_devices, 0)::int as new_devices
              FROM campaign_analytics ca
              LEFT JOIN (
                SELECT campaign_key, COUNT(*)::int as new_devices
                FROM campaign_visit_logs
                WHERE is_new_device = true
                GROUP BY campaign_key
              ) vl ON vl.campaign_key = ca.campaign_key
              ORDER BY COALESCE(vl.new_devices, 0) DESC, ca.total_pv DESC, ca.campaign_name ASC
            ),
            downloads_by_suburb_cte AS (
              SELECT
                suburb,
                COUNT(*) as download_count
              FROM report_downloads
              GROUP BY suburb
              ORDER BY download_count DESC
              LIMIT 20
            ),
            recent_downloads_cte AS (
              SELECT
                id, email, name, suburb,
                downloaded_at, source, tracking_code
              FROM report_downloads
              ORDER BY downloaded_at DESC
              LIMIT 5
            ),
            junk_props_raw AS (
              SELECT
                op.id AS op_id,
                op.suburb,
                op.last_campaign,
                op.campaign,
                COALESCE(p.no_junk_mail_updated_at, op.created_at AT TIME ZONE 'Pacific/Auckland') AS junk_at,
                p.id AS property_id
              FROM outreach_properties op
              JOIN properties p ON REPLACE(op.property_id::text, '-', '') = p.id
              WHERE p.no_junk_mail = TRUE
            ),
            junk_props_report AS MATERIALIZED (
              SELECT op_id, campaign_key
              FROM (
                SELECT
                  j.op_id,
                  sr.year::text || '_' || sr.quarter || '_' || sr.suburb AS campaign_key,
                  ROW_NUMBER() OVER (PARTITION BY j.op_id ORDER BY sr.uploaded_at DESC) AS rn
                FROM junk_props_raw j
                JOIN suburb_reports sr
                  ON sr.suburb = j.suburb
                 AND sr.status = 'active'
                 AND sr.year IS NOT NULL
                 AND (sr.quarter ~ '^Q[1-4]$' OR sr.quarter ~ '^M[0-9]{2}$')
                 AND sr.uploaded_at <= j.junk_at
              ) matched
              WHERE matched.rn = 1
            ),
            junk_props_base AS MATERIALIZED (
              SELECT
                j.suburb,
                COALESCE(r.campaign_key, j.last_campaign, j.campaign) AS campaign_key,
                j.junk_at,
                j.property_id,
                j.op_id
              FROM junk_props_raw j
              LEFT JOIN junk_props_report r ON r.op_id = j.op_id
            ),
            junk_props_buckets AS MATERIALIZED (
              SELECT
                suburb,
                campaign_key,
                date_trunc('day', junk_at AT TIME ZONE 'Pacific/Auckland') AS day_bucket,
                date_trunc('week', junk_at AT TIME ZONE 'Pacific/Auckland') AS week_bucket,
                date_trunc('month', junk_at AT TIME ZONE 'Pacific/Auckland') AS month_bucket,
                date_trunc('quarter', junk_at AT TIME ZONE 'Pacific/Auckland') AS quarter_bucket,
                date_trunc('year', junk_at AT TIME ZONE 'Pacific/Auckland') AS year_bucket,
                property_id
              FROM junk_props_base
              ${targetCampaignPattern ? sql`WHERE campaign_key ~* ${targetCampaignPattern}` : sql``}
            ),
            outreach_canonical AS MATERIALIZED (
              SELECT
                sl.suburb,
                CASE WHEN sl.campaign_key ~ '^[0-9]{4}[_-]Q[1-4]'
                  THEN substring(sl.campaign_key from '^([0-9]{4})') || '-Q' || substring(sl.campaign_key from '[_-]Q([1-4])')
                  WHEN sl.campaign_key ~ '^[0-9]{4}[_-]M([0-9]{2})'
                  THEN substring(sl.campaign_key from '^([0-9]{4})') || '-' || substring(sl.campaign_key from '[_-]M([0-9]{2})')
                  WHEN sr.quarter ~ '^Q[1-4]$' AND sr.year IS NOT NULL
                  THEN sr.year || '-' || sr.quarter
                  WHEN sr.quarter ~ '^M[0-9]{2}$' AND sr.year IS NOT NULL
                  THEN sr.year || '-' || sr.quarter
                END AS period_key,
                sl.outreach_property_id AS pid,
                sl.sent_at,
                sl.campaign_key
              FROM outreach_send_logs sl
              LEFT JOIN suburb_reports sr ON sr.id = sl.suburb_report_id
              WHERE sl.suburb IS NOT NULL
                AND sl.sent_at IS NOT NULL
                ${suburbFilter ? sql`AND sl.suburb = ${suburb}` : sql``}
                AND NOT EXISTS (
                  SELECT 1
                  FROM outreach_property_quarter_status returned
                  WHERE returned.outreach_property_id = sl.outreach_property_id
                    AND returned.suburb_report_id = sl.suburb_report_id
                    AND returned.status = 'pending'
                )
              UNION ALL
              SELECT
                quarter_status_sent.suburb,
                quarter_status_sent.quarter_key,
                quarter_status_sent.outreach_property_id,
                quarter_status_sent.last_sent_at,
                COALESCE(
                  quarter_status_sent.campaign_keys[1],
                  quarter_status_sent.year::text || '_' || quarter_status_sent.quarter || '_' || quarter_status_sent.suburb
                )
              FROM outreach_property_quarter_status quarter_status_sent
              WHERE quarter_status_sent.quarter ~ '^Q[1-4]$'
                AND (
                  quarter_status_sent.status = 'sent'
                  OR (
                    quarter_status_sent.status = 'partial'
                    AND COALESCE(quarter_status_sent.sent_count, 0) > 0
                  )
                )
                AND NOT EXISTS (
                  SELECT 1
                  FROM outreach_send_logs sl
                  WHERE sl.outreach_property_id = quarter_status_sent.outreach_property_id
                    AND sl.suburb_report_id = quarter_status_sent.suburb_report_id
                )
                ${suburbFilter ? sql`AND quarter_status_sent.suburb = ${suburb}` : sql``}
            ),
            sent_logs_buckets AS MATERIALIZED (
              SELECT
                suburb,
                campaign_key,
                period_key,
                pid,
                sent_at,
                date_trunc('day', sent_at AT TIME ZONE 'Pacific/Auckland') AS day_bucket,
                date_trunc('week', sent_at AT TIME ZONE 'Pacific/Auckland') AS week_bucket,
                date_trunc('month', sent_at AT TIME ZONE 'Pacific/Auckland') AS month_bucket,
                date_trunc('quarter', sent_at AT TIME ZONE 'Pacific/Auckland') AS quarter_bucket,
                date_trunc('year', sent_at AT TIME ZONE 'Pacific/Auckland') AS year_bucket
              FROM outreach_canonical
            ),
            quarterly_suburb_sent_cte AS (
              SELECT
                period_key AS quarter_key,
                suburb,
                COUNT(DISTINCT pid) AS sent_count,
                MAX(sent_at) AS last_sent_at
              FROM outreach_canonical
              WHERE period_key IS NOT NULL
              GROUP BY 1, 2
            ),
            dispatch_report_periods AS MATERIALIZED (
              SELECT DISTINCT
                sr.suburb,
                CASE WHEN sr.quarter ~ '^Q[1-4]$' THEN 'quarter' ELSE 'month' END AS period_type,
                CASE WHEN sr.quarter ~ '^Q[1-4]$'
                  THEN sr.year::int * 4 + (substring(sr.quarter from 'Q([1-4])')::int - 1)
                END AS q_index,
                CASE WHEN sr.quarter ~ '^Q[1-4]$'
                  THEN sr.year::text || '-Q' || substring(sr.quarter from 'Q([1-4])')
                  ELSE sr.year::text || '-' || substring(sr.quarter from 'M([0-9]{2})')
                END AS period_key,
                CASE WHEN sr.quarter ~ '^Q[1-4]$'
                  THEN make_date(
                    sr.year::int,
                    (substring(sr.quarter from 'Q([1-4])')::int - 1) * 3 + 1,
                    1
                  ) + INTERVAL '3 months'
                END AS period_end,
                (sr.year::text || '_' || sr.quarter || '_' || sr.suburb) AS campaign_key
              FROM suburb_reports sr
              WHERE sr.status = 'active'
                AND sr.suburb IS NOT NULL
                AND sr.year IS NOT NULL
                AND (sr.quarter ~ '^Q[1-4]$' OR sr.quarter ~ '^M[0-9]{2}$')
                ${suburbFilter ? sql`AND sr.suburb = ${suburb}` : sql``}
            ),
            dispatch_quarter_sent AS MATERIALIZED (
              SELECT
                suburb,
                q_index,
                COUNT(DISTINCT pid) AS sent_count,
                MIN(sent_at) AS first_sent_at,
                MAX(sent_at) AS last_sent_at,
                MIN(campaign_key) AS campaign_key
              FROM (
                SELECT
                  suburb,
                  (substring(period_key from '^([0-9]{4})')::int * 4
                    + (substring(period_key from 'Q([1-4])$')::int - 1)) AS q_index,
                  pid,
                  sent_at,
                  campaign_key
                FROM outreach_canonical
                WHERE period_key ~ '^[0-9]{4}-Q[1-4]$'
              ) quarter_sent
              GROUP BY 1, 2
            ),
            dispatch_month_sent AS MATERIALIZED (
              SELECT
                suburb,
                period_key,
                COUNT(DISTINCT pid) AS sent_count,
                MIN(sent_at) AS first_sent_at,
                MAX(sent_at) AS last_sent_at,
                MIN(campaign_key) AS campaign_key
              FROM outreach_canonical
              WHERE period_key ~ '^[0-9]{4}-[0-9]{2}$'
              GROUP BY suburb, period_key
            ),
            dispatch_legacy_sent AS MATERIALIZED (
              SELECT
                suburb,
                campaign_key,
                COUNT(DISTINCT pid) AS sent_count,
                MIN(sent_at) AS first_sent_at,
                MAX(sent_at) AS last_sent_at
              FROM outreach_canonical
              WHERE period_key IS NULL
              GROUP BY suburb, campaign_key
            ),
            dispatch_period_activity AS MATERIALIZED (
              SELECT DISTINCT suburb, period_key
              FROM outreach_canonical
              WHERE period_key IS NOT NULL
              UNION
              SELECT DISTINCT suburb, quarter_key
              FROM outreach_property_quarter_status
              WHERE quarter_key ~ '^[0-9]{4}-Q[1-4]$'
            ),
            -- Junk mail is attributed to the report that was current when the
            -- property was flagged (same rule as the Dispatch Volume chart), so
            -- a suburb's first campaign shows the bulk of its junk mail and the
            -- following campaigns only show newly discovered addresses.
            dispatch_junk_periods AS MATERIALIZED (
              SELECT
                suburb,
                CASE WHEN campaign_key ~ '^[0-9]{4}[_-]Q[1-4]'
                  THEN substring(campaign_key from '^([0-9]{4})') || '-Q' || substring(campaign_key from '[_-]Q([1-4])')
                  WHEN campaign_key ~ '^[0-9]{4}[_-]M[0-9]{2}'
                  THEN substring(campaign_key from '^([0-9]{4})') || '-' || substring(campaign_key from '[_-]M([0-9]{2})')
                END AS period_key,
                op_id AS pid
              FROM junk_props_base
            ),
            dispatch_sent_pairs AS MATERIALIZED (
              SELECT DISTINCT suburb, period_key, pid
              FROM outreach_canonical
              WHERE period_key IS NOT NULL
            ),
            dispatch_period_sent AS MATERIALIZED (
              SELECT suburb, period_key, COUNT(DISTINCT pid) AS sent_count
              FROM outreach_canonical
              WHERE period_key ~ '^[0-9]{4}-(Q[1-4]|[0-9]{2})$'
              GROUP BY suburb, period_key
            ),
            dispatch_junk_by_period AS MATERIALIZED (
              SELECT
                j.suburb,
                j.period_key,
                COUNT(DISTINCT j.pid) FILTER (WHERE sent.pid IS NULL) AS junk_count
              FROM dispatch_junk_periods j
              -- Junk mail is only ever "produced" by a campaign that actually went
              -- out: a quarter with no dispatch has no junk mail figure at all.
              JOIN dispatch_period_sent ps
                ON ps.suburb = j.suburb
               AND ps.period_key = j.period_key
               AND ps.sent_count > 0
              LEFT JOIN dispatch_sent_pairs sent
                ON sent.suburb = j.suburb
               AND sent.period_key = j.period_key
               AND sent.pid = j.pid
              WHERE j.period_key IS NOT NULL
              GROUP BY j.suburb, j.period_key
            ),
            dispatch_audience_props AS MATERIALIZED (
              SELECT rq.suburb, rq.period_key, op.id AS pid
              FROM dispatch_report_periods rq
              LEFT JOIN dispatch_quarter_sent prev
                ON prev.suburb = rq.suburb AND prev.q_index = rq.q_index - 1
              LEFT JOIN dispatch_period_activity act
                ON act.suburb = rq.suburb AND act.period_key = rq.period_key
              JOIN outreach_properties op
                ON op.suburb = rq.suburb AND op.status IN ('pending', 'sent')
              WHERE rq.period_type = 'quarter'
                -- Use the full suburb audience when the previous quarter was not
                -- sent, and also for a brand new report period that has no
                -- planned/sent properties yet (report uploaded in Assets but no
                -- dispatch activity). Otherwise the suburb×period row would be
                -- all zeros and never show up in the timeline.
                AND (prev.suburb IS NULL OR act.suburb IS NULL)
              UNION
              SELECT rq.suburb, rq.period_key, returned.outreach_property_id
              FROM dispatch_report_periods rq
              JOIN outreach_property_quarter_status returned
                ON returned.suburb = rq.suburb
               AND returned.quarter_key = rq.period_key
               AND returned.status = 'pending'
              WHERE rq.period_type = 'quarter'
              UNION
              SELECT rq.suburb, rq.period_key, outreach_canonical.pid
              FROM dispatch_report_periods rq
              JOIN outreach_canonical
                ON outreach_canonical.suburb = rq.suburb
               AND outreach_canonical.period_key = rq.period_key
              WHERE rq.period_type = 'quarter'
              UNION
              SELECT rq.suburb, rq.period_key, op.id
              FROM dispatch_report_periods rq
              JOIN outreach_properties op
                ON op.suburb = rq.suburb AND op.status IN ('pending', 'sent')
              WHERE rq.period_type = 'month'
              UNION
              SELECT j.suburb, j.period_key, j.pid
              FROM dispatch_junk_periods j
              JOIN dispatch_period_sent ps
                ON ps.suburb = j.suburb
               AND ps.period_key = j.period_key
               AND ps.sent_count > 0
              WHERE j.period_key IS NOT NULL
            ),
            dispatch_audience_periods AS MATERIALIZED (
              SELECT DISTINCT suburb, period_key
              FROM dispatch_audience_props
            ),
            dispatch_audience_counts AS MATERIALIZED (
              SELECT
                aud.suburb,
                aud.period_key,
                COUNT(DISTINCT aud.pid) AS total_count
              FROM dispatch_audience_props aud
              GROUP BY aud.suburb, aud.period_key
            ),
            dispatch_period_aud AS MATERIALIZED (
              SELECT
                aud.suburb,
                aud.period_key,
                COALESCE(cnt.total_count, 0) AS total_count,
                COALESCE(junk.junk_count, 0) AS junk_count
              FROM dispatch_audience_periods aud
              LEFT JOIN dispatch_audience_counts cnt
                ON cnt.suburb = aud.suburb AND cnt.period_key = aud.period_key
              LEFT JOIN dispatch_junk_by_period junk
                ON junk.suburb = aud.suburb AND junk.period_key = aud.period_key
            ),
            dispatch_by_suburb_cte AS (
              SELECT
                rq.suburb,
                COALESCE(s.campaign_key, ms.campaign_key, rq.campaign_key) AS campaign_key,
                rq.period_key,
                COALESCE(s.sent_count, ms.sent_count, 0) AS sent_count,
                COALESCE(a.junk_count, 0) AS junk_count,
                COALESCE(a.total_count, 0) AS total_count,
                COALESCE(s.first_sent_at, ms.first_sent_at) AS first_sent_at,
                COALESCE(s.last_sent_at, ms.last_sent_at) AS last_sent_at
              FROM dispatch_report_periods rq
              LEFT JOIN dispatch_period_aud a
                ON a.suburb = rq.suburb AND a.period_key = rq.period_key
              LEFT JOIN dispatch_quarter_sent s
                ON s.suburb = rq.suburb AND s.q_index = rq.q_index
              LEFT JOIN dispatch_month_sent ms
                ON ms.suburb = rq.suburb AND ms.period_key = rq.period_key
              UNION ALL
              SELECT
                n.suburb,
                n.campaign_key,
                NULL::text AS period_key,
                n.sent_count,
                0::bigint AS junk_count,
                n.sent_count AS total_count,
                n.first_sent_at,
                n.last_sent_at
              FROM dispatch_legacy_sent n
            )
          SELECT
            (SELECT count FROM new_leads_cte) as new_leads,
            (SELECT count FROM high_priority_cte) as high_priority_leads,
            (SELECT pending_count FROM outreach_status_cte) as pending_outreach,
            (SELECT sent_count FROM outreach_status_cte) as sent_outreach,
            (SELECT count FROM today_followups_cte) as today_followups,
            (SELECT count FROM overdue_followups_cte) as overdue_followups,
            (SELECT today_count FROM downloads_summary_cte) as today_downloads,
            (SELECT total_count FROM downloads_summary_cte) as total_downloads,
            (SELECT month_count FROM downloads_summary_cte) as month_downloads,
            (SELECT total_count FROM bookings_summary_cte) as total_bookings,
            (SELECT month_count FROM bookings_summary_cte) as month_bookings,
            (SELECT count FROM qr_codes_cte) as qr_codes_total,
            (SELECT count FROM pdf_reports_cte) as pdf_reports_total,
            (SELECT json_agg(row_to_json(s)) FROM outreach_by_suburb_cte s) as outreach_by_suburb,
            (SELECT json_agg(row_to_json(s)) FROM sent_summary_cte s) as sent_summary_suburbs,
            (SELECT COUNT(*) FROM sent_summary_cte) as sent_summary_suburb_count,
            (SELECT COALESCE(SUM(sent_count), 0) FROM sent_summary_cte) as sent_summary_total_sent,
            (SELECT COALESCE(json_agg(row_to_json(s)), '[]') FROM (SELECT * FROM quarterly_suburb_sent_cte WHERE quarter_key IS NOT NULL) s) as quarterly_suburb_sent,
            (SELECT total_pv FROM scans_summary_cte) as total_scans,
            (SELECT total_uv FROM scans_summary_cte) as total_unique_scans,
            (SELECT total_new_devices FROM scans_summary_cte) as total_new_devices,
            (SELECT json_agg(row_to_json(s)) FROM scans_by_campaign_cte s) as scan_campaigns,
            (SELECT json_agg(row_to_json(s)) FROM downloads_by_suburb_cte s) as downloads_by_suburb,
            (SELECT COALESCE(json_agg(row_to_json(s)), '[]') FROM (SELECT suburb, campaign_key, TO_CHAR(day_bucket, 'YYYY-MM-DD') AS bucket, COUNT(DISTINCT pid)::int AS sent FROM sent_logs_buckets GROUP BY suburb, campaign_key, day_bucket ORDER BY day_bucket) s) as sent_daily,
            (SELECT COALESCE(json_agg(row_to_json(s)), '[]') FROM (
              SELECT suburb, COUNT(DISTINCT pid)::int AS sent_count
              FROM sent_logs_buckets
              WHERE day_bucket = date_trunc('day', CURRENT_TIMESTAMP AT TIME ZONE 'Pacific/Auckland')
                ${suburbFilter ? sql`AND suburb = ${suburb}` : sql``}
              GROUP BY suburb
              ORDER BY sent_count DESC, suburb ASC
            ) s) as today_suburb_sent,
            (SELECT COALESCE(json_agg(row_to_json(s)), '[]') FROM (SELECT suburb, campaign_key, TO_CHAR(week_bucket, 'YYYY-MM-DD') AS bucket, COUNT(DISTINCT pid)::int AS sent FROM sent_logs_buckets GROUP BY suburb, campaign_key, week_bucket ORDER BY week_bucket) s) as sent_weekly,
            (SELECT COALESCE(json_agg(row_to_json(s)), '[]') FROM (SELECT suburb, campaign_key, TO_CHAR(month_bucket, 'YYYY-MM-DD') AS bucket, COUNT(DISTINCT pid)::int AS sent FROM sent_logs_buckets GROUP BY suburb, campaign_key, month_bucket ORDER BY month_bucket) s) as sent_monthly,
            (SELECT COALESCE(json_agg(row_to_json(s)), '[]') FROM (SELECT suburb, campaign_key, TO_CHAR(quarter_bucket, 'YYYY-MM-DD') AS bucket, COUNT(DISTINCT pid)::int AS sent FROM sent_logs_buckets GROUP BY suburb, campaign_key, quarter_bucket ORDER BY quarter_bucket) s) as sent_quarterly,
            (SELECT COALESCE(json_agg(row_to_json(s)), '[]') FROM (SELECT suburb, campaign_key, TO_CHAR(year_bucket, 'YYYY-MM-DD') AS bucket, COUNT(DISTINCT pid)::int AS sent FROM sent_logs_buckets GROUP BY suburb, campaign_key, year_bucket ORDER BY year_bucket) s) as sent_yearly,
            (SELECT COALESCE(json_agg(row_to_json(s)), '[]') FROM (SELECT suburb, campaign_key, TO_CHAR(day_bucket, 'YYYY-MM-DD') AS bucket, COUNT(DISTINCT property_id)::int AS junk FROM junk_props_buckets GROUP BY suburb, campaign_key, day_bucket ORDER BY day_bucket) s) as junk_daily,
            (SELECT COALESCE(json_agg(row_to_json(s)), '[]') FROM (SELECT suburb, campaign_key, TO_CHAR(week_bucket, 'YYYY-MM-DD') AS bucket, COUNT(DISTINCT property_id)::int AS junk FROM junk_props_buckets GROUP BY suburb, campaign_key, week_bucket ORDER BY week_bucket) s) as junk_weekly,
            (SELECT COALESCE(json_agg(row_to_json(s)), '[]') FROM (SELECT suburb, campaign_key, TO_CHAR(month_bucket, 'YYYY-MM-DD') AS bucket, COUNT(DISTINCT property_id)::int AS junk FROM junk_props_buckets GROUP BY suburb, campaign_key, month_bucket ORDER BY month_bucket) s) as junk_monthly,
            (SELECT COALESCE(json_agg(row_to_json(s)), '[]') FROM (SELECT suburb, campaign_key, TO_CHAR(quarter_bucket, 'YYYY-MM-DD') AS bucket, COUNT(DISTINCT property_id)::int AS junk FROM junk_props_buckets GROUP BY suburb, campaign_key, quarter_bucket ORDER BY quarter_bucket) s) as junk_quarterly,
            (SELECT COALESCE(json_agg(row_to_json(s)), '[]') FROM (SELECT suburb, campaign_key, TO_CHAR(year_bucket, 'YYYY-MM-DD') AS bucket, COUNT(DISTINCT property_id)::int AS junk FROM junk_props_buckets GROUP BY suburb, campaign_key, year_bucket ORDER BY year_bucket) s) as junk_yearly,
            (SELECT COALESCE(json_agg(row_to_json(s)), '[]') FROM (
              SELECT d.suburb, d.campaign_key, d.sent_count, COALESCE(d.junk_count, 0) AS junk_count,
                     GREATEST(0, d.total_count - d.sent_count - COALESCE(d.junk_count, 0)) AS unsent_count,
                     d.total_count, d.first_sent_at, d.last_sent_at
              FROM dispatch_by_suburb_cte d
            ) s) as dispatch_by_suburb,
            (SELECT json_agg(row_to_json(r)) FROM recent_downloads_cte r) as recent_downloads,
            (SELECT COALESCE(json_agg(row_to_json(a)), '[]') FROM (
              SELECT id, client_name, email, phone, suburb, property_address, contact_status, created_at
              FROM appraisal_leads
              ORDER BY created_at DESC
              LIMIT 5
            ) a) as recent_appraisals
        `);

        const row = dbResult.rows[0] as Record<string, unknown>;
        const outreachBySuburb = mapOutreachBySuburb(row.outreach_by_suburb);
        const recentAppraisals = mapRecentAppraisals(row.recent_appraisals);

        const reportsResult = await db.execute(sql`
          SELECT suburb, quarter, year, file_url
          FROM suburb_reports
          WHERE status = 'active' AND (doc_label = 'Main Report' OR doc_label IS NULL)
          ORDER BY uploaded_at DESC
        `);

        const reportsMap = buildReportsMap(reportsResult.rows);

        const sentSummary = buildSentSummary(row, outreachBySuburb, reportsMap);

        const scanCampaigns: ScanCampaignItem[] = Array.isArray(row.scan_campaigns) ? (row.scan_campaigns as ScanCampaignRow[]).map((item) => ({
          campaign_key: item?.campaign_key || '',
          campaign_name: (item?.campaign_name || item?.campaign_key || '').replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
          total_pv: Number(item?.total_pv) || 0,
          total_uv: Number(item?.total_uv) || 0,
          new_devices: Number(item?.new_devices) || 0,
        })).sort((a, b) => {
          if (b.new_devices !== a.new_devices) return b.new_devices - a.new_devices;
          if (b.total_pv !== a.total_pv) return b.total_pv - a.total_pv;
          return a.campaign_name.localeCompare(b.campaign_name);
        }) : [];

        const filterRows = (rows: TrendRow[]): TrendRow[] =>
          suburbFilter
            ? rows.filter((r) => r.suburb === suburb || formatReportKey(r.campaign_key || r.suburb, r.suburb) === suburb)
            : rows;

        // Dispatch Volume junk should only reflect the dashboard's target report
        // period (e.g. 2026-Q3), not every junk property from older campaigns.
        const filterJunkRows = (rows: TrendRow[]): TrendRow[] =>
          rows.filter((r) => campaignMatchesPeriod(r.campaign_key, targetQuarterKey));

        const builtDaily = buildTrend(filterRows(toTrendRows(row.sent_daily)), filterJunkRows(filterRows(toTrendRows(row.junk_daily))));
        const builtWeekly = buildTrend(filterRows(toTrendRows(row.sent_weekly)), filterJunkRows(filterRows(toTrendRows(row.junk_weekly))));
        const builtMonthly = buildTrend(filterRows(toTrendRows(row.sent_monthly)), filterJunkRows(filterRows(toTrendRows(row.junk_monthly))));
        const builtQuarterly = buildTrend(filterRows(toTrendRows(row.sent_quarterly)), filterJunkRows(filterRows(toTrendRows(row.junk_quarterly))));
        const builtYearly = buildTrend(filterRows(toTrendRows(row.sent_yearly)), filterJunkRows(filterRows(toTrendRows(row.junk_yearly))));

        const dispatchMap = new Map<string, {
          suburb: string;
          raw_suburb: string;
          quarter_key: string | null;
          report_url: string | null;
          sent_count: number;
          junk_count: number;
          unsent_count: number;
          total_count: number;
          first_sent_at: string | null;
          last_sent_at: string | null;
        }>();

        for (const item of (Array.isArray(row.dispatch_by_suburb) ? row.dispatch_by_suburb as SuburbDispatchRow[] : [])) {
          if (!item?.suburb) continue;
          const sent = Number(item.sent_count) || 0;
          const junk = Number(item.junk_count) || 0;
          const total = Number(item.total_count) || 0;
          const unsent = Number.isFinite(Number(item.unsent_count)) ? Number(item.unsent_count) : Math.max(0, total - sent - junk);
          const periodKey = item.period_key || null;
          const periodCampaignKey = periodKey
            ? (/^[0-9]{4}-[0-9]{2}$/.test(periodKey)
              ? `${periodKey.slice(0, 4)}_M${periodKey.slice(5)}_${item.suburb}`
              : `${periodKey.replace('-Q', '_Q')}_${item.suburb}`)
            : item.campaign_key || item.suburb;
          const reportKey = formatReportKey(periodCampaignKey, item.suburb as string);
          const ckMatch = (item.campaign_key || '').match(/^(\d{4})[_-](Q[1-4]|M[0-9]{2})/i);
          const campaignPeriod = ckMatch
            ? (ckMatch[2].toUpperCase().startsWith('M')
              ? `${ckMatch[1]}-${ckMatch[2].slice(1)}`
              : `${ckMatch[1]}-${ckMatch[2].toUpperCase()}`)
            : null;
          const quarterKey = periodKey || campaignPeriod;
          const reportUrl = quarterKey && /^[0-9]{4}-Q[1-4]$/.test(quarterKey)
            ? reportsMap.get(`${(item.suburb as string).trim().toLowerCase()}|${quarterKey.toUpperCase()}`) || null
            : null;

          const existing = dispatchMap.get(reportKey);
          if (!existing) {
            dispatchMap.set(reportKey, {
              suburb: reportKey,
              raw_suburb: item.suburb as string,
              quarter_key: quarterKey,
              report_url: reportUrl,
              sent_count: sent,
              junk_count: junk,
              unsent_count: unsent,
              total_count: total,
              first_sent_at: item.first_sent_at ? new Date(item.first_sent_at).toISOString() : null,
              last_sent_at: item.last_sent_at ? new Date(item.last_sent_at).toISOString() : null,
            });
          } else {
            existing.sent_count += sent;
            existing.junk_count += junk;
            existing.unsent_count += unsent;
            existing.total_count += total;
            if (!existing.quarter_key && quarterKey) {
              existing.quarter_key = quarterKey;
              existing.report_url = reportUrl;
            }
            if (item.first_sent_at) {
              const d = new Date(item.first_sent_at).toISOString();
              if (!existing.first_sent_at || d < existing.first_sent_at) existing.first_sent_at = d;
            }
            if (item.last_sent_at) {
              const d = new Date(item.last_sent_at).toISOString();
              if (!existing.last_sent_at || d > existing.last_sent_at) existing.last_sent_at = d;
            }
          }
        }

        const dispatchBySuburb: Array<{ suburb: string; quarter_key: string | null; report_url: string | null; sent_count: number; junk_count: number; unsent_count: number; total_count: number; first_sent_at: string | null; last_sent_at: string | null }> =
          Array.from(dispatchMap.values())
            .filter((item) => !suburbFilter || item.suburb === suburb || item.raw_suburb === suburb || item.suburb.toLowerCase().startsWith(suburb.toLowerCase()))
            .sort((a, b) => {
              const ta = a.last_sent_at ? new Date(a.last_sent_at).getTime() : Number.NEGATIVE_INFINITY;
              const tb = b.last_sent_at ? new Date(b.last_sent_at).getTime() : Number.NEGATIVE_INFINITY;
              return tb - ta;
            });

        // Build quarter data structure
        const quarterData: QuarterData = {
          quarterKey: quarterOverview[0]?.quarterKey || '2026-Q2',
          quarter: quarterOverview[0]?.quarter || 'Q2',
          year: quarterOverview[0]?.year || 2026,
          overview: {
            suburbsCount: targetQuarterOverview?.suburbsCount || 0,
            totalProperties: targetQuarterOverview?.totalProperties || 0,
            totalSent: targetQuarterOverview?.totalSent || 0,
            totalUnsent: targetQuarterOverview?.totalUnsent || 0,
            totalPartial: targetQuarterOverview?.totalPartial || 0,
            totalSendEvents: targetQuarterOverview?.totalSendEvents || 0,
          },
          suburbs: suburbDetails,
        };

        // Calculate totals from quarter overviews
        const totalSentAllQuarters = quarterOverview.reduce((sum, q) => sum + q.totalSent, 0);
        const totalPropertiesAllQuarters = quarterOverview.reduce((sum, q) => sum + q.totalProperties, 0);
        const totalUnsentAllQuarters = quarterOverview.reduce((sum, q) => sum + q.totalUnsent, 0);

        return {
          newLeads: Number(row.new_leads) || 0,
          highPriorityLeads: Number(row.high_priority_leads) || 0,
          pendingOutreach: Number(row.pending_outreach) || 0,
          sentOutreach: Number(row.sent_outreach) || 0,
          todayFollowups: Number(row.today_followups) || 0,
          overdueFollowups: Number(row.overdue_followups) || 0,
          todayDownloads: Number(row.today_downloads) || 0,
          totalDownloads: Number(row.total_downloads) || 0,
          monthDownloads: Number(row.month_downloads) || 0,
          totalBookings: Number(row.total_bookings) || 0,
          monthBookings: Number(row.month_bookings) || 0,
          qrCodesTotal: Number(row.qr_codes_total) || 0,
          pdfReportsTotal: Number(row.pdf_reports_total) || 0,
          recentAppraisals,
          outreachBySuburb,
          sentSummary,
          scanStats: {
            total_scans: Number(row.total_scans) || 0,
            total_unique: Number(row.total_unique_scans) || 0,
            total_new_devices: Number(row.total_new_devices) || 0,
            campaigns: scanCampaigns,
          },
          downloadsBySuburb: Array.isArray(row.downloads_by_suburb) ? (row.downloads_by_suburb as SuburbDownloadRow[]).map((item) => ({
            suburb: item?.suburb || 'Unknown',
            download_count: Number(item?.download_count) || 0,
          })) : [],
          recentDownloads: row.recent_downloads || [],
          dispatchTrend: {
            daily: builtDaily.all,
            weekly: builtWeekly.all,
            monthly: builtMonthly.all,
            quarterly: builtQuarterly.all,
            yearly: builtYearly.all,
            seriesBySuburb: {
              daily: builtDaily.bySuburb,
              weekly: builtWeekly.bySuburb,
              monthly: builtMonthly.bySuburb,
              quarterly: builtQuarterly.bySuburb,
              yearly: builtYearly.bySuburb,
            },
            bySuburb: dispatchBySuburb,
          },
          quarterData,
          quarterOverviews: quarterOverview,
          targetQuarterKey,
          totalSentAllQuarters,
          totalPropertiesAllQuarters,
          totalUnsentAllQuarters,
        };
      },
      600
    );

    return NextResponse.json({
      success: true,
      stats: result,
      suburb: suburb || 'all',
      quarterKey: result.targetQuarterKey,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard statistics' },
      { status: 500 }
    );
  }
}
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isAdmin } from '@/lib/permissions';
import { getCachedOrFetch } from '@/lib/redis';
import { db } from '@/lib/drizzle';
import { ensureCampaignTablesExist } from '@/lib/campaign-tracker';
import { formatReportKey } from '@/lib/format-report';
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

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const suburb = searchParams.get('suburb');
  const quarterKey = searchParams.get('quarterKey');
  let targetQuarterKey = quarterKey || '2026-Q2';

  try {
    await ensureCampaignTablesExist();

    const cacheKey = `dashboard:stats:${suburb || 'all'}:${quarterKey || 'all'}`;

    const result = await getCachedOrFetch(
      cacheKey,
      async () => {
        const suburbFilter = suburb && suburb !== 'all';
        const suburbCondition = suburbFilter ? sql`AND suburb = ${suburb}` : sql``;

        // Fetch quarter overview from materialized view (all quarters)
        const quarterOverviewResult = await db.execute(sql`
          SELECT quarter_key, quarter, year, suburbs_count, total_properties, total_sent, total_unsent, total_partial, total_send_events
          FROM mv_quarter_overview
          ORDER BY year DESC, quarter DESC
        `);

        // Determine target quarter
        // Determine target quarter
        targetQuarterKey = quarterKey || (quarterOverviewResult.rows[0] as unknown as QuarterOverviewRow)?.quarter_key || '2026-Q2';

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
            pending_outreach_cte AS (
              SELECT COUNT(*) as count FROM outreach_properties
              WHERE LOWER(status) = 'pending'
              ${suburbCondition}
            ),
            sent_outreach_cte AS (
              SELECT COUNT(*) as count FROM outreach_properties
              WHERE LOWER(status) = 'sent'
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
            today_downloads_cte AS (
              SELECT COUNT(*) as count FROM report_downloads
              WHERE downloaded_at::date = CURRENT_DATE
            ),
            total_downloads_cte AS (
              SELECT COUNT(*) as count FROM report_downloads
            ),
            month_downloads_cte AS (
              SELECT COUNT(*) as count FROM report_downloads
              WHERE downloaded_at >= date_trunc('month', CURRENT_TIMESTAMP)
            ),
            total_bookings_cte AS (
              SELECT COUNT(*) as count FROM appraisal_leads
            ),
            month_bookings_cte AS (
              SELECT COUNT(*) as count FROM appraisal_leads
              WHERE created_at >= date_trunc('month', CURRENT_TIMESTAMP)
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
                COUNT(DISTINCT op.id) FILTER (WHERE LOWER(op.status) IN ('pending', 'sent')) as pending_count,
                COUNT(DISTINCT op.id) FILTER (WHERE LOWER(op.status) = 'sent') as sent_count,
                COUNT(DISTINCT op.id) as total_count,
                MAX(sl.sent_at) AS last_sent_at
              FROM outreach_properties op
              LEFT JOIN outreach_send_logs sl ON sl.outreach_property_id = op.id
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
            sent_logs_buckets AS MATERIALIZED (
              SELECT
                sl.suburb,
                sl.campaign_key,
                date_trunc('day', sl.sent_at AT TIME ZONE 'Pacific/Auckland') AS day_bucket,
                date_trunc('week', sl.sent_at AT TIME ZONE 'Pacific/Auckland') AS week_bucket,
                date_trunc('month', sl.sent_at AT TIME ZONE 'Pacific/Auckland') AS month_bucket,
                date_trunc('quarter', sl.sent_at AT TIME ZONE 'Pacific/Auckland') AS quarter_bucket,
                sl.outreach_property_id
              FROM outreach_send_logs sl
              WHERE sl.sent_at IS NOT NULL
            ),
            dispatched_ids_cte AS MATERIALIZED (
              SELECT DISTINCT outreach_property_id AS id
              FROM outreach_send_logs
            ),
            junk_props_buckets AS MATERIALIZED (
              SELECT
                op.suburb,
                op.campaign AS campaign_key,
                date_trunc('day', (CASE WHEN p.no_junk_mail = TRUE AND p.no_junk_mail_updated_at IS NOT NULL
                                        THEN p.no_junk_mail_updated_at
                                        ELSE op.created_at
                                   END) AT TIME ZONE 'Pacific/Auckland') AS day_bucket,
                date_trunc('week', (CASE WHEN p.no_junk_mail = TRUE AND p.no_junk_mail_updated_at IS NOT NULL
                                         THEN p.no_junk_mail_updated_at
                                         ELSE op.created_at
                                    END) AT TIME ZONE 'Pacific/Auckland') AS week_bucket,
                date_trunc('month', (CASE WHEN p.no_junk_mail = TRUE AND p.no_junk_mail_updated_at IS NOT NULL
                                          THEN p.no_junk_mail_updated_at
                                          ELSE op.created_at
                                     END) AT TIME ZONE 'Pacific/Auckland') AS month_bucket,
                date_trunc('quarter', (CASE WHEN p.no_junk_mail = TRUE AND p.no_junk_mail_updated_at IS NOT NULL
                                            THEN p.no_junk_mail_updated_at
                                            ELSE op.created_at
                                       END) AT TIME ZONE 'Pacific/Auckland') AS quarter_bucket,
                op.id AS property_id
              FROM outreach_properties op
              JOIN properties p ON REPLACE(op.property_id::text, '-', '') = p.id
              LEFT JOIN dispatched_ids_cte d ON d.id = op.id
              WHERE p.no_junk_mail = TRUE
                AND LOWER(op.status) = 'pending'
                AND d.id IS NULL
            ),
            quarterly_suburb_sent_cte AS (
              SELECT
                CASE WHEN sl.campaign_key ~ '^[0-9]{4}[_-]Q[1-4]'
                  THEN substring(sl.campaign_key from '^([0-9]{4})') || '-' || substring(sl.campaign_key from '[_-](Q[1-4])')
                  WHEN sr.quarter IS NOT NULL AND sr.year IS NOT NULL
                  THEN sr.year || '-' || sr.quarter
                END AS quarter_key,
                sl.suburb,
                COUNT(DISTINCT sl.outreach_property_id) AS sent_count,
                MAX(sl.sent_at) AS last_sent_at
              FROM outreach_send_logs sl
              LEFT JOIN suburb_reports sr ON sr.id = sl.suburb_report_id
              WHERE sl.suburb IS NOT NULL
                ${suburbFilter ? sql`AND sl.suburb = ${suburb}` : sql``}
              GROUP BY 1, 2
            ),
            dispatch_report_quarters AS MATERIALIZED (
              SELECT DISTINCT
                sr.suburb,
                (sr.year::int * 4 + (substring(sr.quarter from 'Q([1-4])')::int - 1)) AS q_index,
                (sr.year::text || '_Q' || substring(sr.quarter from 'Q([1-4])') || '_' || sr.suburb) AS campaign_key
              FROM suburb_reports sr
              WHERE sr.status = 'active'
                AND sr.suburb IS NOT NULL
                AND sr.quarter IS NOT NULL
                AND sr.year IS NOT NULL
                ${suburbFilter ? sql`AND sr.suburb = ${suburb}` : sql``}
            ),
            dispatch_send_logs AS MATERIALIZED (
              SELECT
                sl.suburb,
                CASE WHEN sl.campaign_key ~ '^[0-9]{4}[_-]Q[1-4]'
                  THEN substring(sl.campaign_key from '^([0-9]{4})')::int * 4
                       + (substring(sl.campaign_key from '[_-]Q([1-4])')::int - 1)
                END AS q_index,
                sl.outreach_property_id AS pid,
                sl.sent_at,
                sl.campaign_key
              FROM outreach_send_logs sl
              WHERE sl.suburb IS NOT NULL
                ${suburbFilter ? sql`AND sl.suburb = ${suburb}` : sql``}
            ),
            dispatch_quarter_sent AS MATERIALIZED (
              SELECT
                suburb,
                q_index,
                COUNT(DISTINCT pid) AS sent_count,
                MIN(sent_at) AS first_sent_at,
                MAX(sent_at) AS last_sent_at,
                MIN(campaign_key) AS campaign_key
              FROM dispatch_send_logs
              WHERE q_index IS NOT NULL
              GROUP BY suburb, q_index
            ),
            dispatch_audience_props AS MATERIALIZED (
              SELECT rq.suburb, rq.q_index, op.id AS pid
              FROM dispatch_report_quarters rq
              LEFT JOIN dispatch_quarter_sent prev
                ON prev.suburb = rq.suburb AND prev.q_index = rq.q_index - 1
              JOIN outreach_properties op
                ON op.suburb = rq.suburb AND LOWER(op.status) IN ('pending', 'sent')
              WHERE prev.suburb IS NULL
              UNION
              SELECT rq.suburb, rq.q_index, prevq.pid
              FROM dispatch_report_quarters rq
              JOIN dispatch_send_logs prevq
                ON prevq.suburb = rq.suburb AND prevq.q_index = rq.q_index - 1
            ),
            dispatch_quarter_aud AS MATERIALIZED (
              SELECT
                aud.suburb,
                aud.q_index,
                COUNT(DISTINCT aud.pid) AS total_count,
                COUNT(DISTINCT aud.pid) FILTER (
                  WHERE p.no_junk_mail = TRUE
                    AND NOT EXISTS (
                      SELECT 1 FROM dispatch_send_logs sl2
                      WHERE sl2.suburb = aud.suburb
                        AND sl2.q_index = aud.q_index
                        AND sl2.pid = aud.pid
                    )
                ) AS junk_count
              FROM dispatch_audience_props aud
              LEFT JOIN outreach_properties op ON op.id = aud.pid
              LEFT JOIN properties p ON REPLACE(op.property_id::text, '-', '') = p.id
              GROUP BY aud.suburb, aud.q_index
            ),
            dispatch_by_suburb_cte AS (
              SELECT
                rq.suburb,
                COALESCE(s.campaign_key, rq.campaign_key) AS campaign_key,
                COALESCE(s.sent_count, 0) AS sent_count,
                COALESCE(a.junk_count, 0) AS junk_count,
                COALESCE(a.total_count, 0) AS total_count,
                s.first_sent_at,
                s.last_sent_at
              FROM dispatch_report_quarters rq
              LEFT JOIN dispatch_quarter_aud a
                ON a.suburb = rq.suburb AND a.q_index = rq.q_index
              LEFT JOIN dispatch_quarter_sent s
                ON s.suburb = rq.suburb AND s.q_index = rq.q_index
              UNION ALL
              SELECT
                n.suburb,
                n.campaign_key,
                n.sent_count,
                0::bigint AS junk_count,
                n.sent_count AS total_count,
                n.first_sent_at,
                n.last_sent_at
              FROM (
                SELECT
                  suburb,
                  campaign_key,
                  COUNT(DISTINCT pid) AS sent_count,
                  MIN(sent_at) AS first_sent_at,
                  MAX(sent_at) AS last_sent_at
                FROM dispatch_send_logs
                WHERE q_index IS NULL
                GROUP BY suburb, campaign_key
              ) n
            )
          SELECT
            (SELECT count FROM new_leads_cte) as new_leads,
            (SELECT count FROM high_priority_cte) as high_priority_leads,
            (SELECT count FROM pending_outreach_cte) as pending_outreach,
            (SELECT count FROM sent_outreach_cte) as sent_outreach,
            (SELECT count FROM today_followups_cte) as today_followups,
            (SELECT count FROM overdue_followups_cte) as overdue_followups,
            (SELECT count FROM today_downloads_cte) as today_downloads,
            (SELECT count FROM total_downloads_cte) as total_downloads,
            (SELECT count FROM month_downloads_cte) as month_downloads,
            (SELECT count FROM total_bookings_cte) as total_bookings,
            (SELECT count FROM month_bookings_cte) as month_bookings,
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
            (SELECT COALESCE(json_agg(row_to_json(s)), '[]') FROM (SELECT suburb, campaign_key, TO_CHAR(day_bucket, 'YYYY-MM-DD') AS bucket, COUNT(DISTINCT outreach_property_id)::int AS sent FROM sent_logs_buckets GROUP BY suburb, campaign_key, day_bucket ORDER BY day_bucket) s) as sent_daily,
            (SELECT COALESCE(json_agg(row_to_json(s)), '[]') FROM (SELECT suburb, campaign_key, TO_CHAR(week_bucket, 'YYYY-MM-DD') AS bucket, COUNT(DISTINCT outreach_property_id)::int AS sent FROM sent_logs_buckets GROUP BY suburb, campaign_key, week_bucket ORDER BY week_bucket) s) as sent_weekly,
            (SELECT COALESCE(json_agg(row_to_json(s)), '[]') FROM (SELECT suburb, campaign_key, TO_CHAR(month_bucket, 'YYYY-MM-DD') AS bucket, COUNT(DISTINCT outreach_property_id)::int AS sent FROM sent_logs_buckets GROUP BY suburb, campaign_key, month_bucket ORDER BY month_bucket) s) as sent_monthly,
            (SELECT COALESCE(json_agg(row_to_json(s)), '[]') FROM (SELECT suburb, campaign_key, TO_CHAR(quarter_bucket, 'YYYY-MM-DD') AS bucket, COUNT(DISTINCT outreach_property_id)::int AS sent FROM sent_logs_buckets GROUP BY suburb, campaign_key, quarter_bucket ORDER BY quarter_bucket) s) as sent_quarterly,
            (SELECT COALESCE(json_agg(row_to_json(s)), '[]') FROM (SELECT suburb, campaign_key, TO_CHAR(day_bucket, 'YYYY-MM-DD') AS bucket, COUNT(DISTINCT property_id)::int AS junk FROM junk_props_buckets GROUP BY suburb, campaign_key, day_bucket ORDER BY day_bucket) s) as junk_daily,
            (SELECT COALESCE(json_agg(row_to_json(s)), '[]') FROM (SELECT suburb, campaign_key, TO_CHAR(week_bucket, 'YYYY-MM-DD') AS bucket, COUNT(DISTINCT property_id)::int AS junk FROM junk_props_buckets GROUP BY suburb, campaign_key, week_bucket ORDER BY week_bucket) s) as junk_weekly,
            (SELECT COALESCE(json_agg(row_to_json(s)), '[]') FROM (SELECT suburb, campaign_key, TO_CHAR(month_bucket, 'YYYY-MM-DD') AS bucket, COUNT(DISTINCT property_id)::int AS junk FROM junk_props_buckets GROUP BY suburb, campaign_key, month_bucket ORDER BY month_bucket) s) as junk_monthly,
            (SELECT COALESCE(json_agg(row_to_json(s)), '[]') FROM (SELECT suburb, campaign_key, TO_CHAR(quarter_bucket, 'YYYY-MM-DD') AS bucket, COUNT(DISTINCT property_id)::int AS junk FROM junk_props_buckets GROUP BY suburb, campaign_key, quarter_bucket ORDER BY quarter_bucket) s) as junk_quarterly,
            (SELECT COALESCE(json_agg(row_to_json(s)), '[]') FROM (
              SELECT d.suburb, d.campaign_key, d.sent_count, COALESCE(d.junk_count, 0) AS junk_count,
                     GREATEST(0, d.total_count - d.sent_count - COALESCE(d.junk_count, 0)) AS unsent_count,
                     d.total_count, d.first_sent_at, d.last_sent_at
              FROM dispatch_by_suburb_cte d
            ) s) as dispatch_by_suburb,
            (SELECT json_agg(row_to_json(r)) FROM recent_downloads_cte r) as recent_downloads
        `);

        const row = dbResult.rows[0] as Record<string, unknown>;
        const outreachBySuburb: Array<{ suburb: string; pending_count: number; sent_count: number; total_count: number; last_sent_at: string | null }> =
          (Array.isArray(row.outreach_by_suburb) ? row.outreach_by_suburb as OutreachSuburbRow[] : [])
            .map((item) => ({
              suburb: item?.suburb || 'Unknown',
              pending_count: Number(item?.pending_count) || 0,
              sent_count: Number(item?.sent_count) || 0,
              total_count: Number(item?.total_count) || 0,
              last_sent_at: item?.last_sent_at ? new Date(item.last_sent_at).toISOString() : null,
            }));
        const sentSummarySuburbs: SuburbCountRow[] = Array.isArray(row.sent_summary_suburbs) && (row.sent_summary_suburbs as SuburbCountRow[]).length > 0
          ? row.sent_summary_suburbs as SuburbCountRow[]
          : outreachBySuburb.filter((item) => Number(item?.sent_count) > 1);

        const sentSummary: SentSummaryItem[] = sentSummarySuburbs.map((item) => ({
          suburb: item?.suburb || 'Unknown',
          sent_count: Number(item?.sent_count) || 0,
        }));

        const reportsResult = await db.execute(sql`
          SELECT suburb, quarter, year, file_url
          FROM suburb_reports
          WHERE status = 'active' AND (doc_label = 'Main Report' OR doc_label IS NULL)
          ORDER BY uploaded_at DESC
        `);

        const reportsMap = new Map<string, string>();
        for (const r of (Array.isArray(reportsResult.rows) ? reportsResult.rows as unknown as ActiveReportRow[] : [])) {
          if (!r.suburb || !r.quarter || r.year == null) continue;
          const key = `${r.suburb.trim().toLowerCase()}|${r.year}-${r.quarter.toUpperCase()}`;
          if (!reportsMap.has(key)) reportsMap.set(key, r.file_url || '');
        }

        const quarterlyMap = new Map<string, QuarterlySentSuburb[]>();
        for (const item of (Array.isArray(row.quarterly_suburb_sent) ? row.quarterly_suburb_sent as QuarterlySuburbSentRow[] : [])) {
          if (!item.quarter_key || !item.suburb) continue;
          const reportUrl = reportsMap.get(`${item.suburb.trim().toLowerCase()}|${item.quarter_key.toUpperCase()}`) || null;
          let arr = quarterlyMap.get(item.quarter_key);
          if (!arr) { arr = []; quarterlyMap.set(item.quarter_key, arr); }
          arr.push({
            suburb: item.suburb,
            sent_count: Number(item.sent_count) || 0,
            last_sent_at: item.last_sent_at ? new Date(item.last_sent_at).toISOString() : null,
            report_url: reportUrl,
          });
        }

        const quarterlySentSummaries: QuarterlySentSummary[] = Array.from(quarterlyMap.entries())
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
          .sort((a, b) => b.quarter_key.localeCompare(a.quarter_key));

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

        const builtDaily = buildTrend(filterRows(toTrendRows(row.sent_daily)), filterRows(toTrendRows(row.junk_daily)));
        const builtWeekly = buildTrend(filterRows(toTrendRows(row.sent_weekly)), filterRows(toTrendRows(row.junk_weekly)));
        const builtMonthly = buildTrend(filterRows(toTrendRows(row.sent_monthly)), filterRows(toTrendRows(row.junk_monthly)));
        const builtQuarterly = buildTrend(filterRows(toTrendRows(row.sent_quarterly)), filterRows(toTrendRows(row.junk_quarterly)));

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
          const reportKey = formatReportKey(item.campaign_key || item.suburb, item.suburb as string);
          const ckMatch = (item.campaign_key || '').match(/^(\d{4})[_-](Q[1-4])/i);
          const quarterKey = ckMatch ? `${ckMatch[1]}-${ckMatch[2].toUpperCase()}` : null;
          const reportUrl = quarterKey ? reportsMap.get(`${(item.suburb as string).trim().toLowerCase()}|${quarterKey.toUpperCase()}`) || null : null;

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
          outreachBySuburb,
          sentSummary: {
            total_sent: quarterlySentSummaries.length > 0
              ? quarterlySentSummaries.reduce((sum, q) => sum + q.total_sent, 0)
              : Number(row.sent_summary_total_sent) || sentSummary.reduce((sum: number, item) => sum + Number(item.sent_count || 0), 0),
            suburb_count: Number(row.sent_summary_suburb_count) || sentSummary.length,
            suburbs: sentSummary,
            quarterly: quarterlySentSummaries,
          },
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
            seriesBySuburb: {
              daily: builtDaily.bySuburb,
              weekly: builtWeekly.bySuburb,
              monthly: builtMonthly.bySuburb,
              quarterly: builtQuarterly.bySuburb,
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
      quarterKey: targetQuarterKey,
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
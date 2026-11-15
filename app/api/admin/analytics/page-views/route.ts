import { NextResponse } from 'next/server';
import { getMarketReportAdminEmail } from '@/lib/market-report-access';
import { query } from '@/lib/db';
import type { PageViewAnalytics, PageViewPeriods, PageViewReport } from '@/lib/page-view-analytics';

export const dynamic = 'force-dynamic';

interface PeriodCountRow {
  total: string | number;
  week: string | number;
  month: string | number;
  year: string | number;
}

interface SummaryRow extends PeriodCountRow {
  page_type: 'home' | 'market_report';
}

interface ReportRow extends PeriodCountRow {
  id: string;
  period_type: 'monthly' | 'quarterly';
  period_key: string;
  language: 'en' | 'zh';
  status: 'draft' | 'published' | 'withdrawn';
}

function counts(row?: PeriodCountRow): PageViewPeriods {
  return {
    total: Number(row?.total ?? 0),
    week: Number(row?.week ?? 0),
    month: Number(row?.month ?? 0),
    year: Number(row?.year ?? 0),
  };
}

const periodBounds = `
  WITH bounds AS (
    SELECT
      date_trunc('week', NOW() AT TIME ZONE 'Pacific/Auckland')
        AT TIME ZONE 'Pacific/Auckland' AS week_start,
      date_trunc('month', NOW() AT TIME ZONE 'Pacific/Auckland')
        AT TIME ZONE 'Pacific/Auckland' AS month_start,
      date_trunc('year', NOW() AT TIME ZONE 'Pacific/Auckland')
        AT TIME ZONE 'Pacific/Auckland' AS year_start
  )
`;

const periodCountSelect = `
  COUNT(e.id) AS total,
  COUNT(e.id) FILTER (WHERE e.created_at >= b.week_start) AS week,
  COUNT(e.id) FILTER (WHERE e.created_at >= b.month_start) AS month,
  COUNT(e.id) FILTER (WHERE e.created_at >= b.year_start) AS year
`;

export async function GET() {
  try {
    const email = await getMarketReportAdminEmail();
    if (!email) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    const [summaryResult, reportsResult] = await Promise.all([
      query<SummaryRow>(
        `${periodBounds}
         SELECT types.page_type, ${periodCountSelect}
         FROM (VALUES ('home'::varchar), ('market_report'::varchar)) AS types(page_type)
         CROSS JOIN bounds b
         LEFT JOIN page_view_events e ON e.page_type = types.page_type
         GROUP BY types.page_type`,
      ),
      query<ReportRow>(
        `${periodBounds}
         SELECT r.id, r.period_type, r.period_key, r.language, r.status, ${periodCountSelect}
         FROM north_shore_market_reports r
         CROSS JOIN bounds b
         LEFT JOIN page_view_events e ON e.report_id = r.id
         GROUP BY r.id
         ORDER BY r.period_key DESC, r.period_type ASC, r.language ASC`,
      ),
    ]);

    const rowsByType = new Map(summaryResult.rows.map((row) => [row.page_type, row]));
    const data: PageViewAnalytics = {
      home: counts(rowsByType.get('home')),
      market: counts(rowsByType.get('market_report')),
      reports: reportsResult.rows.map((row): PageViewReport => ({
        id: row.id,
        period_type: row.period_type,
        period_key: row.period_key,
        language: row.language,
        status: row.status,
        views: counts(row),
      })),
    };

    return NextResponse.json({ success: true, data }, {
      headers: { 'Cache-Control': 'private, max-age=30' },
    });
  } catch (error) {
    console.error('Failed to load page-view analytics:', error);
    return NextResponse.json({ success: false, error: 'Failed to load page-view analytics.' }, { status: 500 });
  }
}

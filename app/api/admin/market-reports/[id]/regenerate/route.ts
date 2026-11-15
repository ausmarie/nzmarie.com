import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAnalyticsDistrictDataNames } from '@/lib/analytics-districts';
import {
  buildMarketReportSnapshot,
  getMarketReportWindow,
  MARKET_REPORT_AUCKLAND_REGION,
  MARKET_REPORT_NORTH_SHORE_REGION,
  type MarketReportDataRange,
  type MarketReportPeriodType,
  type MarketReportSourceRow,
} from '@/lib/market-report-data';
import { refreshMarketReportGeneratedBlocks } from '@/lib/market-report-document';
import { getMarketReportAdminEmail, isUuid } from '@/lib/market-report-access';
import type { ReportEditorContent } from '@/types/report';

export const dynamic = 'force-dynamic';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const email = await getMarketReportAdminEmail();
  if (!email) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ success: false, error: 'Invalid report id.' }, { status: 400 });

  try {
    const reportResult = await query<{
      period_type: MarketReportPeriodType;
      period_key: string;
      data_snapshot: {
        chartPeriodType?: MarketReportPeriodType;
        dataRange?: MarketReportDataRange;
      } | null;
      content: ReportEditorContent | null;
    }>(
      `SELECT period_type, period_key, data_snapshot, content
       FROM north_shore_market_reports
       WHERE id = $1`,
      [id]
    );
    const report = reportResult.rows[0];
    if (!report) return NextResponse.json({ success: false, error: 'Report not found.' }, { status: 404 });

    const chartPeriodType = report.data_snapshot?.chartPeriodType ?? report.period_type;
    const dataRange = report.data_snapshot?.dataRange;
    const window = getMarketReportWindow(report.period_type, report.period_key, chartPeriodType, dataRange);
    const source = await query<MarketReportSourceRow>(
      `SELECT region_name, period_month::text, median_price, sales_count, days_to_sell
       FROM market_monthly_snapshots
       WHERE (region_name = ANY($1::text[]) OR region_name = ANY($2::text[]))
         AND property_type = $3
         AND period_month >= $4::date
         AND period_month < $5::date
       ORDER BY period_month`,
      [[MARKET_REPORT_NORTH_SHORE_REGION], getAnalyticsDistrictDataNames(MARKET_REPORT_AUCKLAND_REGION), 'House', window.from, window.to]
    );
    const snapshot = buildMarketReportSnapshot(report.period_type, report.period_key, source.rows, undefined, {
      chartPeriodType,
      dataRange: window,
    });
    const content = refreshMarketReportGeneratedBlocks(
      Array.isArray(report.content) ? report.content : [],
      snapshot,
    );
    const updated = await query(
      `UPDATE north_shore_market_reports
       SET data_snapshot = $2::jsonb,
           content = $3::jsonb,
           has_unpublished_changes = CASE WHEN status = 'draft' THEN FALSE ELSE TRUE END,
           updated_by = $4,
           updated_at = NOW()
       WHERE id = $1
       RETURNING updated_at, status, has_unpublished_changes`,
      [id, JSON.stringify(snapshot), JSON.stringify(content), email]
    );
    return NextResponse.json({ success: true, snapshot, content, ...updated.rows[0] });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('No North Shore house market data')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 422 });
    }
    console.error('Failed to regenerate Market report data:', error);
    return NextResponse.json({ success: false, error: 'Failed to regenerate Market report data.' }, { status: 500 });
  }
}

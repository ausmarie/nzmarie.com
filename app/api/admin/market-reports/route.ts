import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAnalyticsDistrictDataNames } from '@/lib/analytics-districts';
import {
  buildMarketReportSnapshot,
  getMarketReportWindow,
  isMarketReportPeriodType,
  isValidMarketReportPeriod,
  MARKET_REPORT_AUCKLAND_REGION,
  MARKET_REPORT_NORTH_SHORE_REGION,
  type MarketReportSourceRow,
} from '@/lib/market-report-data';
import {
  buildMarketReportRichTextContent,
  refreshMarketReportGeneratedBlocks,
} from '@/lib/market-report-document';
import { getMarketReportAdminEmail } from '@/lib/market-report-access';
import type { ReportEditorContent } from '@/types/report';

export const dynamic = 'force-dynamic';

interface ExistingMarketReport {
  id: string;
  title: string;
  content: ReportEditorContent | null;
}

async function refreshExistingReport(
  existing: ExistingMarketReport,
  requestedTitle: string,
  defaultTitle: string,
  snapshot: ReturnType<typeof buildMarketReportSnapshot>,
  email: string,
): Promise<NextResponse> {
  const title = requestedTitle === defaultTitle ? existing.title : requestedTitle;
  const content = refreshMarketReportGeneratedBlocks(
    Array.isArray(existing.content) ? existing.content : [],
    snapshot,
  );
  const updated = await query<{ id: string }>(
    `UPDATE north_shore_market_reports
     SET title = $2,
         content = $3::jsonb,
         data_snapshot = $4::jsonb,
         has_unpublished_changes = CASE WHEN status = 'draft' THEN FALSE ELSE TRUE END,
         updated_by = $5,
         updated_at = NOW()
     WHERE id = $1
     RETURNING id`,
    [existing.id, title, JSON.stringify(content), JSON.stringify(snapshot), email]
  );
  if (!updated.rows[0]) {
    return NextResponse.json({ success: false, error: 'The existing report was removed. Please try again.' }, { status: 409 });
  }
  return NextResponse.json({ success: true, id: existing.id, snapshot, reused: true });
}

export async function GET() {
  const email = await getMarketReportAdminEmail();
  if (!email) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const [result, available] = await Promise.all([
      query(
      `SELECT id, period_type, period_key, title, summary, status,
              has_unpublished_changes, published_at, withdrawn_at, updated_at
       FROM north_shore_market_reports
       ORDER BY period_key DESC, period_type ASC`
      ),
      query<{ period: string | null } & Record<string, unknown>>(
        `SELECT to_char(MAX(period_month), 'YYYY-MM') AS period
         FROM market_monthly_snapshots
         WHERE region_name = $1 AND property_type = $2`,
        ['North Shore City', 'House']
      ),
    ]);
    return NextResponse.json({
      success: true,
      reports: result.rows,
      latestAvailableMonth: available.rows[0]?.period ?? null,
    });
  } catch (error) {
    console.error('Failed to list Market reports:', error);
    return NextResponse.json({ success: false, error: 'Failed to load Market reports.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const email = await getMarketReportAdminEmail();
  if (!email) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, error: 'A valid JSON request body is required.' }, { status: 400 });
  }

  const periodType = body.periodType;
  const periodKey = typeof body.periodKey === 'string' ? body.periodKey : '';
  if (!isMarketReportPeriodType(periodType) || !isValidMarketReportPeriod(periodType, periodKey)) {
    return NextResponse.json({ success: false, error: 'Select a valid month or quarter.' }, { status: 400 });
  }
  const chartPeriodType = body.chartPeriodType === undefined ? periodType : body.chartPeriodType;
  if (!isMarketReportPeriodType(chartPeriodType)) {
    return NextResponse.json({ success: false, error: 'Select a valid line chart period.' }, { status: 400 });
  }
  const startPeriodKey = typeof body.dataStartKey === 'string' ? body.dataStartKey : undefined;
  const endPeriodKey = typeof body.dataEndKey === 'string' ? body.dataEndKey : undefined;
  if ((startPeriodKey && !endPeriodKey) || (!startPeriodKey && endPeriodKey)) {
    return NextResponse.json({ success: false, error: 'Select both the start and end of the data range.' }, { status: 400 });
  }
  const requestedTitle = typeof body.title === 'string' ? body.title.trim() : '';
  if (typeof body.title === 'string' && (!requestedTitle || requestedTitle.length > 160)) {
    return NextResponse.json({ success: false, error: 'Report name must be between 1 and 160 characters.' }, { status: 400 });
  }

  try {
    const window = getMarketReportWindow(
      periodType,
      periodKey,
      chartPeriodType,
      startPeriodKey && endPeriodKey ? { startPeriodKey, endPeriodKey } : undefined,
    );
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
    const snapshot = buildMarketReportSnapshot(periodType, periodKey, source.rows, undefined, {
      chartPeriodType,
      dataRange: window,
    });
    const defaultTitle = `North Shore Property Market Report — ${snapshot.periodLabel}`;
    const title = requestedTitle || defaultTitle;
    const existingResult = await query<ExistingMarketReport>(
      `SELECT id, title, content
       FROM north_shore_market_reports
       WHERE period_type = $1 AND period_key = $2`,
      [periodType, periodKey]
    );
    const existing = existingResult.rows[0];
    if (existing) {
      return refreshExistingReport(existing, title, defaultTitle, snapshot, email);
    }

    const content = buildMarketReportRichTextContent(snapshot);
    const result = await query<{ id: string }>(
      `INSERT INTO north_shore_market_reports
         (period_type, period_key, title, summary, content, data_snapshot, created_by, updated_by)
       VALUES ($1, $2, $3, '', $4::jsonb, $5::jsonb, $6, $6)
       ON CONFLICT (period_type, period_key) DO NOTHING
       RETURNING id`,
      [periodType, periodKey, title, JSON.stringify(content), JSON.stringify(snapshot), email]
    );

    if (result.rows[0]) {
      return NextResponse.json({ success: true, id: result.rows[0].id, snapshot }, { status: 201 });
    }

    const racedReportResult = await query<ExistingMarketReport>(
      `SELECT id, title, content
       FROM north_shore_market_reports
       WHERE period_type = $1 AND period_key = $2`,
      [periodType, periodKey]
    );
    const racedReport = racedReportResult.rows[0];
    if (racedReport) {
      return refreshExistingReport(racedReport, title, defaultTitle, snapshot, email);
    }
    return NextResponse.json({ success: false, error: 'The report changed while generating. Please try again.' }, { status: 409 });
  } catch (error) {
    if (error instanceof Error && (
      error.message.startsWith('Invalid') ||
      error.message.startsWith('Monthly') ||
      error.message.startsWith('Quarterly') ||
      error.message.startsWith('The data range') ||
      error.message.startsWith('The chart data range')
    )) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    if (error instanceof Error && error.message.startsWith('No North Shore house market data')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 422 });
    }
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      return NextResponse.json({ success: false, error: 'A report already exists for this period.' }, { status: 409 });
    }
    console.error('Failed to create Market report:', error);
    return NextResponse.json({ success: false, error: 'Failed to generate the Market report.' }, { status: 500 });
  }
}

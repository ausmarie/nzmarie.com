import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getMarketReportAdminEmail, isUuid } from '@/lib/market-report-access';
import { revalidateMarketReportHomePages, revalidatePublishedMarketReport } from '@/lib/market-report-cache';
import type { MarketReportLanguage, MarketReportPeriodType } from '@/lib/market-report-data';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const email = await getMarketReportAdminEmail();
  if (!email) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ success: false, error: 'Invalid report id.' }, { status: 400 });

  try {
    const result = await query(`SELECT * FROM north_shore_market_reports WHERE id = $1`, [id]);
    if (result.rows.length === 0) return NextResponse.json({ success: false, error: 'Report not found.' }, { status: 404 });
    return NextResponse.json({ success: true, report: result.rows[0] });
  } catch (error) {
    console.error('Failed to load Market report:', error);
    return NextResponse.json({ success: false, error: 'Failed to load Market report.' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: RouteContext) {
  const email = await getMarketReportAdminEmail();
  if (!email) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ success: false, error: 'Invalid report id.' }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, error: 'A valid JSON request body is required.' }, { status: 400 });
  }

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const summary = typeof body.summary === 'string' ? body.summary.trim() : '';
  const content = body.content;
  const footer = body.footer === undefined
    ? null
    : typeof body.footer === 'string'
      ? body.footer
      : null;
  if (!title || title.length > 255) {
    return NextResponse.json({ success: false, error: 'Title is required and must be 255 characters or fewer.' }, { status: 400 });
  }
  if (summary.length > 4000) {
    return NextResponse.json({ success: false, error: 'Summary must be 4,000 characters or fewer.' }, { status: 400 });
  }
  if (body.footer !== undefined && typeof body.footer !== 'string') {
    return NextResponse.json({ success: false, error: 'Footer must be text.' }, { status: 400 });
  }
  if (footer !== null && footer.length > 4000) {
    return NextResponse.json({ success: false, error: 'Footer must be 4,000 characters or fewer.' }, { status: 400 });
  }
  if (!Array.isArray(content)) {
    return NextResponse.json({ success: false, error: 'Report content must be a rich-text block array.' }, { status: 400 });
  }

  try {
    const result = await query<{
      updated_at: string | Date;
      status: string;
      has_unpublished_changes: boolean;
    }>(
      `UPDATE north_shore_market_reports
       SET title = $2,
           summary = $3,
           content = $4::jsonb,
           footer = COALESCE($5, footer),
           has_unpublished_changes = CASE WHEN status = 'draft' THEN FALSE ELSE TRUE END,
           updated_by = $6,
           updated_at = NOW()
       WHERE id = $1
       RETURNING updated_at, status, has_unpublished_changes`,
      [id, title, summary, JSON.stringify(content), footer, email]
    );
    if (result.rows.length === 0) return NextResponse.json({ success: false, error: 'Report not found.' }, { status: 404 });
    return NextResponse.json({ success: true, ...result.rows[0] });
  } catch (error) {
    console.error('Failed to save Market report:', error);
    return NextResponse.json({ success: false, error: 'Failed to save Market report.' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const email = await getMarketReportAdminEmail();
  if (!email) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ success: false, error: 'Invalid report id.' }, { status: 400 });

  try {
    const result = await query<{
      id: string;
      period_type: MarketReportPeriodType;
      period_key: string;
      language: MarketReportLanguage;
    }>(
      `DELETE FROM north_shore_market_reports
       WHERE id = $1
       RETURNING id, period_type, period_key, language`,
      [id]
    );
    if (result.rows.length === 0) return NextResponse.json({ success: false, error: 'Report not found.' }, { status: 404 });
    revalidatePublishedMarketReport(result.rows[0]);
    revalidateMarketReportHomePages();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete Market report:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete Market report.' }, { status: 500 });
  }
}

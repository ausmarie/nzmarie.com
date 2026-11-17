import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getMarketReportAdminEmail, isUuid } from '@/lib/market-report-access';
import { revalidateMarketReportHomePages, revalidatePublishedMarketReport } from '@/lib/market-report-cache';
import type { MarketReportLanguage, MarketReportPeriodType } from '@/lib/market-report-data';

export const dynamic = 'force-dynamic';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
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
      status: string;
      withdrawn_at: string | Date;
      updated_at: string | Date;
    }>(
      `UPDATE north_shore_market_reports
       SET status = 'withdrawn',
           withdrawn_at = NOW(),
           updated_by = $2,
           updated_at = NOW()
       WHERE id = $1 AND status = 'published'
       RETURNING id, period_type, period_key, language, status, withdrawn_at, updated_at`,
      [id, email]
    );
    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Only a published report can be withdrawn.' }, { status: 409 });
    }
    revalidatePublishedMarketReport(result.rows[0]);
    revalidateMarketReportHomePages();
    return NextResponse.json({ success: true, ...result.rows[0] });
  } catch (error) {
    console.error('Failed to withdraw Market report:', error);
    return NextResponse.json({ success: false, error: 'Failed to withdraw Market report.' }, { status: 500 });
  }
}

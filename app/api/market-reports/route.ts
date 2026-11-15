import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { isMarketReportLanguage } from '@/lib/market-report-data';

export const dynamic = 'force-dynamic';

interface PublicMarketReport {
  id: string;
  language: 'en' | 'zh';
  period_type: 'monthly' | 'quarterly';
  period_key: string;
  title: string;
  summary: string;
  content: unknown[];
  data_snapshot: unknown;
  published_at: string | null;
  status: 'published' | 'withdrawn';
}

function periodOrder(report: Pick<PublicMarketReport, 'period_type' | 'period_key'>): number {
  const [yearText, periodText] = report.period_key.split(report.period_type === 'monthly' ? '-' : '-Q');
  const year = Number(yearText);
  const period = Number(periodText);
  return report.period_type === 'monthly'
    ? year * 12 + period
    : year * 12 + period * 3;
}

function comparePeriods(a: PublicMarketReport, b: PublicMarketReport): number {
  const difference = periodOrder(b) - periodOrder(a);
  if (difference !== 0) return difference;
  if (a.period_type === b.period_type) return 0;
  return a.period_type === 'monthly' ? -1 : 1;
}

export async function GET(request: Request) {
  const requestedLanguage = new URL(request.url).searchParams.get('lang') ?? 'en';
  if (!isMarketReportLanguage(requestedLanguage)) {
    return NextResponse.json({ success: false, error: 'Select a valid report language.' }, { status: 400 });
  }
  try {
    const result = await query<PublicMarketReport & Record<string, unknown>>(
      `SELECT id, period_type, period_key, language, status,
              published_title AS title,
              published_summary AS summary,
              published_content AS content,
              published_data_snapshot AS data_snapshot,
              published_at
       FROM north_shore_market_reports
       WHERE status IN ('published', 'withdrawn') AND language = $1
       ORDER BY period_key DESC`,
      [requestedLanguage]
    );
    const rows = result.rows
      .filter((report) => report.status === 'published' || report.status === 'withdrawn')
      .sort(comparePeriods);
    const published = rows.filter((report) => report.status === 'published');
    const newest = rows[0] ?? null;
    const newestWithdrawn = newest?.status === 'withdrawn';
    const latest = newest && !newestWithdrawn ? newest : null;

    return NextResponse.json({
      success: true,
      latest,
      previousReports: published.filter((report) => report.id !== latest?.id),
      notice: newestWithdrawn || !latest
        ? {
            reason: newestWithdrawn ? 'withdrawn' : 'preparing',
            en: 'Marie is preparing the latest North Shore market report. Please check back soon.',
            zh: 'Marie 正在整理最新的北岸市场数据与趋势解读。新一期报告准备好后会在这里发布，欢迎稍后再来查看。',
          }
        : null,
    });
  } catch (error) {
    console.error('Failed to load public Market reports:', error);
    return NextResponse.json({ success: false, error: 'Market reports are temporarily unavailable.' }, { status: 500 });
  }
}

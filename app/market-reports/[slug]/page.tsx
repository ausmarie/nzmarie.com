import { notFound } from 'next/navigation';
import MarketReportArticle from '@/components/market/MarketReportArticle';
import { query } from '@/lib/db';
import { parseMarketReportSlug } from '@/lib/market-report-url';
import type { MarketReportSnapshot } from '@/lib/market-report-data';
import type { ReportEditorContent } from '@/types/report';

export const dynamic = 'force-dynamic';

export default async function PublishedMarketReportPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const period = parseMarketReportSlug(slug);
  if (!period) notFound();

  const result = await query(
    `SELECT published_content, published_footer, published_data_snapshot
     FROM north_shore_market_reports
     WHERE period_type = $1 AND period_key = $2 AND status = 'published'
     LIMIT 1`,
    [period.periodType, period.periodKey],
  );
  const report = result.rows[0];
  if (!report) notFound();

  return (
    <MarketReportArticle
      report={{
        content: Array.isArray(report.published_content)
          ? report.published_content as ReportEditorContent
          : [],
        footer: typeof report.published_footer === 'string' ? report.published_footer : null,
        dataSnapshot: report.published_data_snapshot as MarketReportSnapshot,
      }}
    />
  );
}

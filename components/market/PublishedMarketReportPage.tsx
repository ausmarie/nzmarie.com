import { notFound } from 'next/navigation';
import MarketReportArticle from '@/components/market/MarketReportArticle';
import { query } from '@/lib/db';
import { parseMarketReportSlug } from '@/lib/market-report-url';
import type { MarketReportLanguage, MarketReportSnapshot } from '@/lib/market-report-data';
import type { ReportEditorContent } from '@/types/report';

export default async function PublishedMarketReportPage({
  slug,
  language,
}: {
  slug: string;
  language: MarketReportLanguage;
}) {
  const period = parseMarketReportSlug(slug);
  if (!period) notFound();

  const result = await query(
    `SELECT published_content, published_footer, published_data_snapshot
     FROM north_shore_market_reports
     WHERE period_type = $1 AND period_key = $2 AND status = 'published'
       AND language = $3
     LIMIT 1`,
    [period.periodType, period.periodKey, language],
  );
  const report = result.rows[0];
  if (!report) notFound();

  return (
    <MarketReportArticle
      report={{
        language,
        content: Array.isArray(report.published_content)
          ? report.published_content as ReportEditorContent
          : [],
        footer: typeof report.published_footer === 'string' ? report.published_footer : null,
        dataSnapshot: report.published_data_snapshot as MarketReportSnapshot,
      }}
    />
  );
}

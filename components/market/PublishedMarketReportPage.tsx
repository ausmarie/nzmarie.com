import { notFound } from 'next/navigation';
import MarketReportArticle from '@/components/market/MarketReportArticle';
import PageViewTracker from '@/components/PageViewTracker';
import { parseMarketReportSlug } from '@/lib/market-report-url';
import type { MarketReportLanguage } from '@/lib/market-report-data';
import { getPublishedMarketReport } from '@/lib/market-report-public-cache';

export default async function PublishedMarketReportPage({
  slug,
  language,
}: {
  slug: string;
  language: MarketReportLanguage;
}) {
  const period = parseMarketReportSlug(slug);
  if (!period) notFound();

  const report = await getPublishedMarketReport(slug, language);
  if (!report || !report.published_data_snapshot) notFound();

  return (
    <>
      <PageViewTracker pageType="market_report" language={language} slug={slug} />
      <MarketReportArticle
        report={{
          language,
          content: Array.isArray(report.published_content) ? report.published_content : [],
          footer: typeof report.published_footer === 'string' ? report.published_footer : null,
          dataSnapshot: report.published_data_snapshot,
          publishedAt: typeof report.published_at === 'string' || report.published_at instanceof Date
            ? report.published_at
            : null,
        }}
      />
    </>
  );
}

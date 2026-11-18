import { notFound, redirect } from 'next/navigation';
import MarketReportArticle from '@/components/market/MarketReportArticle';
import { getMarketReportAdminEmail } from '@/lib/market-report-access';
import { parseMarketReportLanguage, parseMarketReportSlug } from '@/lib/market-report-url';
import { query } from '@/lib/db';
import type { MarketReportSnapshot } from '@/lib/market-report-data';
import type { ReportEditorContent } from '@/types/report';

export const dynamic = 'force-dynamic';

export default async function MarketReportPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ lang?: string | string[] }>;
}) {
  const email = await getMarketReportAdminEmail();
  if (!email) redirect('/admin/login');

  const { id: slug } = await params;
  const search = await searchParams;
  const language = parseMarketReportLanguage(search?.lang);
  const period = parseMarketReportSlug(slug);
  if (!period || !language) notFound();

  const result = await query(
    `SELECT content, article_header, footer, data_snapshot, published_at
     FROM north_shore_market_reports
     WHERE period_type = $1 AND period_key = $2 AND language = $3`,
    [period.periodType, period.periodKey, language]
  );
  const report = result.rows[0];
  if (!report) notFound();

  return (
    <MarketReportArticle
      preview
      report={{
        language,
        content: Array.isArray(report.content) ? report.content as ReportEditorContent : [],
        articleHeader: report.article_header,
        footer: typeof report.footer === 'string' ? report.footer : null,
        dataSnapshot: report.data_snapshot as MarketReportSnapshot,
      }}
    />
  );
}

import { notFound, redirect } from 'next/navigation';
import MarketReportArticle from '@/components/market/MarketReportArticle';
import { getMarketReportAdminEmail } from '@/lib/market-report-access';
import type { MarketReportSnapshot } from '@/lib/market-report-data';
import { parseMarketReportSlug } from '@/lib/market-report-url';
import { query } from '@/lib/db';
import type { ReportEditorContent } from '@/types/report';

export const dynamic = 'force-dynamic';

export default async function AdminMarketReportDraftPreviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const email = await getMarketReportAdminEmail();
  if (!email) redirect('/admin/login');

  const { slug } = await params;
  const period = parseMarketReportSlug(slug);
  if (!period) notFound();

  const result = await query(
    `SELECT content, footer, data_snapshot
     FROM north_shore_market_reports
     WHERE period_type = $1 AND period_key = $2`,
    [period.periodType, period.periodKey],
  );
  const report = result.rows[0];
  if (!report) notFound();

  return (
    <MarketReportArticle
      preview
      report={{
        content: Array.isArray(report.content) ? report.content as ReportEditorContent : [],
        footer: typeof report.footer === 'string' ? report.footer : null,
        dataSnapshot: report.data_snapshot as MarketReportSnapshot,
      }}
    />
  );
}

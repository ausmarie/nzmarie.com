import { notFound, redirect } from 'next/navigation';
import MarketReportArticle from '@/components/market/MarketReportArticle';
import { getMarketReportAdminEmail, isUuid } from '@/lib/market-report-access';
import { query } from '@/lib/db';
import type { MarketReportSnapshot } from '@/lib/market-report-data';
import type { ReportEditorContent } from '@/types/report';

export const dynamic = 'force-dynamic';

export default async function MarketReportPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const email = await getMarketReportAdminEmail();
  if (!email) redirect('/admin/login');

  const { id } = await params;
  if (!isUuid(id)) notFound();

  const result = await query(
    `SELECT title, summary, content, data_snapshot, published_at
     FROM north_shore_market_reports
     WHERE id = $1`,
    [id]
  );
  const report = result.rows[0];
  if (!report) notFound();

  return (
    <MarketReportArticle
      preview
      report={{
        title: String(report.title),
        summary: String(report.summary || ''),
        content: Array.isArray(report.content) ? report.content as ReportEditorContent : [],
        dataSnapshot: report.data_snapshot as MarketReportSnapshot,
        publishedAt: null,
      }}
    />
  );
}

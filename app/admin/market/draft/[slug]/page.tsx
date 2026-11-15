import { notFound, redirect } from 'next/navigation';
import MarketAdminPage from '@/components/market/MarketAdminPage';
import { getMarketReportAdminEmail } from '@/lib/market-report-access';
import { parseMarketReportSlug } from '@/lib/market-report-url';

export default async function AdminMarketReportDraftPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const email = await getMarketReportAdminEmail();
  if (!email) redirect('/admin/login');

  const { slug } = await params;
  if (!parseMarketReportSlug(slug)) notFound();

  return <MarketAdminPage key={slug} initialSlug={slug} />;
}

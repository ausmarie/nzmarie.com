import { notFound, redirect } from 'next/navigation';
import MarketAdminPage from '@/components/market/MarketAdminPage';
import { getMarketReportAdminEmail } from '@/lib/market-report-access';
import { parseMarketReportLanguage, parseMarketReportSlug } from '@/lib/market-report-url';

export default async function AdminMarketReportDraftPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ lang?: string | string[] }>;
}) {
  const email = await getMarketReportAdminEmail();
  if (!email) redirect('/admin/login');

  const { slug } = await params;
  const search = await searchParams;
  const language = parseMarketReportLanguage(search?.lang);
  if (!parseMarketReportSlug(slug) || !language) notFound();

  return <MarketAdminPage key={`${slug}:${language}`} initialSlug={slug} initialLanguage={language} />;
}

import PublishedMarketReportContent from '@/components/market/PublishedMarketReportPage';
import { parseMarketReportLanguage, parseMarketReportSlug } from '@/lib/market-report-url';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function PublishedMarketReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ lang?: string | string[] }>;
}) {
  const { slug } = await params;
  const search = await searchParams;
  const language = parseMarketReportLanguage(search?.lang);
  if (!language || !parseMarketReportSlug(slug)) notFound();
  return <PublishedMarketReportContent slug={slug} language={language} />;
}

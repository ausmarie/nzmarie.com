import PublishedMarketReportContent from '@/components/market/PublishedMarketReportPage';
import { getPublishedMarketReportMetadata } from '@/lib/market-report-seo';
import { parseMarketReportLanguage, parseMarketReportSlug } from '@/lib/market-report-url';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ lang?: string | string[] }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const search = await searchParams;
  const language = parseMarketReportLanguage(search?.lang);
  if (!language) notFound();
  return getPublishedMarketReportMetadata(slug, language);
}

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

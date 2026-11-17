import PublishedMarketReportContent from '@/components/market/PublishedMarketReportPage';
import { getPublishedMarketReportMetadata } from '@/lib/market-report-seo';
import { parseMarketReportSlug } from '@/lib/market-report-url';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getPublishedMarketReportSlugs } from '@/lib/market-report-public-cache';

export const revalidate = 3600;

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  const slugs = await getPublishedMarketReportSlugs('en');
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return getPublishedMarketReportMetadata(slug, 'en');
}

export default async function PublishedMarketReportPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!parseMarketReportSlug(slug)) notFound();
  return <PublishedMarketReportContent slug={slug} language="en" />;
}

import PublishedMarketReportPage from '@/components/market/PublishedMarketReportPage';
import { getPublishedMarketReportMetadata } from '@/lib/market-report-seo';
import type { Metadata } from 'next';
import { getPublishedMarketReportSlugs } from '@/lib/market-report-public-cache';

export const revalidate = 3600;

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  const slugs = await getPublishedMarketReportSlugs('zh');
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return getPublishedMarketReportMetadata(slug, 'zh');
}

export default async function ChinesePublishedMarketReportPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <PublishedMarketReportPage slug={slug} language="zh" />;
}

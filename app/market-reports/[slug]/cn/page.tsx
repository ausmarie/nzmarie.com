import PublishedMarketReportPage from '@/components/market/PublishedMarketReportPage';
import { getPublishedMarketReportMetadata } from '@/lib/market-report-seo';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

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

import PublishedMarketReportPage from '@/components/market/PublishedMarketReportPage';

export const dynamic = 'force-dynamic';

export default async function ChinesePublishedMarketReportPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <PublishedMarketReportPage slug={slug} language="zh" />;
}

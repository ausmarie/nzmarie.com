import type { MetadataRoute } from 'next';
import { getMarketReportSitemap } from '@/lib/market-report-seo';

export const dynamic = 'force-dynamic';

export default function sitemap(): Promise<MetadataRoute.Sitemap> {
  return getMarketReportSitemap();
}

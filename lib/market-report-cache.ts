import { revalidatePath, revalidateTag } from 'next/cache';
import type { MarketReportLanguage, MarketReportPeriodType } from '@/lib/market-report-data';
import { marketReportUrl, marketReportSlug } from '@/lib/market-report-url';
import { marketReportContentCacheTag } from '@/lib/market-report-public-cache';

export function revalidatePublishedMarketReport(report: {
  period_type: MarketReportPeriodType;
  period_key: string;
  language: MarketReportLanguage;
}): void {
  const slug = marketReportSlug(report.period_type, report.period_key).toLowerCase();
  revalidateTag(marketReportContentCacheTag(slug, report.language));
  revalidatePath(marketReportUrl({ ...report, status: 'published' }), 'page');
}

export function revalidateMarketReportHomePages(): void {
  revalidateTag('latest-market-report:en');
  revalidateTag('latest-market-report:zh');
  revalidatePath('/', 'page');
  revalidatePath('/cn', 'page');
  revalidatePath('/market-reports', 'page');
}

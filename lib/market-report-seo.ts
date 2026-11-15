import type { Metadata, MetadataRoute } from 'next';
import { query } from '@/lib/db';
import {
  getMarketReportPeriodLabel,
  isMarketReportLanguage,
  isMarketReportPeriodType,
  isValidMarketReportPeriod,
  type MarketReportLanguage,
  type MarketReportPeriodType,
} from '@/lib/market-report-data';
import { formatMillions } from '@/lib/market-pulse';
import { marketReportUrl, parseMarketReportSlug } from '@/lib/market-report-url';

const SITE_URL = 'https://www.nzmarie.com';

interface PublishedReportRow {
  period_type: MarketReportPeriodType;
  period_key: string;
  language: MarketReportLanguage;
  published_data_snapshot?: {
    metrics?: {
      medianPrice?: number | null;
      salesCount?: number | null;
    };
  } | null;
  published_at?: string | Date | null;
}

function absoluteReportUrl(report: PublishedReportRow): string {
  return new URL(marketReportUrl({ ...report, status: 'published' }), SITE_URL).toString();
}

function reportDescription(
  periodLabel: string,
  language: MarketReportLanguage,
  snapshot: PublishedReportRow['published_data_snapshot'],
): string {
  const medianPrice = snapshot?.metrics?.medianPrice;
  const salesCount = snapshot?.metrics?.salesCount;
  if (language === 'zh') {
    const metrics = typeof medianPrice === 'number' && Number.isFinite(medianPrice)
      ? `中位售价为 ${formatMillions(medianPrice)}，`
      : '';
    return `${periodLabel}奥克兰北岸房地产市场分析（Marie Nian）。${metrics}查看 REINZ 房屋成交量及售出天数趋势。`;
  }

  const median = typeof medianPrice === 'number' && Number.isFinite(medianPrice)
    ? `median sale prices (${formatMillions(medianPrice)})`
    : 'median sale prices';
  const sales = typeof salesCount === 'number' && Number.isFinite(salesCount)
    ? `sales volume (${salesCount} sales)`
    : 'sales volume';
  return `${periodLabel} North Shore housing market analysis by Marie Nian. Explore REINZ ${median}, ${sales}, and days-to-sell trends.`;
}

export async function getPublishedMarketReportMetadata(
  slug: string,
  language: MarketReportLanguage,
): Promise<Metadata> {
  const period = parseMarketReportSlug(slug);

  if (
    !period
    || !isMarketReportPeriodType(period.periodType)
    || !isValidMarketReportPeriod(period.periodType, period.periodKey)
  ) {
    return {
      title: 'North Shore Market Report | NZ Marie',
      robots: { index: false, follow: false },
    };
  }

  const result = await query<PublishedReportRow>(
    `SELECT period_type, period_key, language, published_data_snapshot
     FROM north_shore_market_reports
     WHERE period_type = $1 AND period_key = $2 AND status = 'published'
       AND language = $3
     LIMIT 1`,
    [period.periodType, period.periodKey, language],
  );
  const report = result.rows[0];
  if (!report) {
    return {
      title: 'North Shore Market Report | NZ Marie',
      robots: { index: false, follow: false },
    };
  }

  const periodLabel = getMarketReportPeriodLabel(report.period_type, report.period_key, language);
  const title = language === 'zh'
    ? `奥克兰北岸房地产市场报告（${periodLabel}）| NZ Marie`
    : `North Shore Market Report (${periodLabel}) | NZ Marie`;
  const description = reportDescription(periodLabel, language, report.published_data_snapshot);
  const url = absoluteReportUrl(report);
  const locale = language === 'zh' ? 'zh_CN' : 'en_NZ';

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: 'NZ Marie',
      locale,
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    robots: { index: true, follow: true },
  };
}

export async function getMarketReportSitemap(): Promise<MetadataRoute.Sitemap> {
  const result = await query<PublishedReportRow>(
    `SELECT period_type, period_key, language, published_at
     FROM north_shore_market_reports
     WHERE status = 'published' AND language IN ('en', 'zh')
     ORDER BY published_at DESC`,
  );

  return result.rows
    .filter((report) =>
      isMarketReportPeriodType(report.period_type)
      && isValidMarketReportPeriod(report.period_type, report.period_key)
      && isMarketReportLanguage(report.language),
    )
    .map((report) => {
      const lastModified = report.published_at ? new Date(report.published_at) : undefined;
      return {
        url: absoluteReportUrl(report),
        ...(lastModified && Number.isFinite(lastModified.getTime()) ? { lastModified } : {}),
      };
    });
}

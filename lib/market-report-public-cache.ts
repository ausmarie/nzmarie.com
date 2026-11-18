import { unstable_cache } from 'next/cache';
import { query } from '@/lib/db';
import {
  isMarketReportPeriodType,
  isValidMarketReportPeriod,
  type MarketReportLanguage,
  type MarketReportPeriodType,
  type MarketReportSnapshot,
} from '@/lib/market-report-data';
import { marketReportSlug, parseMarketReportSlug } from '@/lib/market-report-url';
import type { ReportEditorContent } from '@/types/report';
import type { MarketReportArticleHeader } from '@/lib/market-report-article-header';

export interface PublishedMarketReport {
  period_type: MarketReportPeriodType;
  period_key: string;
  language: MarketReportLanguage;
  published_content: ReportEditorContent | null;
  published_article_header: MarketReportArticleHeader | null;
  published_footer: string | null;
  published_data_snapshot: MarketReportSnapshot | null;
  published_at: string | Date | null;
}

export function marketReportContentCacheTag(
  slug: string,
  language: MarketReportLanguage,
): string {
  const period = parseMarketReportSlug(slug);
  const canonicalSlug = period
    ? marketReportSlug(period.periodType, period.periodKey).toLowerCase()
    : slug.toLowerCase();
  return `published-market-report:${language}:${canonicalSlug}`;
}

export async function getPublishedMarketReportSlugs(
  language: MarketReportLanguage,
): Promise<string[]> {
  const result = await query<{ period_type: string; period_key: string }>(
    `SELECT period_type, period_key
     FROM north_shore_market_reports
     WHERE status = 'published' AND language = $1`,
    [language],
  );
  return result.rows.flatMap((report) => {
    if (
      !isMarketReportPeriodType(report.period_type)
      || !isValidMarketReportPeriod(report.period_type, report.period_key)
    ) return [];
    return [marketReportSlug(report.period_type, report.period_key).toLowerCase()];
  });
}

export async function getPublishedMarketReport(
  slug: string,
  language: MarketReportLanguage,
): Promise<PublishedMarketReport | null> {
  const period = parseMarketReportSlug(slug);
  if (!period || !isValidMarketReportPeriod(period.periodType, period.periodKey)) return null;

  const canonicalSlug = marketReportSlug(period.periodType, period.periodKey).toLowerCase();
  return unstable_cache(
    async () => {
      const result = await query<PublishedMarketReport>(
        `SELECT period_type, period_key, language, published_content, published_article_header, published_footer,
                published_data_snapshot, published_at
         FROM north_shore_market_reports
         WHERE period_type = $1 AND period_key = $2 AND status = 'published'
           AND language = $3
         LIMIT 1`,
        [period.periodType, period.periodKey, language],
      );
      return result.rows[0] ?? null;
    },
    ['published-market-report', canonicalSlug, language],
    {
      revalidate: 3600,
      tags: [marketReportContentCacheTag(canonicalSlug, language)],
    },
  )();
}

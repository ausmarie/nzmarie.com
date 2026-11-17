import { unstable_cache } from 'next/cache';
import { query } from '@/lib/db';
import type { MarketReportLanguage, MarketReportPeriodType } from '@/lib/market-report-data';
import { marketReportUrl } from '@/lib/market-report-url';

interface LatestMarketReport {
  period_type: MarketReportPeriodType;
  period_key: string;
  status: 'published' | 'withdrawn';
}

export async function getLatestMarketReportUrl(language: MarketReportLanguage): Promise<string | null> {
  return unstable_cache(
    async () => {
      const result = await query<LatestMarketReport>(
        `SELECT period_type, period_key, status
         FROM north_shore_market_reports
         WHERE language = $1 AND status IN ('published', 'withdrawn')
         ORDER BY
           CASE
             WHEN period_type = 'monthly'
               THEN split_part(period_key, '-', 1)::integer * 12
                 + split_part(period_key, '-', 2)::integer
             ELSE split_part(period_key, '-Q', 1)::integer * 12
               + split_part(period_key, '-Q', 2)::integer * 3
           END DESC,
           CASE WHEN period_type = 'monthly' THEN 1 ELSE 0 END DESC
         LIMIT 1`,
        [language],
      );
      const latest = result.rows[0];
      if (!latest || latest.status !== 'published') return null;
      return marketReportUrl({ ...latest, language });
    },
    ['latest-market-report-url', language],
    { revalidate: 3600, tags: [`latest-market-report:${language}`] },
  )();
}

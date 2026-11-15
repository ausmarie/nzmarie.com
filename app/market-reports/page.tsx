import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import Header from '@/components/Header';
import { query } from '@/lib/db';
import {
  type MarketReportLanguage,
  type MarketReportPeriodType,
} from '@/lib/market-report-data';
import { marketReportUrl, parseMarketReportLanguage } from '@/lib/market-report-url';

export const dynamic = 'force-dynamic';

interface LatestMarketReport {
  period_type: MarketReportPeriodType;
  period_key: string;
  status: 'published' | 'withdrawn';
}

interface MarketReportsPageProps {
  searchParams?: Promise<{ lang?: string | string[] }>;
}

function getLanguage(search: { lang?: string | string[] } | undefined): MarketReportLanguage {
  const language = parseMarketReportLanguage(search?.lang);
  if (!language) notFound();
  return language;
}

export async function generateMetadata({ searchParams }: MarketReportsPageProps): Promise<Metadata> {
  const language = getLanguage(await searchParams);
  return language === 'zh'
    ? {
        title: 'NZ Marie - 持牌房地产顾问 | 奥克兰北岸',
        description: '查看 Marie 发布的最新奥克兰北岸房地产市场报告。',
      }
    : {
        title: 'NZ Marie - Licensed Real Estate Consultant | North Shore, Auckland',
        description: 'Read Marie’s latest published North Shore property market report.',
      };
}

export default async function MarketReportsPage({ searchParams }: MarketReportsPageProps) {
  const language = getLanguage(await searchParams);
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
  const latest = result.rows[0]?.status === 'published' ? result.rows[0] : null;
  const chinese = language === 'zh';
  if (latest) redirect(marketReportUrl({ ...latest, language }));

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Header lang={language} />
      <main className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            {chinese ? '北岸房地产市场报告' : 'North Shore Market Report'}
          </h1>
          <p className="mt-4 text-lg text-slate-600">
            {chinese ? '奥克兰北岸最新房地产市场数据与趋势解读' : 'The latest North Shore property market data and insights'}
          </p>

          <p className="mt-10 rounded-2xl border border-blue-100 bg-white px-6 py-10 text-lg leading-8 text-slate-700 shadow-sm">
            {chinese
              ? 'Marie 正在根据最新的数据编写报告，敬请期待。'
              : 'Marie is preparing a report based on the latest data. Please check back soon.'}
          </p>
        </div>
      </main>
    </div>
  );
}

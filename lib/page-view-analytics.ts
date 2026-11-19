import type { MarketReportLanguage, MarketReportPeriodType } from '@/lib/market-report-data';

export interface PageViewPeriods {
  total: number;
  today: number;
  week: number;
  month: number;
  year: number;
}

export interface PageViewTrendPoint {
  page_type: 'market_report' | 'blog_article';
  content_id: string;
  language: 'en' | 'zh';
  date: string;
  views: number;
}

export interface PageViewReport {
  id: string;
  period_type: MarketReportPeriodType;
  period_key: string;
  language: MarketReportLanguage;
  status: 'draft' | 'published' | 'withdrawn';
  views: PageViewPeriods;
}

export interface PageViewBlogPost {
  id: string;
  translation_group_id: string;
  language: 'en' | 'cn';
  slug: string;
  title: string;
  category_name: string | null;
  status: 'draft' | 'published';
  published_at: string | null;
  views: PageViewPeriods;
}

export interface PageViewAnalytics {
  today_date: string;
  home: PageViewPeriods;
  market: PageViewPeriods;
  blog: PageViewPeriods;
  reports: PageViewReport[];
  blog_posts: PageViewBlogPost[];
  trend: PageViewTrendPoint[];
}

export function pageViewPeriodLabel(
  report: Pick<PageViewReport, 'period_type' | 'period_key'>,
): string {
  if (report.period_type === 'quarterly') {
    const [year, quarter] = report.period_key.split('-Q');
    return `Q${quarter} ${year}`;
  }
  const [year, month] = report.period_key.split('-').map(Number);
  return new Intl.DateTimeFormat('en-NZ', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

import { NextResponse } from 'next/server';
import { getMarketReportAdminEmail } from '@/lib/market-report-access';
import { query } from '@/lib/db';
import { processPageViewQueueBatch } from '@/lib/page-view-queue';
import type { PageViewAnalytics, PageViewPeriods, PageViewReport } from '@/lib/page-view-analytics';

export const dynamic = 'force-dynamic';

const ADMIN_SYNC_MAX_BATCHES = 5;
const PAGE_VIEW_BATCH_SIZE = 100;
const TREND_DAYS = 90;

interface PeriodCountRow {
  total: string | number | null;
  today: string | number | null;
  week: string | number | null;
  month: string | number | null;
  year: string | number | null;
}

interface ContentMetricsRow extends PeriodCountRow {
  page_type: 'home' | 'market_report' | 'blog_article';
  content_key: string;
  language: 'en' | 'zh';
}

interface ReportRow {
  id: string;
  period_type: 'monthly' | 'quarterly';
  period_key: string;
  language: 'en' | 'zh';
  status: 'draft' | 'published' | 'withdrawn';
}

interface BlogPostRow {
  id: string;
  translation_group_id: string;
  language: 'en' | 'cn';
  slug: string;
  title: string;
  category_name: string | null;
  status: 'draft' | 'published';
  published_at: string | null;
}

interface TrendRow {
  today_date: string;
  page_type: 'market_report' | 'blog_article' | null;
  content_key: string | null;
  language: 'en' | 'zh' | null;
  date: string | null;
  views: string | number | null;
}

function counts(row?: PeriodCountRow): PageViewPeriods {
  return {
    total: Number(row?.total ?? 0),
    today: Number(row?.today ?? 0),
    week: Number(row?.week ?? 0),
    month: Number(row?.month ?? 0),
    year: Number(row?.year ?? 0),
  };
}

function metricKey(pageType: string, contentKey: string, language: string): string {
  return `${pageType}:${contentKey}:${language}`;
}

function sumCounts(rows: ContentMetricsRow[]): PageViewPeriods {
  return rows.reduce((total, row) => {
    const item = counts(row);
    return {
      total: total.total + item.total,
      today: total.today + item.today,
      week: total.week + item.week,
      month: total.month + item.month,
      year: total.year + item.year,
    };
  }, { total: 0, today: 0, week: 0, month: 0, year: 0 });
}

const periodBounds = `
  WITH bounds AS (
    SELECT
      (NOW() AT TIME ZONE 'Pacific/Auckland')::DATE AS today,
      date_trunc('week', NOW() AT TIME ZONE 'Pacific/Auckland')::DATE AS week_start,
      date_trunc('month', NOW() AT TIME ZONE 'Pacific/Auckland')::DATE AS month_start,
      date_trunc('year', NOW() AT TIME ZONE 'Pacific/Auckland')::DATE AS year_start
  )
`;

const periodCountSelect = `
  SUM(s.view_count)::INT8 AS total,
  SUM(s.view_count) FILTER (WHERE s.view_date = b.today)::INT8 AS today,
  SUM(s.view_count) FILTER (WHERE s.view_date >= b.week_start)::INT8 AS week,
  SUM(s.view_count) FILTER (WHERE s.view_date >= b.month_start)::INT8 AS month,
  SUM(s.view_count) FILTER (WHERE s.view_date >= b.year_start)::INT8 AS year
`;

async function loadPageViewAnalytics(syncQueue: boolean) {
  try {
    const email = await getMarketReportAdminEmail();
    if (!email) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    let queueSync: { processed: number; warning?: string } | undefined;
    if (syncQueue) {
      let processed = 0;
      let warning: string | undefined;
      try {
        for (let batch = 0; batch < ADMIN_SYNC_MAX_BATCHES; batch += 1) {
          const count = await processPageViewQueueBatch();
          processed += count;
          if (count < PAGE_VIEW_BATCH_SIZE) break;
        }
      } catch (error) {
        console.error('Failed to sync queued page-view events from admin analytics:', error);
        warning = 'Recent views could not be synchronized; showing saved counts.';
      }
      queueSync = { processed, warning };
    }

    const [metricsResult, reportsResult, blogPostsResult, trendResult] = await Promise.all([
      query<ContentMetricsRow>(
        `${periodBounds}
         SELECT s.page_type, s.content_key, s.language, ${periodCountSelect}
         FROM page_view_daily_stats s
         CROSS JOIN bounds b
         GROUP BY s.page_type, s.content_key, s.language`,
      ),
      query<ReportRow>(
        `SELECT id, period_type, period_key, language, status
         FROM north_shore_market_reports
         ORDER BY period_key DESC, period_type ASC, language ASC`,
      ),
      query<BlogPostRow>(
        `SELECT p.id,
                p.translation_group_id,
                p.language,
                COALESCE(p.published_slug, p.slug) AS slug,
                COALESCE(p.published_title, p.title) AS title,
                c.name AS category_name,
                p.status,
                p.published_at
         FROM blog_posts p
         LEFT JOIN blog_categories c ON c.id = p.category_id
         ORDER BY p.article_month DESC, p.updated_at DESC`,
      ),
      query<TrendRow>(
        `WITH bounds AS (
           SELECT (NOW() AT TIME ZONE 'Pacific/Auckland')::DATE AS today
         ),
         trend AS (
           SELECT s.page_type, s.content_key, s.language, s.view_date,
                  SUM(s.view_count)::INT8 AS views
           FROM page_view_daily_stats s
           CROSS JOIN bounds b
           WHERE s.page_type IN ('market_report', 'blog_article')
             AND s.view_date >= b.today - ${TREND_DAYS - 1}
             AND (
               (s.page_type = 'market_report' AND EXISTS (
                 SELECT 1 FROM north_shore_market_reports r
                 WHERE r.id::STRING = s.content_key AND r.status = 'published'
               ))
               OR (s.page_type = 'blog_article' AND EXISTS (
                 SELECT 1 FROM blog_posts p
                 WHERE p.id::STRING = s.content_key AND p.status = 'published'
               ))
             )
           GROUP BY s.page_type, s.content_key, s.language, s.view_date
         )
         SELECT b.today::STRING AS today_date,
                t.page_type,
                t.content_key,
                t.language,
                t.view_date::STRING AS date,
                t.views
         FROM bounds b
         LEFT JOIN trend t ON TRUE
         ORDER BY t.view_date, t.page_type, t.content_key, t.language`,
      ),
    ]);

    const metricsByKey = new Map(
      metricsResult.rows.map((row) => [
        metricKey(row.page_type, row.content_key, row.language),
        row,
      ]),
    );
    const metricsFor = (pageType: string, contentKey: string, language: string) =>
      counts(metricsByKey.get(metricKey(pageType, contentKey, language)));

    const rowsForType = (pageType: ContentMetricsRow['page_type']) =>
      metricsResult.rows.filter((row) => row.page_type === pageType);
    const data: PageViewAnalytics = {
      today_date: trendResult.rows[0]?.today_date ?? '',
      home: sumCounts(rowsForType('home')),
      market: sumCounts(rowsForType('market_report')),
      blog: sumCounts(rowsForType('blog_article')),
      reports: reportsResult.rows.map((row): PageViewReport => ({
        id: row.id,
        period_type: row.period_type,
        period_key: row.period_key,
        language: row.language,
        status: row.status,
        views: metricsFor('market_report', row.id, row.language),
      })),
      blog_posts: blogPostsResult.rows.map((row) => ({
        id: row.id,
        translation_group_id: row.translation_group_id,
        language: row.language,
        slug: row.slug,
        title: row.title,
        category_name: row.category_name,
        status: row.status,
        published_at: row.published_at,
        views: metricsFor('blog_article', row.id, row.language === 'cn' ? 'zh' : 'en'),
      })),
      trend: trendResult.rows
        .filter((row): row is TrendRow & {
          page_type: 'market_report' | 'blog_article';
          content_key: string;
          language: 'en' | 'zh';
          date: string;
          views: string | number;
        } => Boolean(row.page_type && row.content_key && row.language && row.date && row.views !== null))
        .map((row) => ({
          page_type: row.page_type,
          content_id: row.content_key,
          language: row.language,
          date: row.date,
          views: Number(row.views),
        })),
    };

    return NextResponse.json({ success: true, data, ...(queueSync ? { queueSync } : {}) }, {
      headers: { 'Cache-Control': syncQueue ? 'private, no-store' : 'private, max-age=30' },
    });
  } catch (error) {
    console.error('Failed to load page-view analytics:', error);
    return NextResponse.json({ success: false, error: 'Failed to load page-view analytics.' }, { status: 500 });
  }
}

export async function GET() {
  return loadPageViewAnalytics(false);
}

export async function POST() {
  return loadPageViewAnalytics(true);
}

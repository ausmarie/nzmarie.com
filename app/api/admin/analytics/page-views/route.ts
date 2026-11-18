import { NextResponse } from 'next/server';
import { getMarketReportAdminEmail } from '@/lib/market-report-access';
import { query } from '@/lib/db';
import { processPageViewQueueBatch } from '@/lib/page-view-queue';
import type { PageViewAnalytics, PageViewPeriods, PageViewReport } from '@/lib/page-view-analytics';

export const dynamic = 'force-dynamic';

const ADMIN_SYNC_MAX_BATCHES = 5;
const PAGE_VIEW_BATCH_SIZE = 100;

interface PeriodCountRow {
  total: string | number;
  week: string | number;
  month: string | number;
  year: string | number;
}

interface SummaryRow extends PeriodCountRow {
  page_type: 'home' | 'market_report' | 'blog_article';
}

interface ReportRow extends PeriodCountRow {
  id: string;
  period_type: 'monthly' | 'quarterly';
  period_key: string;
  language: 'en' | 'zh';
  status: 'draft' | 'published' | 'withdrawn';
}

interface BlogPostRow extends PeriodCountRow {
  id: string;
  translation_group_id: string;
  language: 'en' | 'cn';
  slug: string;
  title: string;
  category_name: string | null;
  status: 'draft' | 'published';
  published_at: string | null;
}

function counts(row?: PeriodCountRow): PageViewPeriods {
  return {
    total: Number(row?.total ?? 0),
    week: Number(row?.week ?? 0),
    month: Number(row?.month ?? 0),
    year: Number(row?.year ?? 0),
  };
}

const periodBounds = `
  WITH bounds AS (
    SELECT
      date_trunc('week', NOW() AT TIME ZONE 'Pacific/Auckland')
        AT TIME ZONE 'Pacific/Auckland' AS week_start,
      date_trunc('month', NOW() AT TIME ZONE 'Pacific/Auckland')
        AT TIME ZONE 'Pacific/Auckland' AS month_start,
      date_trunc('year', NOW() AT TIME ZONE 'Pacific/Auckland')
        AT TIME ZONE 'Pacific/Auckland' AS year_start
  )
`;

const periodCountSelect = `
  COUNT(e.id) AS total,
  COUNT(e.id) FILTER (WHERE e.created_at >= b.week_start) AS week,
  COUNT(e.id) FILTER (WHERE e.created_at >= b.month_start) AS month,
  COUNT(e.id) FILTER (WHERE e.created_at >= b.year_start) AS year
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

    const [summaryResult, reportsResult, blogPostsResult] = await Promise.all([
      query<SummaryRow>(
        `${periodBounds}
         SELECT types.page_type, ${periodCountSelect}
         FROM (VALUES ('home'::varchar), ('market_report'::varchar), ('blog_article'::varchar)) AS types(page_type)
         CROSS JOIN bounds b
         LEFT JOIN page_view_events e ON e.page_type = types.page_type
         GROUP BY types.page_type`,
      ),
      query<ReportRow>(
        `${periodBounds}
         SELECT r.id, r.period_type, r.period_key, r.language, r.status, ${periodCountSelect}
         FROM north_shore_market_reports r
         CROSS JOIN bounds b
         LEFT JOIN page_view_events e ON e.report_id = r.id
         GROUP BY r.id
         ORDER BY r.period_key DESC, r.period_type ASC, r.language ASC`,
      ),
      query<BlogPostRow>(
        `${periodBounds}
         SELECT p.id,
                p.translation_group_id,
                p.language,
                COALESCE(p.published_slug, p.slug) AS slug,
                COALESCE(p.published_title, p.title) AS title,
                c.name AS category_name,
                p.status,
                p.published_at,
                ${periodCountSelect}
         FROM blog_posts p
         CROSS JOIN bounds b
         LEFT JOIN blog_categories c ON c.id = p.category_id
         LEFT JOIN page_view_events e ON e.blog_post_id = p.id
         GROUP BY p.id, c.name
         ORDER BY p.article_month DESC, p.updated_at DESC`,
      ),
    ]);

    const rowsByType = new Map(summaryResult.rows.map((row) => [row.page_type, row]));
    const data: PageViewAnalytics = {
      home: counts(rowsByType.get('home')),
      market: counts(rowsByType.get('market_report')),
      blog: counts(rowsByType.get('blog_article')),
      reports: reportsResult.rows.map((row): PageViewReport => ({
        id: row.id,
        period_type: row.period_type,
        period_key: row.period_key,
        language: row.language,
        status: row.status,
        views: counts(row),
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
        views: counts(row),
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

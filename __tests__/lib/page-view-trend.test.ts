import { describe, expect, it } from 'vitest';
import type { PageViewAnalytics } from '@/lib/page-view-analytics';
import { buildPageViewTrendChartData } from '@/lib/page-view-trend';

function createAnalytics(): PageViewAnalytics {
  const emptyViews = { total: 0, today: 0, week: 0, month: 0, year: 0 };
  return {
    today_date: '2026-11-20',
    home: emptyViews,
    market: emptyViews,
    blog: emptyViews,
    reports: [
      {
        id: 'report-en',
        period_type: 'monthly',
        period_key: '2026-10',
        language: 'en',
        status: 'published',
        views: emptyViews,
      },
      {
        id: 'report-zh',
        period_type: 'monthly',
        period_key: '2026-10',
        language: 'zh',
        status: 'published',
        views: emptyViews,
      },
    ],
    blog_posts: [
      {
        id: 'blog-en',
        translation_group_id: 'blog-group',
        language: 'en',
        slug: 'selling-guide',
        title: 'Selling Guide',
        category_name: null,
        status: 'published',
        published_at: null,
        views: emptyViews,
      },
      {
        id: 'blog-zh',
        translation_group_id: 'blog-group',
        language: 'cn',
        slug: 'selling-guide-cn',
        title: '出售指南',
        category_name: null,
        status: 'published',
        published_at: null,
        views: emptyViews,
      },
    ],
    trend: [
      { page_type: 'blog_article', content_id: 'blog-en', language: 'en', date: '2026-11-20', views: 3 },
      { page_type: 'blog_article', content_id: 'blog-zh', language: 'zh', date: '2026-11-20', views: 2 },
      { page_type: 'blog_article', content_id: 'blog-en', language: 'en', date: '2026-11-19', views: 1 },
      { page_type: 'blog_article', content_id: 'blog-en', language: 'en', date: '2026-11-12', views: 8 },
      { page_type: 'market_report', content_id: 'report-en', language: 'en', date: '2026-11-20', views: 4 },
      { page_type: 'market_report', content_id: 'report-zh', language: 'zh', date: '2026-11-20', views: 2 },
    ],
  };
}

describe('buildPageViewTrendChartData', () => {
  it('combines translations, displays both content types, and fills missing days with zeroes', () => {
    const result = buildPageViewTrendChartData(createAnalytics(), 7);

    expect(result.series).toEqual([
      {
        id: 'monthly:2026-10',
        page_type: 'market_report',
        label: 'October 2026',
        total: 6,
        key: 'series-market_report-monthly%3A2026-10',
      },
      {
        id: 'blog-group',
        page_type: 'blog_article',
        label: 'Selling Guide',
        total: 6,
        key: 'series-blog_article-blog-group',
      },
    ]);
    expect(result.points).toHaveLength(7);
    expect(result.points[0]).toEqual({
      date: '2026-11-14',
      'series-market_report-monthly%3A2026-10': 0,
      'series-blog_article-blog-group': 0,
    });
    expect(result.points[5]['series-blog_article-blog-group']).toBe(1);
    expect(result.points[6]['series-blog_article-blog-group']).toBe(5);
    expect(result.points[6]['series-market_report-monthly%3A2026-10']).toBe(6);
  });
});

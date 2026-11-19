import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/market-report-access', () => ({
  getMarketReportAdminEmail: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
}));

const mocks = vi.hoisted(() => ({ processQueueBatch: vi.fn() }));
vi.mock('@/lib/page-view-queue', () => ({
  processPageViewQueueBatch: mocks.processQueueBatch,
}));

import { getMarketReportAdminEmail } from '@/lib/market-report-access';
import { query } from '@/lib/db';
import { GET, POST } from '../../../../app/api/admin/analytics/page-views/route';

function mockAnalyticsQueries() {
  vi.mocked(query).mockImplementation(async (sql) => {
    if (sql.includes('trend AS')) {
      return {
        rows: [{
          today_date: '2026-11-20',
          page_type: 'blog_article',
          content_key: 'blog-1',
          language: 'en',
          date: '2026-11-20',
          views: '5',
        }],
      } as never;
    }
    if (sql.includes('FROM page_view_daily_stats s')) {
      return {
        rows: [
          { page_type: 'home', content_key: 'home', language: 'en', total: '120', today: '3', week: '14', month: '45', year: '120' },
          { page_type: 'market_report', content_key: 'report-en', language: 'en', total: '48', today: '5', week: '6', month: '17', year: '48' },
          { page_type: 'market_report', content_key: 'report-1', language: 'zh', total: '12', today: '1', week: '2', month: '5', year: '12' },
          { page_type: 'blog_article', content_key: 'blog-1', language: 'en', total: '39', today: '5', week: '5', month: '11', year: '39' },
        ],
      } as never;
    }
    if (sql.includes('FROM north_shore_market_reports')) {
      return {
        rows: [{
          id: 'report-1',
          period_type: 'monthly',
          period_key: '2026-10',
          language: 'zh',
          status: 'published',
        }],
      } as never;
    }
    return {
      rows: [{
        id: 'blog-1',
        translation_group_id: 'blog-group-1',
        language: 'en',
        slug: 'selling-guide',
        title: 'Selling Guide',
        category_name: 'Sell',
        status: 'published',
        published_at: '2026-10-10T00:00:00.000Z',
      }],
    } as never;
  });
}

describe('GET /api/admin/analytics/page-views', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getMarketReportAdminEmail).mockResolvedValue('admin@example.com');
    mocks.processQueueBatch.mockResolvedValue(0);
    mockAnalyticsQueries();
  });

  it('returns Today, period totals, and per-content daily views from the NZ-day rollup', async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.today_date).toBe('2026-11-20');
    expect(body.data.home).toEqual({ total: 120, today: 3, week: 14, month: 45, year: 120 });
    expect(body.data.market).toEqual({ total: 60, today: 6, week: 8, month: 22, year: 60 });
    expect(body.data.blog).toEqual({ total: 39, today: 5, week: 5, month: 11, year: 39 });
    expect(body.data.reports[0]).toEqual({
      id: 'report-1',
      period_type: 'monthly',
      period_key: '2026-10',
      language: 'zh',
      status: 'published',
      views: { total: 12, today: 1, week: 2, month: 5, year: 12 },
    });
    expect(body.data.blog_posts[0]).toEqual({
      id: 'blog-1',
      translation_group_id: 'blog-group-1',
      language: 'en',
      slug: 'selling-guide',
      title: 'Selling Guide',
      category_name: 'Sell',
      status: 'published',
      published_at: '2026-10-10T00:00:00.000Z',
      views: { total: 39, today: 5, week: 5, month: 11, year: 39 },
    });
    expect(body.data.trend).toEqual([{
      page_type: 'blog_article',
      content_id: 'blog-1',
      language: 'en',
      date: '2026-11-20',
      views: 5,
    }]);

    const queries = vi.mocked(query).mock.calls.map(([sql]) => sql);
    expect(queries).toHaveLength(4);
    expect(queries.filter((sql) => sql.includes('page_view_daily_stats')).length).toBe(2);
    expect(queries[0]).toContain("AT TIME ZONE 'Pacific/Auckland'");
    expect(queries[0]).toContain('s.view_date = b.today');
    expect(queries[3]).toContain(`b.today - ${90 - 1}`);
    expect(mocks.processQueueBatch).not.toHaveBeenCalled();
  });

  it('denies access before querying analytics for non-admin users', async () => {
    vi.mocked(getMarketReportAdminEmail).mockResolvedValue(null);

    const response = await GET();
    const refreshResponse = await POST();

    expect(response.status).toBe(403);
    expect(refreshResponse.status).toBe(403);
    expect(query).not.toHaveBeenCalled();
    expect(mocks.processQueueBatch).not.toHaveBeenCalled();
  });

  it('flushes queued views before returning fresh analytics to an admin', async () => {
    mocks.processQueueBatch.mockResolvedValueOnce(100).mockResolvedValueOnce(42);

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.queueSync).toEqual({ processed: 142 });
    expect(mocks.processQueueBatch).toHaveBeenCalledTimes(2);
    expect(query).toHaveBeenCalledTimes(4);
    expect(mocks.processQueueBatch.mock.invocationCallOrder[0])
      .toBeLessThan(vi.mocked(query).mock.invocationCallOrder[0]);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it('caps an admin refresh at five full batches', async () => {
    mocks.processQueueBatch.mockResolvedValue(100);

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.queueSync).toEqual({ processed: 500 });
    expect(mocks.processQueueBatch).toHaveBeenCalledTimes(5);
  });

  it('returns saved analytics and an explicit warning when Redis synchronization fails', async () => {
    mocks.processQueueBatch.mockRejectedValueOnce(new Error('Redis unavailable'));

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.queueSync).toEqual({
      processed: 0,
      warning: 'Recent views could not be synchronized; showing saved counts.',
    });
    expect(query).toHaveBeenCalledTimes(4);
  });
});

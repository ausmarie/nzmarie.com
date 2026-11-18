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

describe('GET /api/admin/analytics/page-views', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getMarketReportAdminEmail).mockResolvedValue('admin@example.com');
    mocks.processQueueBatch.mockResolvedValue(0);
  });

  it('returns home, Market, and report totals with Auckland calendar periods', async () => {
    vi.mocked(query).mockImplementation(async (sql) => {
      if (sql.includes('VALUES (')) {
        return {
          rows: [
            { page_type: 'home', total: '120', week: '14', month: '45', year: '120' },
            { page_type: 'market_report', total: '60', week: '8', month: '22', year: '60' },
            { page_type: 'blog_article', total: '39', week: '5', month: '11', year: '39' },
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
            total: '12',
            week: '3',
            month: '5',
            year: '12',
          }],
        } as never;
      }
      return {
        rows: [{
          id: 'blog-1',
          slug: 'selling-guide',
          title: 'Selling Guide',
          category_name: 'Sell',
          status: 'published',
          published_at: '2026-10-10T00:00:00.000Z',
          total: '39',
          week: '5',
          month: '11',
          year: '39',
        }],
      } as never;
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.home).toEqual({ total: 120, week: 14, month: 45, year: 120 });
    expect(body.data.market).toEqual({ total: 60, week: 8, month: 22, year: 60 });
    expect(body.data.blog).toEqual({ total: 39, week: 5, month: 11, year: 39 });
    expect(body.data.reports[0]).toEqual({
      id: 'report-1',
      period_type: 'monthly',
      period_key: '2026-10',
      language: 'zh',
      status: 'published',
      views: { total: 12, week: 3, month: 5, year: 12 },
    });
    expect(body.data.blog_posts[0]).toEqual({
      id: 'blog-1',
      slug: 'selling-guide',
      title: 'Selling Guide',
      category_name: 'Sell',
      status: 'published',
      published_at: '2026-10-10T00:00:00.000Z',
      views: { total: 39, week: 5, month: 11, year: 39 },
    });

    const queries = vi.mocked(query).mock.calls.map(([sql]) => sql);
    expect(queries).toHaveLength(3);
    expect(queries.every((sql) => sql.includes("Pacific/Auckland"))).toBe(true);
    expect(queries[1]).toContain('LEFT JOIN page_view_events e ON e.report_id = r.id');
    expect(queries[2]).toContain('LEFT JOIN page_view_events e ON e.blog_post_id = p.id');
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
    vi.mocked(query).mockResolvedValue({ rows: [] } as never);
    mocks.processQueueBatch.mockResolvedValueOnce(100).mockResolvedValueOnce(42);

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.queueSync).toEqual({ processed: 142 });
    expect(mocks.processQueueBatch).toHaveBeenCalledTimes(2);
    expect(query).toHaveBeenCalledTimes(3);
    expect(mocks.processQueueBatch.mock.invocationCallOrder[0])
      .toBeLessThan(vi.mocked(query).mock.invocationCallOrder[0]);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it('caps an admin refresh at five full batches', async () => {
    vi.mocked(query).mockResolvedValue({ rows: [] } as never);
    mocks.processQueueBatch.mockResolvedValue(100);

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.queueSync).toEqual({ processed: 500 });
    expect(mocks.processQueueBatch).toHaveBeenCalledTimes(5);
  });

  it('returns saved analytics and an explicit warning when Redis synchronization fails', async () => {
    vi.mocked(query).mockResolvedValue({ rows: [] } as never);
    mocks.processQueueBatch.mockRejectedValueOnce(new Error('Redis unavailable'));

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.queueSync).toEqual({
      processed: 0,
      warning: 'Recent views could not be synchronized; showing saved counts.',
    });
    expect(query).toHaveBeenCalledTimes(3);
  });
});

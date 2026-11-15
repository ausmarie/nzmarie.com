import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/market-report-access', () => ({
  getMarketReportAdminEmail: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
}));

import { getMarketReportAdminEmail } from '@/lib/market-report-access';
import { query } from '@/lib/db';
import { GET } from '../../../../app/api/admin/analytics/page-views/route';

describe('GET /api/admin/analytics/page-views', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getMarketReportAdminEmail).mockResolvedValue('admin@example.com');
  });

  it('returns home, Market, and report totals with Auckland calendar periods', async () => {
    vi.mocked(query).mockImplementation(async (sql) => {
      if (sql.includes('VALUES (')) {
        return {
          rows: [
            { page_type: 'home', total: '120', week: '14', month: '45', year: '120' },
            { page_type: 'market_report', total: '60', week: '8', month: '22', year: '60' },
          ],
        } as never;
      }
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
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.home).toEqual({ total: 120, week: 14, month: 45, year: 120 });
    expect(body.data.market).toEqual({ total: 60, week: 8, month: 22, year: 60 });
    expect(body.data.reports[0]).toEqual({
      id: 'report-1',
      period_type: 'monthly',
      period_key: '2026-10',
      language: 'zh',
      status: 'published',
      views: { total: 12, week: 3, month: 5, year: 12 },
    });

    const queries = vi.mocked(query).mock.calls.map(([sql]) => sql);
    expect(queries).toHaveLength(2);
    expect(queries.every((sql) => sql.includes("Pacific/Auckland"))).toBe(true);
    expect(queries[1]).toContain('LEFT JOIN page_view_events e ON e.report_id = r.id');
  });

  it('denies access before querying analytics for non-admin users', async () => {
    vi.mocked(getMarketReportAdminEmail).mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(403);
    expect(query).not.toHaveBeenCalled();
  });
});

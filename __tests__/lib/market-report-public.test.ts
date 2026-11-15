import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock('@/lib/db', () => ({ query: mocks.query }));

import { getLatestMarketReportUrl } from '@/lib/market-report-public';

describe('latest public Market report URL', () => {
  beforeEach(() => mocks.query.mockReset());

  it.each([
    ['en', '/market-reports/october-2026'],
    ['zh', '/market-reports/october-2026/cn'],
  ] as const)('creates a direct %s report URL', async (language, url) => {
    mocks.query.mockResolvedValueOnce({
      rows: [{ period_type: 'monthly', period_key: '2026-10', status: 'published' }],
    });

    await expect(getLatestMarketReportUrl(language)).resolves.toBe(url);
    expect(mocks.query.mock.calls[0][1]).toEqual([language]);
  });

  it('returns no direct URL when the latest report is withdrawn or not present', async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [{ period_type: 'monthly', period_key: '2026-10', status: 'withdrawn' }] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(getLatestMarketReportUrl('en')).resolves.toBeNull();
    await expect(getLatestMarketReportUrl('zh')).resolves.toBeNull();
  });
});

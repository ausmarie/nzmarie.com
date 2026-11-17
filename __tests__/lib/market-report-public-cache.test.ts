import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  unstableCache: vi.fn((callback: () => unknown) => callback),
}));

vi.mock('@/lib/db', () => ({ query: mocks.query }));
vi.mock('next/cache', () => ({
  unstable_cache: mocks.unstableCache,
}));

import {
  getPublishedMarketReport,
  getPublishedMarketReportSlugs,
  marketReportContentCacheTag,
} from '@/lib/market-report-public-cache';

describe('published Market report cache', () => {
  beforeEach(() => {
    mocks.query.mockReset();
    mocks.unstableCache.mockClear();
  });

  it('caches published report data by canonical slug and language', async () => {
    const report = {
      period_type: 'monthly',
      period_key: '2026-10',
      language: 'zh',
      published_content: [],
      published_footer: null,
      published_data_snapshot: { periodType: 'monthly', periodKey: '2026-10' },
      published_at: '2026-11-01T00:00:00.000Z',
    };
    mocks.query.mockResolvedValueOnce({ rows: [report] });

    await expect(getPublishedMarketReport('October-2026', 'zh')).resolves.toEqual(report);

    expect(mocks.unstableCache).toHaveBeenCalledWith(
      expect.any(Function),
      ['published-market-report', 'october-2026', 'zh'],
      {
        revalidate: 3600,
        tags: ['published-market-report:zh:october-2026'],
      },
    );
    expect(mocks.query.mock.calls[0][1]).toEqual(['monthly', '2026-10', 'zh']);
  });

  it('uses the same cache tag for slug case variants and skips invalid slugs', async () => {
    expect(marketReportContentCacheTag('October-2026', 'en'))
      .toBe(marketReportContentCacheTag('october-2026', 'en'));

    await expect(getPublishedMarketReport('unknown', 'en')).resolves.toBeNull();
    expect(mocks.unstableCache).not.toHaveBeenCalled();
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it('returns only valid, language-specific published report slugs for ISR generation', async () => {
    mocks.query.mockResolvedValueOnce({
      rows: [
        { period_type: 'monthly', period_key: '2026-10' },
        { period_type: 'quarterly', period_key: '2026-Q3' },
        { period_type: 'monthly', period_key: '2026-13' },
        { period_type: 'unsupported', period_key: '2026-10' },
      ],
    });

    await expect(getPublishedMarketReportSlugs('en')).resolves.toEqual([
      'october-2026',
      'q3-2026',
    ]);
    expect(mocks.query.mock.calls[0][1]).toEqual(['en']);
  });
});

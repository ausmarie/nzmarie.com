import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock('next/cache', () => mocks);

import {
  revalidateMarketReportHomePages,
  revalidatePublishedMarketReport,
} from '@/lib/market-report-cache';

describe('Market report cache invalidation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('invalidates the localized report and latest-report caches', () => {
    revalidatePublishedMarketReport({
      period_type: 'monthly',
      period_key: '2026-10',
      language: 'zh',
    });

    expect(mocks.revalidateTag).toHaveBeenCalledWith('published-market-report:zh:october-2026');
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/market-reports/october-2026/cn', 'page');

    revalidateMarketReportHomePages();

    expect(mocks.revalidateTag).toHaveBeenCalledWith('latest-market-report:en');
    expect(mocks.revalidateTag).toHaveBeenCalledWith('latest-market-report:zh');
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/', 'page');
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/cn', 'page');
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/market-reports', 'page');
  });
});

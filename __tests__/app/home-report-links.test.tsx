import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getLatestMarketReportUrl: vi.fn() }));

vi.mock('@/lib/market-report-public', () => ({
  getLatestMarketReportUrl: mocks.getLatestMarketReportUrl,
}));
vi.mock('@/components/MainPageContent', () => ({
  default: (props: unknown) => props,
}));

import Home from '@/app/page';
import HomeCN from '@/app/cn/page';

describe('homepage Market Reports destinations', () => {
  beforeEach(() => mocks.getLatestMarketReportUrl.mockReset());

  it('passes the English report URL directly to the navbar', async () => {
    mocks.getLatestMarketReportUrl.mockResolvedValueOnce('/market-reports/October-2026');

    const page = await Home();

    expect(page.props.marketReportsHref).toBe('/market-reports/October-2026');
    expect(mocks.getLatestMarketReportUrl).toHaveBeenCalledWith('en');
  });

  it('passes the Chinese report URL directly to the navbar', async () => {
    mocks.getLatestMarketReportUrl.mockResolvedValueOnce('/market-reports/October-2026/cn');

    const page = await HomeCN();

    expect(page.props.marketReportsHref).toBe('/market-reports/October-2026/cn');
    expect(mocks.getLatestMarketReportUrl).toHaveBeenCalledWith('zh');
  });

  it('keeps the preparation page as the destination when no report is published', async () => {
    mocks.getLatestMarketReportUrl.mockResolvedValueOnce(null);

    const page = await Home();

    expect(page.props.marketReportsHref).toBe('/market-reports?lang=en');
  });
});

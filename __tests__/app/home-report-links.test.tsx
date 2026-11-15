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

function getHomeChildren(page: unknown) {
  const element = page as React.ReactElement<{ children: React.ReactNode }>;
  return React.Children.toArray(element.props.children) as React.ReactElement<Record<string, unknown>>[];
}

describe('homepage Market Reports destinations', () => {
  beforeEach(() => mocks.getLatestMarketReportUrl.mockReset());

  it('passes the English report URL directly to the navbar', async () => {
    mocks.getLatestMarketReportUrl.mockResolvedValueOnce('/market-reports/october-2026');

    const page = await Home();
    const [tracker, content] = getHomeChildren(page);

    expect(tracker.props).toMatchObject({ pageType: 'home', language: 'en' });
    expect(content.props.marketReportsHref).toBe('/market-reports/october-2026');
    expect(mocks.getLatestMarketReportUrl).toHaveBeenCalledWith('en');
  });

  it('passes the Chinese report URL directly to the navbar', async () => {
    mocks.getLatestMarketReportUrl.mockResolvedValueOnce('/market-reports/october-2026/cn');

    const page = await HomeCN();
    const [tracker, content] = getHomeChildren(page);

    expect(tracker.props).toMatchObject({ pageType: 'home', language: 'zh' });
    expect(content.props.marketReportsHref).toBe('/market-reports/october-2026/cn');
    expect(mocks.getLatestMarketReportUrl).toHaveBeenCalledWith('zh');
  });

  it('keeps the preparation page as the destination when no report is published', async () => {
    mocks.getLatestMarketReportUrl.mockResolvedValueOnce(null);

    const page = await Home();
    const [, content] = getHomeChildren(page);

    expect(content.props.marketReportsHref).toBe('/market-reports?lang=en');
  });
});

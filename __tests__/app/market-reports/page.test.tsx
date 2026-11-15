import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

const mocks = vi.hoisted(() => ({ query: vi.fn(), redirect: vi.fn() }));

vi.mock('@/lib/db', () => ({ query: mocks.query }));
vi.mock('next/navigation', () => ({
  notFound: () => { throw new Error('NOT_FOUND'); },
  redirect: (url: string) => {
    mocks.redirect(url);
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));
vi.mock('@/components/Header', () => ({
  default: () => React.createElement('header', null, 'Header'),
}));

import MarketReportsPage, { generateMetadata } from '@/app/market-reports/page';

describe('public Market Reports landing page', () => {
  beforeEach(() => {
    mocks.query.mockReset();
    mocks.redirect.mockReset();
  });
  afterEach(cleanup);

  it('redirects directly to the latest English public report', async () => {
    mocks.query.mockResolvedValueOnce({
      rows: [{ period_type: 'monthly', period_key: '2026-10', status: 'published' }],
    });

    await expect(MarketReportsPage({ searchParams: Promise.resolve({ lang: 'en' }) }))
      .rejects.toThrow('NEXT_REDIRECT:/market-reports/October-2026');
    expect(mocks.redirect).toHaveBeenCalledWith('/market-reports/October-2026');
    expect(mocks.query.mock.calls[0][1]).toEqual(['en']);
  });

  it('redirects directly to the latest Chinese public report URL', async () => {
    mocks.query.mockResolvedValueOnce({
      rows: [{ period_type: 'monthly', period_key: '2026-10', status: 'published' }],
    });

    await expect(MarketReportsPage({ searchParams: Promise.resolve({ lang: 'zh' }) }))
      .rejects.toThrow('NEXT_REDIRECT:/market-reports/October-2026/cn');
    expect(mocks.redirect).toHaveBeenCalledWith('/market-reports/October-2026/cn');
    expect(mocks.query.mock.calls[0][1]).toEqual(['zh']);
  });

  it.each([
    ['en', 'Marie is preparing a report based on the latest data. Please check back soon.'],
    ['zh', 'Marie 正在根据最新的数据编写报告，敬请期待。'],
  ] as const)('shows the %s preparation notice when no report is public', async (language, notice) => {
    mocks.query.mockResolvedValueOnce({ rows: [] });

    render(await MarketReportsPage({ searchParams: Promise.resolve({ lang: language }) }));

    expect(screen.getByText(notice)).toBeTruthy();
    expect(screen.queryByRole('link', { name: /View Public Report|查看公开报告/ })).toBeNull();
  });

  it('does not present a withdrawn latest report as public', async () => {
    mocks.query.mockResolvedValueOnce({
      rows: [{ period_type: 'monthly', period_key: '2026-10', status: 'withdrawn' }],
    });

    render(await MarketReportsPage({ searchParams: Promise.resolve({ lang: 'en' }) }));

    expect(screen.getByText('Marie is preparing a report based on the latest data. Please check back soon.')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'View Public Report' })).toBeNull();
  });

  it('uses the requested site title for the English and Chinese browser titles', async () => {
    await expect(generateMetadata({ searchParams: Promise.resolve({ lang: 'en' }) }))
      .resolves.toMatchObject({ title: 'NZ Marie - Licensed Real Estate Consultant | North Shore, Auckland' });
    await expect(generateMetadata({ searchParams: Promise.resolve({ lang: 'zh' }) }))
      .resolves.toMatchObject({ title: 'NZ Marie - 持牌房地产顾问 | 奥克兰北岸' });
  });
});

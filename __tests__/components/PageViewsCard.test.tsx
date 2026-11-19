import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PageViewsCard from '@/components/admin/PageViewsCard';
import { PageViewsProvider } from '@/components/admin/PageViewsProvider';

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe('PageViewsCard', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('shows Today and period-by-language view counts from a shared read-only request', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          today_date: '2026-11-20',
          home: { total: 1300, today: 11, week: 80, month: 250, year: 1300 },
          market: { total: 420, today: 7, week: 20, month: 75, year: 420 },
          blog: { total: 101, today: 4, week: 10, month: 24, year: 101 },
          reports: [
            {
              id: 'report-en',
              period_type: 'monthly',
              period_key: '2026-10',
              language: 'en',
              status: 'published',
              views: { total: 31, today: 3, week: 4, month: 9, year: 31 },
            },
            {
              id: 'report-zh',
              period_type: 'monthly',
              period_key: '2026-10',
              language: 'zh',
              status: 'published',
              views: { total: 17, today: 1, week: 2, month: 5, year: 17 },
            },
          ],
          blog_posts: [
            {
              id: 'blog-post-en',
              translation_group_id: 'selling-guide-group',
              language: 'en',
              slug: 'selling-guide',
              title: 'Selling Guide',
              category_name: 'Sell',
              status: 'published',
              published_at: '2026-10-25T00:00:00.000Z',
              views: { total: 90, today: 3, week: 8, month: 24, year: 90 },
            },
            {
              id: 'blog-post-cn',
              translation_group_id: 'selling-guide-group',
              language: 'cn',
              slug: 'selling-guide-cn',
              title: '出售房屋指南',
              category_name: 'Sell',
              status: 'published',
              published_at: '2026-10-26T00:00:00.000Z',
              views: { total: 11, today: 1, week: 2, month: 4, year: 11 },
            },
          ],
          trend: [],
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <PageViewsProvider>
        <PageViewsCard />
      </PageViewsProvider>,
    );

    expect(await screen.findByText('1,300')).toBeTruthy();
    expect(screen.getByText('Home Views')).toBeTruthy();
    expect(screen.getByText('Market Views')).toBeTruthy();
    expect(screen.getByText('Blog Views')).toBeTruthy();
    expect(screen.getByText('Article Views by Language')).toBeTruthy();
    expect(screen.getByText('Selling Guide')).toBeTruthy();
    expect(screen.getByText('English 90 · Chinese 11')).toBeTruthy();
    expect(screen.getByText('Today 4 · Total 101')).toBeTruthy();
    expect(screen.queryByText('出售房屋指南')).toBeNull();
    expect(screen.getByRole('link', { name: 'Open Blog' }).getAttribute('href')).toBe('/admin/blog');
    expect(screen.getByText('October 2026')).toBeTruthy();
    expect(screen.getByText('Today 4 · Total 48')).toBeTruthy();
    expect(screen.getByText('This week: 80')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/analytics/page-views',
      expect.objectContaining({ cache: 'no-store' }),
    );
    expect(
      screen.getByText('Market Views').compareDocumentPosition(screen.getByText('Report Views by Period'))
        & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      screen.getByText('Report Views by Period').compareDocumentPosition(screen.getByText('Home Views'))
        & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

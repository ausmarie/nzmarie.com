import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PageViewsCard from '@/components/admin/PageViewsCard';

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

  it('shows Home, Market, and month-by-language view counts', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          home: { total: 1300, week: 80, month: 250, year: 1300 },
          market: { total: 420, week: 20, month: 75, year: 420 },
          blog: { total: 90, week: 8, month: 24, year: 90 },
          reports: [
            {
              id: 'report-en',
              period_type: 'monthly',
              period_key: '2026-10',
              language: 'en',
              status: 'published',
              views: { total: 31, week: 4, month: 9, year: 31 },
            },
            {
              id: 'report-zh',
              period_type: 'monthly',
              period_key: '2026-10',
              language: 'zh',
              status: 'published',
              views: { total: 17, week: 2, month: 5, year: 17 },
            },
          ],
          blog_posts: [
            {
              id: 'blog-post-1',
              slug: 'selling-guide',
              title: 'Selling Guide',
              category_name: 'Sell',
              status: 'published',
              published_at: '2026-10-25T00:00:00.000Z',
              views: { total: 90, week: 8, month: 24, year: 90 },
            },
          ],
        },
      }),
    }));

    render(<PageViewsCard />);

    expect(await screen.findByText('1,300')).toBeTruthy();
    expect(screen.getByText('Home Views')).toBeTruthy();
    expect(screen.getByText('Market Views')).toBeTruthy();
    expect(screen.getByText('Blog Views')).toBeTruthy();
    expect(screen.getByText('Article Views')).toBeTruthy();
    expect(screen.getByText('Selling Guide')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open Blog' }).getAttribute('href')).toBe('/admin/blog');
    expect(screen.getByText('October 2026')).toBeTruthy();
    expect(screen.getByText('English 31 · Chinese 17')).toBeTruthy();
    expect(screen.getByText('This week: 80')).toBeTruthy();
    expect(
      screen.getByText('Market Views').compareDocumentPosition(screen.getByText('Report Views by Period'))
        & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      screen.getByText('Report Views by Period').compareDocumentPosition(screen.getByText('Home Views'))
        & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});

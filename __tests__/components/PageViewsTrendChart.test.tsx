import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PageViewsProvider } from '@/components/admin/PageViewsProvider';
import PageViewsTrendChart from '@/components/admin/PageViewsTrendChart';

describe('PageViewsTrendChart', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('shows both content types and defaults to a 7-day range', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          today_date: '2026-11-20',
          home: { total: 0, today: 0, week: 0, month: 0, year: 0 },
          market: { total: 4, today: 4, week: 4, month: 4, year: 4 },
          blog: { total: 5, today: 5, week: 5, month: 5, year: 5 },
          reports: [{
            id: 'report-en',
            period_type: 'monthly',
            period_key: '2026-10',
            language: 'en',
            status: 'published',
            views: { total: 4, today: 4, week: 4, month: 4, year: 4 },
          }],
          blog_posts: [{
            id: 'blog-en',
            translation_group_id: 'blog-group',
            language: 'en',
            slug: 'selling-guide',
            title: 'Selling Guide',
            category_name: null,
            status: 'published',
            published_at: '2026-11-20',
            views: { total: 5, today: 5, week: 5, month: 5, year: 5 },
          }],
          trend: [
            { page_type: 'blog_article', content_id: 'blog-en', language: 'en', date: '2026-11-20', views: 5 },
            { page_type: 'market_report', content_id: 'report-en', language: 'en', date: '2026-11-20', views: 4 },
          ],
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <PageViewsProvider>
        <PageViewsTrendChart />
      </PageViewsProvider>,
    );

    expect(await screen.findByText('Content View Trends')).toBeTruthy();
    expect(screen.getByText('North Shore Reports').className).toContain('text-blue-700');
    expect(screen.getByText('Blog').className).toContain('text-green-700');
    expect(screen.getByRole('button', { name: '7d' }).getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: '30d' }));

    expect(screen.getByRole('button', { name: '30d' }).getAttribute('aria-pressed')).toBe('true');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

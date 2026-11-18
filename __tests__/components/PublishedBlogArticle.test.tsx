import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getArticle: vi.fn(),
  getLatestMarketReportUrl: vi.fn(),
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/components/Header', () => ({ default: () => null }));
vi.mock('@/components/blog/BlogArticleFooter', () => ({
  default: () => <div>Note</div>,
}));
vi.mock('@/components/blog/BlogRichTextRenderer', () => ({
  default: () => <div>Article content</div>,
}));
vi.mock('@/lib/blog-public-cache', () => ({
  getPublishedBlogArticle: mocks.getArticle,
}));
vi.mock('@/lib/market-report-public', () => ({
  getLatestMarketReportUrl: mocks.getLatestMarketReportUrl,
}));

import PublishedBlogArticle from '@/components/blog/PublishedBlogArticle';

describe('PublishedBlogArticle recommendations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getArticle.mockResolvedValue({
      slug: 'selling-guide',
      title: 'Selling Guide',
      summary: 'A practical guide.',
      author: 'Marie Nian',
      reading_minutes: 5,
      article_month: '2026-10-01',
      content: [],
      translation_slug: null,
      category_slug: null,
      category_name: null,
      category_name_cn: null,
    });
  });

  afterEach(cleanup);

  it('links English articles to the latest English North Shore report above the note', async () => {
    mocks.getLatestMarketReportUrl.mockResolvedValue('/market-reports/october-2026');

    render(await PublishedBlogArticle({ slug: 'selling-guide', language: 'en' }));

    const reportLink = screen.getByRole('link', { name: 'Latest North Shore Market Report' });
    const note = screen.getByText('Note');
    expect(screen.getByRole('heading', {
      name: 'Recommended article: Latest North Shore Market Report',
    })).toBeTruthy();
    expect(reportLink.parentElement?.tagName).toBe('H2');
    expect(reportLink.getAttribute('href')).toBe('/market-reports/october-2026');
    expect(mocks.getLatestMarketReportUrl).toHaveBeenCalledWith('en');
    expect(
      reportLink.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('links Chinese articles to the latest Chinese North Shore report', async () => {
    mocks.getLatestMarketReportUrl.mockResolvedValue('/market-reports/october-2026/cn');

    render(await PublishedBlogArticle({ slug: 'selling-guide-cn', language: 'cn' }));

    const reportLink = screen.getByRole('link', { name: '北岸最新市场报告' });
    expect(screen.getByRole('heading', { name: '推荐文章：北岸最新市场报告' })).toBeTruthy();
    expect(reportLink.parentElement?.tagName).toBe('H2');
    expect(reportLink.getAttribute('href'))
      .toBe('/market-reports/october-2026/cn');
    expect(mocks.getLatestMarketReportUrl).toHaveBeenCalledWith('zh');
    expect(screen.getByRole('heading', { name: '推荐文章：北岸最新市场报告' })).toBeTruthy();
  });
});

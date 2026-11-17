import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  getBlogAdminEmail: vi.fn(),
  query: vi.fn(),
  notFound: vi.fn(() => { throw new Error('NOT_FOUND'); }),
  redirect: vi.fn(() => { throw new Error('REDIRECT'); }),
}));

vi.mock('next/navigation', () => ({
  notFound: mocks.notFound,
  redirect: mocks.redirect,
}));
vi.mock('@/lib/blog-access', () => ({
  getBlogAdminEmail: mocks.getBlogAdminEmail,
  isUuid: (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value),
}));
vi.mock('@/lib/db', () => ({ query: mocks.query }));
vi.mock('@/components/blog/BlogRichTextPreview', () => ({ default: () => null }));

import AdminBlogPreviewPage from '@/app/admin/blog/preview/[slug]/page';
import AdminBlogChinesePreviewPage from '@/app/admin/blog/preview/[slug]/cn/page';

const postId = '11111111-1111-4111-8111-111111111111';

describe('Admin Blog preview route', () => {
  it('renders the slug preview with the short month label', async () => {
    mocks.getBlogAdminEmail.mockResolvedValue('admin@example.com');
    mocks.query.mockResolvedValueOnce({
      rows: [{
        id: postId,
        title: 'Selling Your Home',
        summary: 'A practical guide',
        content: [{ type: 'paragraph' }],
        author: 'Marie Nian',
        article_month: '2026-11-01',
        reading_minutes: '7',
        category_name: 'Sell',
      }],
    });

    const page = await AdminBlogPreviewPage({
      params: Promise.resolve({ slug: 'selling-your-home' }),
    });
    const { container } = render(page);

    expect(mocks.query.mock.calls[0][1]).toEqual(['selling-your-home', 'en']);
    expect(mocks.query.mock.calls[0][0]).toContain("TO_CHAR(p.article_month, 'YYYY-MM-DD') AS article_month");
    expect(mocks.query.mock.calls[0][0]).toContain('p.language = $2');
    expect(container.textContent).toContain('7 min read • 2026 Nov');
    expect(container.textContent).not.toContain('Monday');
  });

  it('loads the Chinese version separately under its shared base slug', async () => {
    mocks.query.mockClear();
    mocks.getBlogAdminEmail.mockResolvedValue('admin@example.com');
    mocks.query.mockResolvedValueOnce({
      rows: [{
        id: postId,
        title: '在新西兰卖房',
        summary: '实用指南',
        content: [{ type: 'paragraph' }],
        author: 'Marie Nian',
        article_month: '2026-11-01',
        reading_minutes: '6',
        category_name: 'Sell',
      }],
    });

    const page = await AdminBlogChinesePreviewPage({
      params: Promise.resolve({ slug: 'selling-your-home-in-new-zealand' }),
    });
    const { container } = render(page);

    expect(mocks.query.mock.calls[0][1]).toEqual(['selling-your-home-in-new-zealand', 'cn']);
    expect(container.textContent).toContain('在新西兰卖房');
    expect(container.textContent).toContain('6 min read • 2026 Nov');
  });
});

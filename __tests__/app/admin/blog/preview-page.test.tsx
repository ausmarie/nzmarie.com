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
        article_month: new Date('2026-11-01T00:00:00.000Z'),
        reading_minutes: '7',
        category_name: 'Sell',
      }],
    });

    const page = await AdminBlogPreviewPage({
      params: Promise.resolve({ slug: 'selling-your-home' }),
    });
    const { container } = render(page);

    expect(mocks.query.mock.calls[0][1]).toEqual(['selling-your-home']);
    expect(container.textContent).toContain('7 min read • 2026 Nov');
    expect(container.textContent).not.toContain('Monday');
  });
});

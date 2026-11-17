import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock('@/components/blog/BlogEditor', () => ({
  default: () => <div data-testid="blog-editor">Rich text editor</div>,
}));

import BlogAdminPage from '@/components/blog/BlogAdminPage';

const category = {
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Buy',
  slug: 'buy',
  description: '',
  post_count: 0,
};

const post = {
  id: '11111111-1111-4111-8111-111111111111',
  slug: 'draft-11111111',
  title: 'Untitled article',
  summary: '',
  category_id: null,
  category_name: null,
  author: 'Marie Nian',
  article_month: '2026-10-01',
  reading_minutes: 5,
  status: 'draft' as const,
  has_unpublished_changes: false,
  published_at: null,
  updated_at: '2026-10-01T00:00:00.000Z',
  content: [{ type: 'paragraph' }],
};

function configureFetch() {
  const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
    if (input === '/api/admin/blog/posts' && init?.method === 'POST') {
      return { ok: true, json: async () => ({ success: true, id: post.id }) };
    }
    if (input === '/api/admin/blog/posts') {
      return { ok: true, json: async () => ({ success: true, posts: [] }) };
    }
    if (input === '/api/admin/blog/categories') {
      return { ok: true, json: async () => ({ success: true, categories: [category] }) };
    }
    if (input === '/api/admin/analytics/page-views') {
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: {
            home: { total: 0, week: 0, month: 0, year: 0 },
            market: { total: 0, week: 0, month: 0, year: 0 },
            blog: { total: 0, week: 0, month: 0, year: 0 },
            reports: [],
            blog_posts: [{
              id: post.id,
              slug: post.slug,
              title: post.title,
              category_name: 'Buy',
              status: 'published',
              published_at: '2026-10-10T00:00:00.000Z',
              views: { total: 23, week: 4, month: 8, year: 23 },
            }],
          },
        }),
      };
    }
    if (input === `/api/admin/blog/posts/${post.id}`) {
      return { ok: true, json: async () => ({ success: true, post }) };
    }
    throw new Error(`Unexpected fetch: ${input}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('BlogAdminPage', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    mocks.push.mockReset();
  });

  it('creates a draft and opens the article editor', async () => {
    const fetchMock = configureFetch();
    render(<BlogAdminPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Create an article' }));

    const titleInput = await screen.findByLabelText('Title');
    const authorInput = screen.getByLabelText('Author');
    const monthInput = screen.getByLabelText('Article month');
    expect((titleInput as HTMLInputElement).value).toBe('Untitled article');
    expect((authorInput as HTMLInputElement).value).toBe('Marie Nian');
    expect((monthInput as HTMLInputElement).value).toBe('2026-10');
    expect((screen.getByLabelText('Reading time (minutes)') as HTMLInputElement).value).toBe('5');
    expect(screen.getByTestId('blog-editor')).toBeTruthy();
    expect(mocks.push).toHaveBeenCalledWith(`/admin/blog/draft/${post.id}`);
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/blog/posts', { method: 'POST' });
  });

  it('opens category management from the Blog sidebar', async () => {
    configureFetch();
    render(<BlogAdminPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Manage categories' }));

    expect(await screen.findByRole('dialog', { name: 'Manage categories' })).toBeTruthy();
    expect(screen.getByText('/buy · 0 articles')).toBeTruthy();
  });

  it('loads the selected draft for editing', async () => {
    configureFetch();
    render(<BlogAdminPage initialPostId={post.id} />);

    await waitFor(() => {
      expect((screen.getByLabelText('URL slug') as HTMLInputElement).value).toBe('untitled-article');
    });
    expect((screen.getByLabelText('URL slug') as HTMLInputElement).readOnly).toBe(true);
    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'Selling Your Home in New Zealand: A Step-by-Step Guide' },
    });
    expect((screen.getByLabelText('URL slug') as HTMLInputElement).value)
      .toBe('selling-your-home-in-new-zealand');
    expect(screen.getByRole('button', { name: 'Publish' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Article views' }).textContent).toContain('Total: 23');
  });

  it('opens the preview using the article slug in the URL', async () => {
    configureFetch();
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(<BlogAdminPage initialPostId={post.id} />);

    await screen.findByLabelText('Title');
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));

    await waitFor(() => {
      expect(open).toHaveBeenCalledWith(
        '/admin/blog/preview/untitled-article',
        '_blank',
        'noopener,noreferrer',
      );
    });
  });
});

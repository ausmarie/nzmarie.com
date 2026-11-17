import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

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
  language: 'en' as 'en' | 'cn',
  translation_group_id: '11111111-1111-4111-8111-111111111111',
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

const chinesePost = {
  ...post,
  id: '33333333-3333-4333-8333-333333333333',
  language: 'cn' as const,
  title: '未命名文章',
};

function configureFetch(posts: typeof post[] = [], translationPost?: typeof post) {
  let translationCreated = false;
  const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
    if (input === '/api/admin/blog/posts' && init?.method === 'POST') {
      return { ok: true, json: async () => ({ success: true, id: post.id }) };
    }
    if (input === '/api/admin/blog/posts') {
      return {
        ok: true,
        json: async () => ({
          success: true,
          posts: translationCreated && translationPost ? [...posts, translationPost] : posts,
        }),
      };
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
    if (input.endsWith('/translation') && init?.method === 'POST') {
      translationCreated = true;
      return { ok: true, json: async () => ({ success: true, id: translationPost?.id }) };
    }
    if (input.startsWith('/api/admin/blog/posts/') && !input.endsWith('/translation')) {
      if (init?.method === 'PUT') {
        return { ok: true, json: async () => ({ success: true }) };
      }
      const selectedId = input.split('/').pop();
      const selectedPost = [...posts, post, ...(translationPost ? [translationPost] : [])]
        .find((item) => item.id === selectedId);
      if (selectedPost) return { ok: true, json: async () => ({ success: true, post: selectedPost }) };
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
    fireEvent.click(await screen.findByRole('button', { name: 'English' }));

    const titleInput = await screen.findByLabelText('Title');
    const authorInput = screen.getByLabelText('Author');
    const monthInput = screen.getByLabelText('Article month');
    expect((titleInput as HTMLInputElement).value).toBe('Untitled article');
    expect((authorInput as HTMLInputElement).value).toBe('Marie Nian');
    expect((monthInput as HTMLInputElement).value).toBe('2026-10');
    expect((screen.getByLabelText('Reading time (minutes)') as HTMLInputElement).value).toBe('5');
    expect(screen.getByTestId('blog-editor')).toBeTruthy();
    expect(mocks.push).toHaveBeenCalledWith(`/admin/blog/draft/${post.id}`);
    const createCall = fetchMock.mock.calls.find(
      ([input, init]) => input === '/api/admin/blog/posts' && init?.method === 'POST',
    );
    expect(JSON.parse(String(createCall?.[1]?.body))).toEqual({ language: 'en' });
  });

  it('creates a Chinese-first article when Chinese is selected', async () => {
    const fetchMock = configureFetch();
    render(<BlogAdminPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Create an article' }));
    fireEvent.click(await screen.findByRole('button', { name: '中文' }));

    await waitFor(() => {
      const createCall = fetchMock.mock.calls.find(
        ([input, init]) => input === '/api/admin/blog/posts' && init?.method === 'POST',
      );
      expect(JSON.parse(String(createCall?.[1]?.body))).toEqual({ language: 'cn' });
    });
  });

  it('opens category management from the Blog sidebar', async () => {
    configureFetch();
    render(<BlogAdminPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Manage categories' }));

    expect(await screen.findByRole('dialog', { name: 'Manage categories' })).toBeTruthy();
    expect(screen.getByText('/buy · 0 articles')).toBeTruthy();
  });

  it('shows previous articles with edit and preview links on the Blog home', async () => {
    configureFetch([post]);
    render(<BlogAdminPage />);

    const articleList = await screen.findByRole('region', { name: 'Previous articles' });
    expect(within(articleList).getByRole('link', { name: `Edit ${post.title}` }).getAttribute('href'))
      .toBe(`/admin/blog/draft/${post.id}`);
    expect(within(articleList).getByRole('link', { name: `Preview ${post.title}` }).getAttribute('href'))
      .toBe('/admin/blog/preview/draft-11111111');
  });

  it('nests the linked language version beneath its article in the sidebar', async () => {
    configureFetch([post, chinesePost]);
    render(<BlogAdminPage />);

    const sidebar = screen.getByRole('complementary');
    const translatedTitle = await within(sidebar).findByText('未命名文章');
    const translatedArticle = translatedTitle.closest('button');
    expect(translatedArticle).not.toBeNull();
    expect(translatedArticle?.textContent).toContain('中文');
    expect(translatedArticle?.parentElement?.className).toContain('ml-4');
  });

  it('creates and opens the linked Chinese version from an English article', async () => {
    const fetchMock = configureFetch([post], chinesePost);
    render(<BlogAdminPage initialPostId={post.id} />);

    await screen.findByLabelText('Title');
    fireEvent.click(screen.getByRole('button', { name: 'Generate 中文' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/admin/blog/posts/${post.id}/translation`,
        { method: 'POST' },
      );
    });
    expect(mocks.push).toHaveBeenCalledWith(`/admin/blog/draft/${chinesePost.id}`);
    expect(await screen.findByLabelText('Title')).toBeTruthy();
  });

  it('offers the English version when editing a Chinese-first article', async () => {
    const chineseRootPost = {
      ...chinesePost,
      id: '44444444-4444-4444-8444-444444444444',
      translation_group_id: '44444444-4444-4444-8444-444444444444',
    };
    const englishTranslationPost = {
      ...post,
      id: '55555555-5555-4555-8555-555555555555',
      language: 'en' as const,
      translation_group_id: chineseRootPost.translation_group_id,
      title: 'Untitled article',
    };
    const fetchMock = configureFetch([chineseRootPost], englishTranslationPost);
    render(<BlogAdminPage initialPostId={chineseRootPost.id} />);

    await screen.findByLabelText('Title');
    fireEvent.click(screen.getByRole('button', { name: 'Generate English' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/admin/blog/posts/${chineseRootPost.id}/translation`,
        { method: 'POST' },
      );
    });
    expect(mocks.push).toHaveBeenCalledWith(`/admin/blog/draft/${englishTranslationPost.id}`);
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

  it('allows changing the article month and saves the selected value', async () => {
    const fetchMock = configureFetch();
    render(<BlogAdminPage initialPostId={post.id} />);

    const monthInput = await screen.findByLabelText('Article month') as HTMLInputElement;
    fireEvent.change(monthInput, { target: { value: '2026-08' } });

    expect(monthInput.value).toBe('2026-08');
    await waitFor(() => {
      const saveCall = fetchMock.mock.calls.find(
        ([input, init]) => input === `/api/admin/blog/posts/${post.id}` && init?.method === 'PUT',
      );
      expect(saveCall).toBeDefined();
      expect(JSON.parse(String(saveCall?.[1]?.body)).articleMonth).toBe('2026-08');
    }, { timeout: 3000 });
  });

  it('saves the article with Ctrl+S and prevents the browser save dialog', async () => {
    const fetchMock = configureFetch();
    render(<BlogAdminPage initialPostId={post.id} />);
    await screen.findByTestId('blog-editor');

    const event = new KeyboardEvent('keydown', {
      key: 's',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    await waitFor(() => {
      const saveCall = fetchMock.mock.calls.find(
        ([input, init]) => input === `/api/admin/blog/posts/${post.id}` && init?.method === 'PUT',
      );
      expect(saveCall).toBeDefined();
    });
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

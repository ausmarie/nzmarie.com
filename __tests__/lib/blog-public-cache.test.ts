import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  unstableCache: vi.fn((callback: () => unknown) => callback),
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ query: mocks.query }));
vi.mock('next/cache', () => ({
  unstable_cache: mocks.unstableCache,
  revalidateTag: mocks.revalidateTag,
  revalidatePath: mocks.revalidatePath,
}));

import {
  blogArticleCacheTag,
  getPublishedBlogArticle,
  getPublishedBlogCategories,
  getPublishedBlogListing,
  revalidatePublishedBlogCategory,
  revalidatePublishedBlogArticle,
} from '@/lib/blog-public-cache';

describe('published Blog cache', () => {
  beforeEach(() => {
    mocks.query.mockReset();
    mocks.unstableCache.mockClear();
    mocks.revalidateTag.mockReset();
    mocks.revalidatePath.mockReset();
  });

  it('caches category and listing queries by language, category, and page', async () => {
    mocks.query
      .mockResolvedValueOnce({
        rows: [{ id: 'category-id', name: 'Buy', name_cn: '买房', slug: 'buy', sort_order: 0, post_count: '3' }],
      })
      .mockResolvedValueOnce({
        rows: [{
          id: 'post-id',
          published_slug: 'buying-guide',
          language: 'cn',
          translation_group_id: 'group-id',
          published_title: '买房指南',
          published_summary: '摘要',
          published_author: 'Marie',
          article_month: '2026-10-01',
          published_reading_minutes: '6',
          published_at: '2026-10-01T00:00:00.000Z',
          category_id: 'category-id',
          category_slug: 'buy',
          category_name: 'Buy',
          category_name_cn: '买房',
          total_count: '1',
        }],
      });

    await expect(getPublishedBlogCategories('cn')).resolves.toMatchObject([{ post_count: 3 }]);
    await expect(getPublishedBlogListing('cn', 'buy', 1)).resolves.toMatchObject({
      totalCount: 1,
      posts: [{ slug: 'buying-guide', title: '买房指南', reading_minutes: 6 }],
    });

    expect(mocks.unstableCache).toHaveBeenNthCalledWith(
      1,
      expect.any(Function),
      ['published-blog-categories', 'cn'],
      expect.objectContaining({ tags: ['published-blog-list:cn'] }),
    );
    expect(mocks.unstableCache).toHaveBeenNthCalledWith(
      2,
      expect.any(Function),
      ['published-blog-list', 'cn', 'buy', '1'],
      expect.objectContaining({ tags: ['published-blog-list:cn'] }),
    );
    expect(mocks.query.mock.calls[1][0]).toContain("p.status = 'published'");
    expect(mocks.query.mock.calls[1][0]).toContain('p.published_slug IS NOT NULL');
  });

  it('loads published snapshots only and uses a stable article tag', async () => {
    mocks.query.mockResolvedValueOnce({
      rows: [{
        id: 'post-id',
        published_slug: 'selling-guide',
        language: 'en',
        translation_group_id: 'group-id',
        published_title: 'Selling guide',
        published_summary: 'Summary',
        published_author: 'Marie',
        article_month: '2026-11-01',
        published_reading_minutes: 5,
        published_at: '2026-11-01T00:00:00.000Z',
        published_content: [{ type: 'paragraph' }],
        category_id: null,
        category_slug: null,
        category_name: null,
        category_name_cn: null,
        translation_slug: null,
      }],
    });

    await expect(getPublishedBlogArticle('Selling-Guide', 'en')).resolves.toMatchObject({
      slug: 'selling-guide',
      title: 'Selling guide',
      translation_slug: null,
    });
    expect(mocks.unstableCache).toHaveBeenCalledWith(
      expect.any(Function),
      ['published-blog-article', 'en', 'selling-guide'],
      expect.objectContaining({
        tags: [
          blogArticleCacheTag('en', 'selling-guide'),
          'published-blog-category-names:en',
        ],
      }),
    );
    expect(mocks.query.mock.calls[0][0]).toContain('p.published_content');
    expect(mocks.query.mock.calls[0][0]).toContain("p.status = 'published'");
  });

  it('invalidates listing, article, translation, and route caches after publishing', () => {
    revalidatePublishedBlogArticle(
      'en',
      'new-guide',
      { language: 'cn', slug: 'chinese-guide' },
      'old-guide',
    );

    expect(mocks.revalidateTag).toHaveBeenCalledWith('published-blog-list:en');
    expect(mocks.revalidateTag).toHaveBeenCalledWith(blogArticleCacheTag('en', 'old-guide'));
    expect(mocks.revalidateTag).toHaveBeenCalledWith(blogArticleCacheTag('cn', 'chinese-guide'));
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/blog/new-guide', 'page');
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/blog/chinese-guide/cn', 'page');
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/blog/cn', 'page');
  });

  it('invalidates both languages after a category is updated', () => {
    revalidatePublishedBlogCategory();

    expect(mocks.revalidateTag).toHaveBeenCalledWith('published-blog-list:en');
    expect(mocks.revalidateTag).toHaveBeenCalledWith('published-blog-list:cn');
    expect(mocks.revalidateTag).toHaveBeenCalledWith('published-blog-category-names:en');
    expect(mocks.revalidateTag).toHaveBeenCalledWith('published-blog-sidebar:cn');
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/blog/[slug]/cn', 'page');
  });
});

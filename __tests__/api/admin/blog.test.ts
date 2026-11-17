import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  query: vi.fn(),
  isSuperAdmin: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ auth: mocks.auth }));
vi.mock('@/lib/db', () => ({ query: mocks.query }));
vi.mock('@/lib/permissions', () => ({ isSuperAdmin: mocks.isSuperAdmin }));

import { GET as getCategories, POST as createCategory } from '@/app/api/admin/blog/categories/route';
import { DELETE as deleteCategory, PUT as updateCategory } from '@/app/api/admin/blog/categories/[id]/route';
import { POST as createPost } from '@/app/api/admin/blog/posts/route';
import { GET as getPost, PUT as updatePost } from '@/app/api/admin/blog/posts/[id]/route';
import { POST as publishPost } from '@/app/api/admin/blog/posts/[id]/publish/route';

const id = '11111111-1111-4111-8111-111111111111';
const categoryId = '22222222-2222-4222-8222-222222222222';
const articleContent = [{ type: 'paragraph', content: [{ type: 'text', text: 'A practical Auckland property guide.' }] }];

function request(body: unknown, method = 'POST'): Request {
  return new Request('http://localhost/api/admin/blog', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function context(postId = id) {
  return { params: Promise.resolve({ id: postId }) };
}

describe('Blog admin APIs', () => {
  beforeEach(() => {
    mocks.auth.mockReset();
    mocks.query.mockReset();
    mocks.isSuperAdmin.mockReset();
    mocks.auth.mockResolvedValue({ user: { email: 'admin@example.com' } });
    mocks.isSuperAdmin.mockReturnValue(true);
  });

  it('requires an authorised admin before reading categories', async () => {
    mocks.isSuperAdmin.mockReturnValue(false);

    const response = await getCategories();

    expect(response.status).toBe(403);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it('normalizes and stores new categories', async () => {
    mocks.query.mockResolvedValueOnce({ rows: [{ id: categoryId, name: 'Buying Advice', slug: 'buying-advice' }] });

    const response = await createCategory(request({ name: 'Buying Advice', description: 'Buyer guidance' }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.category.slug).toBe('buying-advice');
    expect(mocks.query.mock.calls[0][1]).toEqual(['Buying Advice', 'buying-advice', 'Buyer guidance', 'admin@example.com']);
  });

  it('prevents deleting categories that still have articles', async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: categoryId }] });

    const response = await deleteCategory(new Request('http://localhost'), context(categoryId));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toContain('Move or delete');
  });

  it('updates category metadata', async () => {
    mocks.query.mockResolvedValueOnce({
      rows: [{ id: categoryId, name: 'Buying Tips', slug: 'buying-tips', description: 'Buyer advice' }],
    });

    const response = await updateCategory(
      request({ name: 'Buying Tips', slug: 'Buying Tips', description: 'Buyer advice' }, 'PUT'),
      context(categoryId),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.category.slug).toBe('buying-tips');
  });

  it('creates a new Blog article as a draft', async () => {
    mocks.query.mockResolvedValueOnce({ rows: [{ id }] });

    const response = await createPost();
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.id).toBe(id);
    expect(mocks.query.mock.calls[0][1][0]).toBe('untitled-article');
  });

  it('returns reading time fields as numbers', async () => {
    mocks.query.mockResolvedValueOnce({
      rows: [{ id, reading_minutes: '7', published_reading_minutes: '6' }],
    });

    const response = await getPost(new Request('http://localhost'), context());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.post.reading_minutes).toBe(7);
    expect(body.post.published_reading_minutes).toBe(6);
  });

  it('rejects invalid article month values without writing', async () => {
    const response = await updatePost(request({
      title: 'Market guide',
      slug: 'market-guide',
      summary: 'A short summary',
      author: 'Marie Nian',
      articleMonth: '2026-13',
      readingMinutes: 5,
      categoryId,
      content: articleContent,
    }, 'PUT'), context());

    expect(response.status).toBe(400);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it('derives the saved slug from the title and validates reading time', async () => {
    mocks.query.mockResolvedValueOnce({ rows: [{ id, status: 'draft' }] });
    const response = await updatePost(request({
      title: 'Selling Your Home in New Zealand: A Step-by-Step Guide',
      slug: 'user-controlled-value',
      summary: 'A practical summary',
      author: 'Marie Nian',
      articleMonth: '2026-10',
      readingMinutes: 7,
      categoryId,
      content: articleContent,
    }, 'PUT'), context());

    expect(response.status).toBe(200);
    expect(mocks.query.mock.calls[0][0]).toContain('reading_minutes = $9');
    expect(mocks.query.mock.calls[0][1]).toEqual([
      id,
      'selling-your-home-in-new-zealand',
      'Selling Your Home in New Zealand: A Step-by-Step Guide',
      'A practical summary',
      JSON.stringify(articleContent),
      categoryId,
      'Marie Nian',
      '2026-10-01',
      7,
      'admin@example.com',
    ]);
  });

  it('rejects a reading time outside the allowed range without writing', async () => {
    const response = await updatePost(request({
      title: 'Market guide',
      summary: 'A practical summary',
      author: 'Marie Nian',
      articleMonth: '2026-10',
      readingMinutes: 0,
      categoryId,
      content: articleContent,
    }, 'PUT'), context());

    expect(response.status).toBe(400);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it('requires a summary, category, author, and text before publishing', async () => {
    mocks.query.mockResolvedValueOnce({
      rows: [{
        slug: 'buying-guide',
        title: 'Buying guide',
        summary: '',
        content: [],
        category_id: categoryId,
        author: 'Marie Nian',
        article_month: '2026-11-01',
        reading_minutes: 5,
        updated_at: '2026-11-01T00:00:00.000Z',
      }],
    });

    const response = await publishPost(new Request('http://localhost'), context());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('summary');
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });

  it('publishes the saved article snapshot with an optimistic concurrency check', async () => {
    mocks.query
      .mockResolvedValueOnce({
        rows: [{
          slug: 'buying-guide',
          title: 'Buying guide',
          summary: 'A practical guide',
          content: articleContent,
          category_id: categoryId,
          author: 'Marie Nian',
          article_month: '2026-11-01',
          updated_at: '2026-11-01T00:00:00.000Z',
        }],
      })
      .mockResolvedValueOnce({ rows: [{ id, status: 'published', published_at: '2026-11-01T01:00:00.000Z' }] });

    const response = await publishPost(new Request('http://localhost'), context());

    expect(response.status).toBe(200);
    expect(mocks.query.mock.calls[1][0]).toContain('published_content = content');
    expect(mocks.query.mock.calls[1][0]).toContain('published_reading_minutes = reading_minutes');
    expect(mocks.query.mock.calls[1][0]).toContain('updated_at = $2');
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
}));

import { query } from '@/lib/db';
import { POST } from '../../app/api/track-page-view/route';

const eventId = 'c0a80123-4567-489a-8abc-0123456789ab';

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/track-page-view', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/track-page-view', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(query).mockResolvedValue({ rows: [], rowCount: 1 } as never);
  });

  it('records English and Chinese home page views using canonical paths', async () => {
    const english = await POST(makeRequest({
      eventId,
      pageType: 'home',
      language: 'en',
    }));
    const chinese = await POST(makeRequest({
      eventId: 'c0a80123-4567-489a-8abc-0123456789ac',
      pageType: 'home',
      language: 'zh',
    }));

    expect(english.status).toBe(204);
    expect(chinese.status).toBe(204);
    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('ON CONFLICT (event_id) DO NOTHING'),
      [eventId, 'en', '/'],
    );
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.any(String),
      ['c0a80123-4567-489a-8abc-0123456789ac', 'zh', '/cn'],
    );
  });

  it('only records published reports and stores the normalized language URL', async () => {
    const response = await POST(makeRequest({
      eventId,
      pageType: 'market_report',
      language: 'zh',
      slug: 'October-2026',
    }));

    expect(response.status).toBe(204);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("status = 'published'"),
      [eventId, 'monthly', '2026-10', 'zh', '/market-reports/october-2026/cn'],
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT (event_id) DO NOTHING'),
      expect.any(Array),
    );
  });

  it('only records published Blog articles by their published slug', async () => {
    const response = await POST(makeRequest({
      eventId,
      pageType: 'blog_article',
      language: 'en',
      slug: 'selling-guide',
    }));

    expect(response.status).toBe(204);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE published_slug = $2 AND status = 'published'"),
      [eventId, 'selling-guide', 'en', '/blog/selling-guide'],
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT (event_id) DO NOTHING'),
      expect.any(Array),
    );
  });

  it('rejects invalid event IDs, unsupported pages, and malformed report slugs', async () => {
    const badId = await POST(makeRequest({
      eventId: 'not-a-uuid',
      pageType: 'home',
      language: 'en',
    }));
    const unsupportedPage = await POST(makeRequest({
      eventId,
      pageType: 'preview',
      language: 'en',
    }));
    const badSlug = await POST(makeRequest({
      eventId,
      pageType: 'market_report',
      language: 'en',
      slug: 'not-a-period',
    }));
    const badBlogSlug = await POST(makeRequest({
      eventId,
      pageType: 'blog_article',
      language: 'en',
      slug: 'Not A Slug',
    }));

    expect(badId.status).toBe(400);
    expect(unsupportedPage.status).toBe(400);
    expect(badSlug.status).toBe(400);
    expect(badBlogSlug.status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });
});

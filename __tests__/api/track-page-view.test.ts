import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/page-view-queue', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/page-view-queue')>();
  return { ...actual, enqueuePageViewEvent: vi.fn() };
});

import { enqueuePageViewEvent } from '@/lib/page-view-queue';
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
    vi.mocked(enqueuePageViewEvent).mockResolvedValue();
  });

  it('queues English and Chinese home page views', async () => {
    const english = await POST(makeRequest({
      eventId,
      pageType: 'home',
      language: 'en',
    }));
    const chineseEvent = {
      eventId: 'c0a80123-4567-489a-8abc-0123456789ac',
      pageType: 'home',
      language: 'zh',
    } as const;
    const chinese = await POST(makeRequest(chineseEvent));

    expect(english.status).toBe(204);
    expect(chinese.status).toBe(204);
    expect(enqueuePageViewEvent).toHaveBeenNthCalledWith(1, {
      eventId,
      pageType: 'home',
      language: 'en',
    });
    expect(enqueuePageViewEvent).toHaveBeenNthCalledWith(2, chineseEvent);
  });

  it('queues validated report and Blog article events', async () => {
    const report = {
      eventId,
      pageType: 'market_report',
      language: 'zh',
      slug: 'October-2026',
    } as const;
    const blog = {
      eventId,
      pageType: 'blog_article',
      language: 'en',
      slug: 'selling-guide',
    } as const;

    expect((await POST(makeRequest(report))).status).toBe(204);
    expect((await POST(makeRequest(blog))).status).toBe(204);
    expect(enqueuePageViewEvent).toHaveBeenNthCalledWith(1, report);
    expect(enqueuePageViewEvent).toHaveBeenNthCalledWith(2, blog);
  });

  it('rejects invalid event IDs, unsupported pages, and malformed slugs', async () => {
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
    expect(enqueuePageViewEvent).not.toHaveBeenCalled();
  });

  it('returns service unavailable when Redis enqueue fails', async () => {
    vi.mocked(enqueuePageViewEvent).mockRejectedValueOnce(new Error('Redis unavailable'));

    const response = await POST(makeRequest({
      eventId,
      pageType: 'home',
      language: 'en',
    }));

    expect(response.status).toBe(503);
  });
});

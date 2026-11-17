import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  redis: {
    xadd: vi.fn(),
    xgroup: vi.fn(),
    xreadgroup: vi.fn(),
    xack: vi.fn(),
    xdel: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({ query: mocks.query }));
vi.mock('@/lib/redis', () => ({ redis: mocks.redis }));

import {
  enqueuePageViewEvent,
  isPageViewPayload,
  processPageViewQueueBatch,
} from '@/lib/page-view-queue';

const streamKey = 'page-view-events';
const validEventId = 'c0a80123-4567-489a-8abc-0123456789ab';

function streamResponse(events: Array<{ id: string; event: unknown }>) {
  return [[
    streamKey,
    events.map(({ id, event }) => [id, ['payload', JSON.stringify(event)]]),
  ]];
}

describe('page-view event queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.redis.xadd.mockResolvedValue('1-0');
    mocks.redis.xgroup.mockResolvedValue('OK');
    mocks.redis.xreadgroup.mockResolvedValue([]);
    mocks.redis.xack.mockResolvedValue(1);
    mocks.redis.xdel.mockResolvedValue(1);
    mocks.query.mockResolvedValue({ rows: [], rowCount: 1 });
  });

  it('validates event payloads before they can be queued', () => {
    expect(isPageViewPayload({ eventId: validEventId, pageType: 'home', language: 'en' })).toBe(true);
    expect(isPageViewPayload({
      eventId: validEventId,
      pageType: 'market_report',
      language: 'zh',
      slug: 'October-2026',
    })).toBe(true);
    expect(isPageViewPayload({
      eventId: validEventId,
      pageType: 'blog_article',
      language: 'en',
      slug: 'Not A Slug',
    })).toBe(false);
    expect(isPageViewPayload({ eventId: 'invalid', pageType: 'home', language: 'en' })).toBe(false);
  });

  it('adds validated events to the Redis stream', async () => {
    const event = { eventId: validEventId, pageType: 'home', language: 'en' } as const;

    await enqueuePageViewEvent(event);

    expect(mocks.redis.xadd).toHaveBeenCalledWith(streamKey, '*', {
      payload: JSON.stringify(event),
    });
  });

  it('batch-inserts mixed event types and only acknowledges after database writes', async () => {
    const events = [
      { eventId: validEventId, pageType: 'home', language: 'en' },
      {
        eventId: 'c0a80123-4567-489a-8abc-0123456789ac',
        pageType: 'market_report',
        language: 'zh',
        slug: 'October-2026',
      },
      {
        eventId: 'c0a80123-4567-489a-8abc-0123456789ad',
        pageType: 'blog_article',
        language: 'en',
        slug: 'selling-guide',
      },
    ];
    mocks.redis.xreadgroup
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(streamResponse(events.map((event, index) => ({
        id: `${index + 1}-0`,
        event,
      }))));

    await expect(processPageViewQueueBatch()).resolves.toBe(3);

    expect(mocks.redis.xgroup).toHaveBeenCalledWith(streamKey, {
      type: 'CREATE',
      group: 'page-view-database-writer',
      id: '0',
      options: { MKSTREAM: true },
    });
    expect(mocks.query).toHaveBeenCalledTimes(3);
    expect(mocks.query.mock.calls[0][0]).toContain("SELECT event_id, 'home'");
    expect(mocks.query.mock.calls[1][0]).toContain("reports.status = 'published'");
    expect(mocks.query.mock.calls[1][1]).toEqual([
      'c0a80123-4567-489a-8abc-0123456789ac',
      'monthly',
      '2026-10',
      'zh',
      '/market-reports/october-2026/cn',
    ]);
    expect(mocks.query.mock.calls[2][0]).toContain("posts.status = 'published'");
    expect(mocks.redis.xack).toHaveBeenCalledWith(streamKey, 'page-view-database-writer', ['1-0', '2-0', '3-0']);
    expect(mocks.redis.xdel).toHaveBeenCalledWith(streamKey, ['1-0', '2-0', '3-0']);
    const queryCallOrder = mocks.query.mock.invocationCallOrder;
    expect(queryCallOrder[queryCallOrder.length - 1]).toBeLessThan(
      mocks.redis.xack.mock.invocationCallOrder[0],
    );
  });

  it('retries unacknowledged events when a database batch fails', async () => {
    const event = { eventId: validEventId, pageType: 'home', language: 'en' };
    mocks.redis.xreadgroup
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(streamResponse([{ id: '4-0', event }]));
    mocks.query.mockRejectedValueOnce(new Error('database unavailable'));

    await expect(processPageViewQueueBatch()).rejects.toThrow('database unavailable');

    expect(mocks.redis.xack).not.toHaveBeenCalled();
    expect(mocks.redis.xdel).not.toHaveBeenCalled();
  });

  it('processes the current consumer pending entries before reading new ones', async () => {
    const event = { eventId: validEventId, pageType: 'home', language: 'en' };
    mocks.redis.xreadgroup.mockResolvedValueOnce(streamResponse([{ id: '5-0', event }]));

    await expect(processPageViewQueueBatch()).resolves.toBe(1);

    expect(mocks.redis.xreadgroup).toHaveBeenCalledTimes(1);
    expect(mocks.redis.xreadgroup).toHaveBeenCalledWith(
      'page-view-database-writer',
      'vercel-cron',
      streamKey,
      '0',
      { count: 100 },
    );
  });
});

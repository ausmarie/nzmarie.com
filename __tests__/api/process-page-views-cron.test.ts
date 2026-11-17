import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ processBatch: vi.fn() }));

vi.mock('@/lib/page-view-queue', () => ({
  processPageViewQueueBatch: mocks.processBatch,
}));

import { GET } from '@/app/api/cron/process-page-views/route';

describe('GET /api/cron/process-page-views', () => {
  const originalSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'test-secret';
    mocks.processBatch.mockResolvedValue(0);
  });

  it('rejects unauthorized and unconfigured cron requests', async () => {
    const unauthorized = await GET(new Request('http://localhost/api/cron/process-page-views'));
    expect(unauthorized.status).toBe(401);

    delete process.env.CRON_SECRET;
    const unconfigured = await GET(new Request('http://localhost/api/cron/process-page-views', {
      headers: { authorization: 'Bearer undefined' },
    }));
    expect(unconfigured.status).toBe(401);
  });

  it('drains multiple batches until the stream is empty', async () => {
    mocks.processBatch
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(0);

    const response = await GET(new Request('http://localhost/api/cron/process-page-views', {
      headers: { authorization: 'Bearer test-secret' },
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      processed: 105,
      batches: 2,
    });
    expect(mocks.processBatch).toHaveBeenCalledTimes(3);
  });

  it('returns an error when queue processing fails', async () => {
    mocks.processBatch.mockRejectedValueOnce(new Error('database unavailable'));

    const response = await GET(new Request('http://localhost/api/cron/process-page-views', {
      headers: { authorization: 'Bearer test-secret' },
    }));

    expect(response.status).toBe(500);
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalSecret;
  });
});

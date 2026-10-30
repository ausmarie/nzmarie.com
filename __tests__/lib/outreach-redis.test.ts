import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockRedisInstance } = vi.hoisted(() => {
  process.env.UPSTASH_REDIS_REST_URL = 'https://fake-redis.upstash.io';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'fake-token';
  const mockRedisInstance = {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    sadd: vi.fn(),
    smembers: vi.fn(),
    expire: vi.fn(),
  };
  return { mockRedisInstance };
});

vi.mock('@upstash/redis', () => ({
  Redis: vi.fn(() => mockRedisInstance),
}));

import {
  outreachCardsKey,
  getOutreachCardsFromCache,
  setOutreachCardsInCache,
  invalidateOutreachCardsForSuburb,
  invalidateStreetClustersForSuburb,
  getDashboardStatsCached,
} from '@/lib/redis';

describe('Outreach Redis Cache Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates consistent outreach cards keys', () => {
    const key = outreachCardsKey('Pinehill', 'status=pending&street=Pinehill+Way');
    expect(key).toBe('outreach_cards:pinehill:status=pending&street=Pinehill+Way');
  });

  it('reads cached data as JSON or object', async () => {
    mockRedisInstance.get.mockResolvedValueOnce(JSON.stringify({ success: true, data: [{ id: '1' }] }));
    const result = await getOutreachCardsFromCache<{ success: boolean; data: any[] }>('test-key');
    expect(result).toEqual({ success: true, data: [{ id: '1' }] });
    expect(mockRedisInstance.get).toHaveBeenCalledWith('test-key');
  });

  it('stores card data in redis and tracks key in suburb set', async () => {
    await setOutreachCardsInCache('Pinehill', 'outreach_cards:pinehill:query1', { success: true });
    expect(mockRedisInstance.set).toHaveBeenCalledWith(
      'outreach_cards:pinehill:query1',
      JSON.stringify({ success: true }),
      { ex: 1800 }
    );
    expect(mockRedisInstance.sadd).toHaveBeenCalledWith(
      'outreach_cards_keys:pinehill',
      'outreach_cards:pinehill:query1'
    );
    expect(mockRedisInstance.expire).toHaveBeenCalledWith('outreach_cards_keys:pinehill', 3600);
  });

  it('invalidates all tracked card keys for a suburb', async () => {
    mockRedisInstance.smembers.mockResolvedValueOnce([
      'outreach_cards:pinehill:q1',
      'outreach_cards:pinehill:q2',
    ]);

    await invalidateOutreachCardsForSuburb('Pinehill');

    expect(mockRedisInstance.smembers).toHaveBeenCalledWith('outreach_cards_keys:pinehill');
    expect(mockRedisInstance.del).toHaveBeenCalledWith(
      'outreach_cards:pinehill:q1',
      'outreach_cards:pinehill:q2'
    );
    expect(mockRedisInstance.del).toHaveBeenCalledWith('outreach_cards_keys:pinehill');
  });

  it('invalidates outreach cards when invalidateStreetClustersForSuburb is called', async () => {
    mockRedisInstance.smembers
      .mockResolvedValueOnce(['cluster-key-1'])
      .mockResolvedValueOnce(['card-key-1']);

    await invalidateStreetClustersForSuburb('Pinehill');

    expect(mockRedisInstance.smembers).toHaveBeenCalledWith('outreach_cards_keys:pinehill');
    expect(mockRedisInstance.del).toHaveBeenCalledWith('card-key-1');
  });
});

describe('getDashboardStatsCached', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs the dashboard aggregation once for overlapping requests', async () => {
    mockRedisInstance.get.mockResolvedValue(null);
    let resolveFetch: (value: { total: number }) => void = () => {};
    const fetchFn = vi.fn(
      () => new Promise<{ total: number }>((resolve) => {
        resolveFetch = resolve;
      })
    );

    const first = getDashboardStatsCached('dashboard:stats:v6:all:all', fetchFn, 600);
    const second = getDashboardStatsCached('dashboard:stats:v6:all:all', fetchFn, 600);

    await vi.waitFor(() => expect(mockRedisInstance.get).toHaveBeenCalled());
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(mockRedisInstance.get).toHaveBeenCalledTimes(1);

    resolveFetch({ total: 2641 });
    await expect(first).resolves.toEqual({ total: 2641 });
    await expect(second).resolves.toEqual({ total: 2641 });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('allows a fresh compute after the previous one settled', async () => {
    mockRedisInstance.get.mockResolvedValue(null);
    const fetchFn = vi.fn(async () => ({ total: 1 }));

    await getDashboardStatsCached('dashboard:stats:v6:all:all', fetchFn, 600);
    await getDashboardStatsCached('dashboard:stats:v6:all:all', fetchFn, 600);

    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('does not share in-flight work between different filter keys', async () => {
    mockRedisInstance.get.mockResolvedValue(null);
    const fetchFn = vi.fn(async () => ({ total: 1 }));

    await Promise.all([
      getDashboardStatsCached('dashboard:stats:v6:all:all', fetchFn, 600),
      getDashboardStatsCached('dashboard:stats:v6:torbay:all', fetchFn, 600),
    ]);

    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});

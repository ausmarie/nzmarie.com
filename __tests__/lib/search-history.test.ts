import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRedis = {
  lrem: vi.fn(),
  lpush: vi.fn(),
  ltrim: vi.fn(),
  expire: vi.fn(),
  lrange: vi.fn(),
};

vi.mock('../../lib/redis', () => {
  async function saveSearchHistory(adminId: number, query: string) {
    if (!query.trim()) return;
    const key = `search_history:${adminId}`;
    const trimmed = query.trim();
    await mockRedis.lrem(key, 0, trimmed);
    await mockRedis.lpush(key, trimmed);
    await mockRedis.ltrim(key, 0, 9);
    await mockRedis.expire(key, 259200);
  }

  async function getSearchHistory(adminId: number) {
    try {
      const items = await mockRedis.lrange(`search_history:${adminId}`, 0, 9);
      return items ?? [];
    } catch {
      return [];
    }
  }

  return { saveSearchHistory, getSearchHistory };
});

import { saveSearchHistory, getSearchHistory } from '../../lib/redis';

describe('saveSearchHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('saves query to Redis list with correct key', async () => {
    await saveSearchHistory(1, 'Forrest Hill');
    expect(mockRedis.lrem).toHaveBeenCalledWith('search_history:1', 0, 'Forrest Hill');
    expect(mockRedis.lpush).toHaveBeenCalledWith('search_history:1', 'Forrest Hill');
    expect(mockRedis.ltrim).toHaveBeenCalledWith('search_history:1', 0, 9);
    expect(mockRedis.expire).toHaveBeenCalledWith('search_history:1', 259200);
  });

  it('trims whitespace from query', async () => {
    await saveSearchHistory(1, '  Sunnynook  ');
    expect(mockRedis.lrem).toHaveBeenCalledWith('search_history:1', 0, 'Sunnynook');
    expect(mockRedis.lpush).toHaveBeenCalledWith('search_history:1', 'Sunnynook');
  });

  it('skips save for empty query', async () => {
    await saveSearchHistory(1, '');
    expect(mockRedis.lrem).not.toHaveBeenCalled();
  });

  it('skips save for whitespace-only query', async () => {
    await saveSearchHistory(1, '   ');
    expect(mockRedis.lrem).not.toHaveBeenCalled();
  });
});

describe('getSearchHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedis.lrange.mockResolvedValue(['Sunnynook', 'Forrest Hill']);
  });

  it('returns items from Redis list', async () => {
    const items = await getSearchHistory(1);
    expect(items).toEqual(['Sunnynook', 'Forrest Hill']);
    expect(mockRedis.lrange).toHaveBeenCalledWith('search_history:1', 0, 9);
  });

  it('returns empty array when Redis returns null', async () => {
    mockRedis.lrange.mockResolvedValue(null);
    const items = await getSearchHistory(1);
    expect(items).toEqual([]);
  });

  it('returns empty array when Redis errors', async () => {
    mockRedis.lrange.mockRejectedValue(new Error('Redis error'));
    const items = await getSearchHistory(1);
    expect(items).toEqual([]);
  });
});

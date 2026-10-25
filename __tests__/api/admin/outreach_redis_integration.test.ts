import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/admin/outreach/route';
import { POST as PrefetchPOST } from '@/app/api/admin/outreach/prefetch/route';
import { PATCH } from '@/app/api/admin/outreach/[id]/route';
import { auth } from '@/lib/auth';
import { marieDB } from '@/lib/db';
import * as redisModule from '@/lib/redis';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  marieDB: {
    query: vi.fn(),
    ensureOutreachTablesExist: vi.fn(),
  },
}));

vi.mock('@/lib/permissions', () => ({
  isAdmin: vi.fn().mockReturnValue(true),
}));

vi.mock('@/lib/redis', async (importOriginal) => {
  const actual = await importOriginal<typeof redisModule>();
  return {
    ...actual,
    getOutreachCardsFromCache: vi.fn(),
    setOutreachCardsInCache: vi.fn().mockResolvedValue(undefined),
    invalidateStreetClustersForSuburb: vi.fn().mockResolvedValue(undefined),
    invalidateOutreachCardsForSuburb: vi.fn().mockResolvedValue(undefined),
  };
});

function mockAuth() {
  vi.mocked(auth).mockResolvedValue({
    user: { email: 'nzlouis.com@gmail.com' },
  } as any);
}

describe('Outreach Redis Caching and Prefetch API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.USE_OUTREACH_MV = 'true';
  });

  it('returns cached data on Redis cache hit with X-Cache: HIT', async () => {
    mockAuth();

    const cachedData = {
      success: true,
      data: [{ id: '1', property_address: '10 Pinehill Way', suburb: 'Pinehill' }],
      pagination: { page: 1, limit: 18, total: 1 },
    };

    vi.mocked(redisModule.getOutreachCardsFromCache).mockResolvedValueOnce(cachedData as any);

    const response = await GET(
      new Request('http://localhost:3000/api/admin/outreach?suburb=Pinehill&street=Pinehill+Way&limit=18')
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('X-Cache')).toBe('HIT');
    const json = await response.json();
    expect(json.data[0].property_address).toBe('10 Pinehill Way');
    expect(marieDB.query).not.toHaveBeenCalled();
  });

  it('queries DB, caches to Redis, and returns X-Cache: MISS on cache miss', async () => {
    mockAuth();

    vi.mocked(redisModule.getOutreachCardsFromCache).mockResolvedValueOnce(null);
    vi.mocked(marieDB.query)
      .mockResolvedValueOnce({ rows: [{ id: '2', property_address: '12 Pinehill Way', suburb: 'Pinehill' }] } as any)
      .mockResolvedValueOnce({ rows: [{ total: '1' }] } as any);

    const response = await GET(
      new Request('http://localhost:3000/api/admin/outreach?suburb=Pinehill&street=Pinehill+Way&limit=18')
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('X-Cache')).toBe('MISS');
    const json = await response.json();
    expect(json.data[0].property_address).toBe('12 Pinehill Way');
    expect(redisModule.setOutreachCardsInCache).toHaveBeenCalled();
  });

  it('prefetches multiple nearby streets and warms Redis cache', async () => {
    mockAuth();

    vi.mocked(redisModule.getOutreachCardsFromCache).mockResolvedValue(null);
    vi.mocked(marieDB.query).mockResolvedValue({
      rows: [{ id: '10', property_address: '5 Amante Crescent', suburb: 'Pinehill' }],
    } as any);

    const response = await PrefetchPOST(
      new Request('http://localhost:3000/api/admin/outreach/prefetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suburb: 'Pinehill',
          streets: ['Amante Crescent', 'Annalong Road'],
          status: 'pending',
          sent_status: 'unsent',
        }),
      })
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.prefetched).toEqual(['Amante Crescent', 'Annalong Road']);
    expect(redisModule.setOutreachCardsInCache).toHaveBeenCalledTimes(2);
  });

  it('updates properties.no_junk_mail and invalidates cache when no_junk_mail is patched', async () => {
    mockAuth();

    vi.mocked(marieDB.query)
      .mockResolvedValueOnce({
        rows: [{ id: 'outreach-1', property_id: 'prop-uuid-1', suburb: 'Pinehill' }],
      } as any)
      .mockResolvedValueOnce({ rows: [] } as any);

    const response = await PATCH(
      new Request('http://localhost:3000/api/admin/outreach/outreach-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ no_junk_mail: true }),
      }),
      { params: Promise.resolve({ id: 'outreach-1' }) }
    );

    expect(response.status).toBe(200);
    const queries = vi.mocked(marieDB.query).mock.calls;
    expect(queries.some((call) => String(call[0]).includes('UPDATE properties SET no_junk_mail'))).toBe(true);
    expect(redisModule.invalidateStreetClustersForSuburb).toHaveBeenCalledWith('Pinehill');
  });

  it('updates properties by address fallback when property_address and suburb are present', async () => {
    mockAuth();

    vi.mocked(marieDB.query)
      .mockResolvedValueOnce({
        rows: [{ id: 'outreach-2', property_id: null, property_address: '3 Infidel Place', suburb: 'Torbay' }],
      } as any)
      .mockResolvedValueOnce({ rows: [] } as any);

    const response = await PATCH(
      new Request('http://localhost:3000/api/admin/outreach/outreach-2', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ no_junk_mail: true }),
      }),
      { params: Promise.resolve({ id: 'outreach-2' }) }
    );

    expect(response.status).toBe(200);
    const queries = vi.mocked(marieDB.query).mock.calls;
    expect(queries.some((call) => String(call[0]).includes('LOWER(TRIM(address)) = LOWER(TRIM($2))'))).toBe(true);
    expect(redisModule.invalidateStreetClustersForSuburb).toHaveBeenCalledWith('Torbay');
  });
});

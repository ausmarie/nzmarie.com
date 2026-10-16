import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '@/app/api/admin/properties/street/route';
import { clearCache as clearSuburbanStreetCache } from '@/lib/suburb-street-cache';
import { auth } from '@/lib/auth';
import { query } from '@/lib/db';
import {
  getSuburbStreetsFromCache,
  setSuburbStreetsInCache,
  deleteSuburbStreetsFromCache,
} from '@/lib/redis';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
}));

vi.mock('@/lib/permissions', () => ({
  isAdmin: vi.fn().mockReturnValue(true),
}));

vi.mock('@/lib/redis', () => ({
  getSuburbStreetsFromCache: vi.fn(),
  setSuburbStreetsInCache: vi.fn(),
  deleteSuburbStreetsFromCache: vi.fn(),
}));

function mockAuth() {
  vi.mocked(auth).mockResolvedValue({ user: { email: 'admin@test.com' } } as any);
}

function addressRows(street: string, count: number, lat: number, lng: number) {
  return Array.from({ length: count }, (_, i) => ({
    address: `${i + 1} ${street}`,
    lat: String(lat),
    lng: String(lng),
  }));
}

const TORBAY_ROWS = [
  ...addressRows('Alpha Street', 5, -36.6958, 174.7453),
  ...addressRows('Beta Street', 3, -36.6962, 174.7456),
  ...addressRows('Gamma Road', 4, -36.71, 174.74),
];

// Order-independent DB mock keyed on SQL shape. The route makes two concurrent
// queries (street rows + saved start), and the redis L2 lookup suspends before
// those queries fire, so relying on mockResolvedValueOnce ordering is fragile.
function setupAddressMock(rows = TORBAY_ROWS, savedStart = '') {
  vi.mocked(query).mockImplementation(async (sql: any) => {
    const s = String(sql);
    if (s.includes('FROM properties p')) {
      return { rows } as any;
    }
    if (s.includes('admin_settings')) {
      return { rows: savedStart ? [{ setting_value: savedStart }] : [] } as any;
    }
    return { rows: [] } as any;
  });
}

describe('Properties Street API — GET', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(query).mockReset();
    vi.mocked(getSuburbStreetsFromCache).mockReset();
    vi.mocked(setSuburbStreetsInCache).mockReset();
    vi.mocked(deleteSuburbStreetsFromCache).mockReset();
    clearSuburbanStreetCache();
  });

  it('calls the DB on the first request for a suburb', async () => {
    mockAuth();
    setupAddressMock();

    const res = await GET(new Request('http://localhost/api/admin/properties/street?suburb=Torbay'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.streets.length).toBeGreaterThan(0);
    expect(vi.mocked(query)).toHaveBeenCalledWith(
      expect.stringContaining('FROM properties p'),
      ['Torbay'],
    );
  });

  it('returns correct street counts', async () => {
    mockAuth();
    setupAddressMock();

    const res = await GET(new Request('http://localhost/api/admin/properties/street?suburb=Torbay&limit=50'));
    const body = await res.json();
    const alpha = body.streets.find((s: { street: string }) => s.street === 'Alpha Street');
    const beta = body.streets.find((s: { street: string }) => s.street === 'Beta Street');
    const gamma = body.streets.find((s: { street: string }) => s.street === 'Gamma Road');

    expect(alpha?.count).toBe(5);
    expect(beta?.count).toBe(3);
    expect(gamma?.count).toBe(4);
  });

  it('returns allStreetNames sorted alphabetically', async () => {
    mockAuth();
    setupAddressMock();

    const res = await GET(new Request('http://localhost/api/admin/properties/street?suburb=Torbay&limit=50'));
    const body = await res.json();
    const names: string[] = body.allStreetNames.map((s: { street: string }) => s.street);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })));
  });

  it('starts greedy ordering from a requested start street', async () => {
    mockAuth();
    setupAddressMock();

    const res = await GET(
      new Request('http://localhost/api/admin/properties/street?suburb=Torbay&start=Beta+Street&limit=50'),
    );
    const body = await res.json();
    expect(body.start).toBe('Beta Street');
    expect(body.streets[0].street).toBe('Beta Street');
  });

  it('reads a saved start from admin_settings when no explicit start is given', async () => {
    mockAuth();
    setupAddressMock(TORBAY_ROWS, 'Gamma Road');

    const res = await GET(new Request('http://localhost/api/admin/properties/street?suburb=Torbay&limit=50'));
    const body = await res.json();
    expect(body.saved_start).toBe('Gamma Road');
    expect(body.start).toBe('Gamma Road');
    expect(body.streets[0].street).toBe('Gamma Road');
  });

  it('filters streets by search query (case-insensitive)', async () => {
    mockAuth();
    setupAddressMock();

    const res = await GET(
      new Request('http://localhost/api/admin/properties/street?suburb=Torbay&search=alpha&limit=50'),
    );
    const body = await res.json();
    expect(body.streets).toHaveLength(1);
    expect(body.streets[0].street).toBe('Alpha Street');
  });

  it('paginates with offset and limit and sets has_next correctly', async () => {
    mockAuth();
    setupAddressMock();

    const res = await GET(
      new Request('http://localhost/api/admin/properties/street?suburb=Torbay&limit=2&offset=0'),
    );
    const body = await res.json();
    expect(body.streets).toHaveLength(2);
    expect(body.has_next).toBe(true);
    expect(body.next_offset).toBe(2);
  });

  it('has_next is false when all streets fit in one page', async () => {
    mockAuth();
    setupAddressMock();

    const res = await GET(
      new Request('http://localhost/api/admin/properties/street?suburb=Torbay&limit=50'),
    );
    const body = await res.json();
    expect(body.has_next).toBe(false);
    expect(body.next_offset).toBeNull();
  });

  it('returns 400 when suburb is missing', async () => {
    mockAuth();
    const res = await GET(new Request('http://localhost/api/admin/properties/street'));
    expect(res.status).toBe(400);
  });

  it('returns 401 for unauthenticated requests', async () => {
    vi.mocked(auth).mockResolvedValueOnce(undefined as any);
    const res = await GET(new Request('http://localhost/api/admin/properties/street?suburb=Torbay'));
    expect(res.status).toBe(401);
  });

  it('returns 500 when the DB query throws', async () => {
    mockAuth();
    vi.mocked(query).mockImplementation(async (sql: any) => {
      if (String(sql).includes('FROM properties p')) throw new Error('DB connection error');
      return { rows: [] } as any;
    });
    const res = await GET(new Request('http://localhost/api/admin/properties/street?suburb=Torbay'));
    expect(res.status).toBe(500);
  });

  it('returns empty streets list when suburb has no properties', async () => {
    mockAuth();
    setupAddressMock([]);

    const res = await GET(new Request('http://localhost/api/admin/properties/street?suburb=EmptySuburb'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.streets).toHaveLength(0);
    expect(body.totalStreets).toBe(0);
  });
});

describe('Properties Street API — GET cache behaviour', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(query).mockReset();
    vi.mocked(getSuburbStreetsFromCache).mockReset();
    vi.mocked(setSuburbStreetsInCache).mockReset();
    vi.mocked(deleteSuburbStreetsFromCache).mockReset();
    clearSuburbanStreetCache();
  });

  it('second call for same suburb does not re-query the DB row table', async () => {
    mockAuth();
    setupAddressMock();

    await GET(new Request('http://localhost/api/admin/properties/street?suburb=CacheTown&limit=50'));

    vi.mocked(auth).mockResolvedValue({ user: { email: 'admin@test.com' } } as any);
    vi.mocked(query).mockResolvedValueOnce({ rows: [] } as any);
    await GET(new Request('http://localhost/api/admin/properties/street?suburb=CacheTown&limit=50'));

    const rowQueryCalls = vi.mocked(query).mock.calls.filter(
      (c) => typeof c[0] === 'string' && (c[0] as string).includes('FROM properties p'),
    );
    expect(rowQueryCalls).toHaveLength(1);
  });

  it('switching start street reuses cached summaries — no extra row query', async () => {
    mockAuth();
    setupAddressMock();

    await GET(new Request('http://localhost/api/admin/properties/street?suburb=StartTown&limit=50'));

    vi.mocked(auth).mockResolvedValue({ user: { email: 'admin@test.com' } } as any);
    vi.mocked(query).mockResolvedValueOnce({ rows: [] } as any);

    const res2 = await GET(
      new Request('http://localhost/api/admin/properties/street?suburb=StartTown&start=Beta+Street&limit=50'),
    );
    const body2 = await res2.json();
    expect(body2.success).toBe(true);
    expect(body2.streets[0].street).toBe('Beta Street');

    const rowQueryCalls = vi.mocked(query).mock.calls.filter(
      (c) => typeof c[0] === 'string' && (c[0] as string).includes('FROM properties p'),
    );
    expect(rowQueryCalls).toHaveLength(1);
  });
});

describe('Properties Street API — POST saves start street', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(query).mockReset();
    vi.mocked(getSuburbStreetsFromCache).mockReset();
    vi.mocked(setSuburbStreetsInCache).mockReset();
    vi.mocked(deleteSuburbStreetsFromCache).mockReset();
    clearSuburbanStreetCache();
  });

  it('saves the start street and returns success', async () => {
    mockAuth();
    vi.mocked(query).mockResolvedValueOnce({ rows: [] } as any);

    const res = await POST(
      new Request('http://localhost/api/admin/properties/street', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suburb: 'Torbay', start: 'Beta Street' }),
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.suburb).toBe('Torbay');
    expect(body.start).toBe('Beta Street');
    expect(vi.mocked(query)).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO admin_settings'),
      ['properties_start_street:Torbay', 'Beta Street', 'admin@test.com'],
    );
  });

  it('returns 400 when suburb is missing', async () => {
    mockAuth();
    const res = await POST(
      new Request('http://localhost/api/admin/properties/street', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start: 'Beta Street' }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when start is missing', async () => {
    mockAuth();
    const res = await POST(
      new Request('http://localhost/api/admin/properties/street', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suburb: 'Torbay' }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 401 for unauthenticated requests', async () => {
    vi.mocked(auth).mockResolvedValueOnce(undefined as any);
    const res = await POST(
      new Request('http://localhost/api/admin/properties/street', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suburb: 'Torbay', start: 'Beta Street' }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it('returns 500 when the DB write throws', async () => {
    mockAuth();
    vi.mocked(query).mockRejectedValueOnce(new Error('write error'));
    const res = await POST(
      new Request('http://localhost/api/admin/properties/street', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suburb: 'Torbay', start: 'Beta Street' }),
      }),
    );
    expect(res.status).toBe(500);
  });
});

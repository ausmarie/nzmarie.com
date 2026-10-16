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
  const rows = [];
  for (let i = 1; i <= count; i++) {
    rows.push({ address: `${i} ${street}`, lat: String(lat), lng: String(lng) });
  }
  return rows;
}

// Order-independent DB mock keyed on SQL shape. The route makes two concurrent
// queries (street rows + saved start), and the redis L2 lookup suspends before
// those queries fire, so relying on mockResolvedValueOnce ordering is fragile.
function mockStreetDb(rows: any[] = [], savedStart: string | null = null) {
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

function mockStreetDbThrow() {
  vi.mocked(query).mockImplementation(async (sql: any) => {
    const s = String(sql);
    if (s.includes('FROM properties p')) throw new Error('boom');
    return { rows: [] } as any;
  });
}

describe('GET /api/admin/properties/street', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(query).mockReset();
    vi.mocked(getSuburbStreetsFromCache).mockReset();
    vi.mocked(setSuburbStreetsInCache).mockReset();
    vi.mocked(deleteSuburbStreetsFromCache).mockReset();
    mockStreetDb();
    clearSuburbanStreetCache();
  });

  it('returns 401 for unauthenticated users', async () => {
    vi.mocked(auth).mockResolvedValueOnce(undefined as any);

    const response = await GET(new Request('http://localhost:3000/api/admin/properties/street?suburb=Torbay'));
    expect(response.status).toBe(401);
  });

  it('returns 400 when suburb is missing', async () => {
    mockAuth();

    const response = await GET(new Request('http://localhost:3000/api/admin/properties/street'));
    expect(response.status).toBe(400);
  });

  it('returns streets in greedy walking order with counts and default start', async () => {
    mockAuth();

    mockStreetDb([
      ...addressRows('Gamma Street', 4, -36.6957, 174.7452),
      ...addressRows('Alpha Street', 5, -36.6958, 174.7453),
      ...addressRows('Beta Street', 3, -36.6962, 174.7456),
    ]);

    const response = await GET(new Request('http://localhost:3000/api/admin/properties/street?suburb=OrderTown'));
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.streets.length).toBe(3);
    const names = body.streets.map((s: { street: string }) => s.street);
    expect(names).toHaveLength(3);
    expect(names[0]).toBe('Alpha Street');
    expect(names).toEqual(expect.arrayContaining(['Alpha Street', 'Beta Street', 'Gamma Street']));
  });

  it('applies a saved start street', async () => {
    mockAuth();

    mockStreetDb(
      [
        ...addressRows('Alpha Street', 5, -36.6958, 174.7453),
        ...addressRows('Beta Street', 3, -36.6962, 174.7456),
        ...addressRows('Gamma Street', 4, -36.71, 174.74),
      ],
      'Beta Street'
    );

    const response = await GET(new Request('http://localhost:3000/api/admin/properties/street?suburb=SavedStartTown'));
    const body = await response.json();

    expect(body.saved_start).toBe('Beta Street');
    expect(body.start).toBe('Beta Street');
    expect(body.streets.map((s: { street: string }) => s.street)).toContain('Beta Street');
  });

  it('returns 500 when the DB query throws', async () => {
    mockAuth();
    mockStreetDbThrow();

    const response = await GET(new Request('http://localhost:3000/api/admin/properties/street?suburb=ErrorTown'));
    expect(response.status).toBe(500);
  });
});

describe('POST /api/admin/properties/street', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(query).mockReset();
    vi.mocked(getSuburbStreetsFromCache).mockReset();
    vi.mocked(setSuburbStreetsInCache).mockReset();
    vi.mocked(deleteSuburbStreetsFromCache).mockReset();
    vi.mocked(query).mockResolvedValue({ rows: [] } as any);
    clearSuburbanStreetCache();
  });

  it('saves the start street for the suburb', async () => {
    mockAuth();

    const response = await POST(
      new Request('http://localhost:3000/api/admin/properties/street', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suburb: 'Torbay', start: 'Beta Street' }),
      })
    );
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.start).toBe('Beta Street');

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO admin_settings'),
      ['properties_start_street:Torbay', 'Beta Street', 'admin@test.com']
    );
  });

  it('rejects a missing suburb or start', async () => {
    mockAuth();

    const missingSuburb = await POST(
      new Request('http://localhost:3000/api/admin/properties/street', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start: 'Beta Street' }),
      })
    );
    expect(missingSuburb.status).toBe(400);

    const missingStart = await POST(
      new Request('http://localhost:3000/api/admin/properties/street', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suburb: 'Torbay' }),
      })
    );
    expect(missingStart.status).toBe(400);
  });

  it('returns 401 for unauthenticated users', async () => {
    vi.mocked(auth).mockResolvedValueOnce(undefined as any);

    const response = await POST(
      new Request('http://localhost:3000/api/admin/properties/street', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suburb: 'Torbay', start: 'Beta Street' }),
      })
    );
    expect(response.status).toBe(401);
  });
});

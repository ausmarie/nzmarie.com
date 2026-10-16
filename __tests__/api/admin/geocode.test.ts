import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET, POST } from '@/app/api/admin/outreach/streets/geocode/route';
import { auth } from '@/lib/auth';
import { marieDB } from '@/lib/db';

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/permissions', () => ({ isAdmin: vi.fn().mockReturnValue(true), isSuperAdmin: vi.fn().mockReturnValue(true) }));
vi.mock('@/lib/db', () => ({ marieDB: { query: vi.fn(), ensureOutreachTablesExist: vi.fn() } }));

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = 'test-key';
});

afterEach(() => {
  delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  delete process.env.GOOGLE_MAPS_API_KEY;
  vi.unstubAllGlobals();
});

describe('Geocode streets endpoint', () => {
  it('GET returns missing count', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ user: { email: 'admin@example.com' } } as any);
    vi.mocked(marieDB.query).mockResolvedValueOnce({ rows: [{ cnt: 5 }] } as any);
    const res = await GET(new Request('http://localhost/api/admin/outreach/streets/geocode?suburb=Torbay'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.missing).toBe(5);
  });

  it('POST geocodes streets and writes to DB', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ user: { email: 'superadmin@example.com' } } as any);

    // mock DB SELECT of streets missing locations
    vi.mocked(marieDB.query).mockImplementation(async (sql: string, params?: any[]) => {
      if (sql && sql.toString().includes('SELECT op.suburb, op.street')) {
        return { rows: [ { suburb: 'Torbay', street: 'Alpha Street' }, { suburb: 'Torbay', street: 'Beta Street' } ] } as any;
      }
      // INSERT INTO street_locations
      if (sql && sql.toString().includes('INSERT INTO street_locations')) {
        return { rows: [] } as any;
      }
      return { rows: [] } as any;
    });

    // stub fetch to Google Geocode API
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      return {
        json: async () => ({ results: [ { geometry: { location: { lat: -36.7, lng: 174.7 } } } ] }),
      } as any;
    }));

    const req = new Request('http://localhost/api/admin/outreach/streets/geocode', { method: 'POST', body: JSON.stringify({ suburb: 'Torbay', limit: 2 }) });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.attempted).toBeGreaterThanOrEqual(1);
    expect(body.geocoded).toBeGreaterThanOrEqual(1);
  });
});

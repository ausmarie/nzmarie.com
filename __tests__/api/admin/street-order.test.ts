import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, PUT, DELETE } from '@/app/api/admin/outreach/street-order/route';
import { auth } from '@/lib/auth';
import { marieDB } from '@/lib/db';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  marieDB: {
    query: vi.fn().mockResolvedValue({ rows: [] }),
    ensureOutreachTablesExist: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/lib/permissions', () => ({
  isAdmin: vi.fn().mockReturnValue(true),
}));

function mockAuth() {
  vi.mocked(auth).mockResolvedValue({ user: { email: 'admin@test.com' } } as any);
}

function streetRows(street: string, count: number, lat: number, lng: number) {
  const rows = [];
  for (let i = 1; i <= count; i++) {
    rows.push({ street, property_address: `${i} ${street}`, house_number: null, lat, lng });
  }
  return rows;
}

describe('GET /api/admin/outreach/street-order', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 for unauthenticated users', async () => {
    vi.mocked(auth).mockResolvedValueOnce(undefined as any);

    const response = await GET(new Request('http://localhost:3000/api/admin/outreach/street-order?suburb=Torbay'));
    expect(response.status).toBe(401);
  });

  it('returns 400 when suburb is missing', async () => {
    mockAuth();

    const response = await GET(new Request('http://localhost:3000/api/admin/outreach/street-order'));
    expect(response.status).toBe(400);
  });

  it('returns streets in saved manual order when one exists', async () => {
    mockAuth();

    vi.mocked(marieDB.query)
      .mockResolvedValueOnce({
        rows: [
          ...streetRows('Alpha Street', 5, -36.6958, 174.7453),
          ...streetRows('Beta Street', 3, -36.6959, 174.7454),
          ...streetRows('Gamma Street', 4, -36.6957, 174.7452),
        ],
      } as any)
      .mockResolvedValueOnce({
        rows: [{ setting_value: JSON.stringify(['Gamma Street', 'Alpha Street']) }],
      } as any);

    const response = await GET(new Request('http://localhost:3000/api/admin/outreach/street-order?suburb=Torbay'));
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.hasSavedOrder).toBe(true);
    expect(body.savedOrder).toEqual(['Gamma Street', 'Alpha Street']);
    expect(body.streets.map((s: { street: string }) => s.street)).toEqual([
      'Gamma Street',
      'Alpha Street',
      'Beta Street',
    ]);
    expect(body.streets[0]).toMatchObject({ street: 'Gamma Street', address_count: 4 });
  });

  it('returns recommended greedy order when no saved order exists', async () => {
    mockAuth();

    vi.mocked(marieDB.query)
      .mockResolvedValueOnce({
        rows: [
          ...streetRows('Alpha Street', 5, -36.6958, 174.7453),
          ...streetRows('Beta Street', 3, -36.6962, 174.7456),
          ...streetRows('Gamma Street', 4, -36.71, 174.74),
        ],
      } as any)
      .mockResolvedValueOnce({ rows: [] } as any);

    const response = await GET(new Request('http://localhost:3000/api/admin/outreach/street-order?suburb=Torbay'));
    const body = await response.json();

    expect(body.hasSavedOrder).toBe(false);
    // Alpha (house 1) starts, then the nearest street Beta, then Gamma.
    expect(body.streets.map((s: { street: string }) => s.street)).toEqual([
      'Alpha Street',
      'Beta Street',
      'Gamma Street',
    ]);
  });

  it('returns 500 when the DB query throws', async () => {
    mockAuth();
    vi.mocked(marieDB.query).mockRejectedValueOnce(new Error('boom'));

    const response = await GET(new Request('http://localhost:3000/api/admin/outreach/street-order?suburb=Torbay'));
    expect(response.status).toBe(500);
  });
});

describe('PUT /api/admin/outreach/street-order', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('saves a cleaned street order via upsert', async () => {
    mockAuth();

    const response = await PUT(
      new Request('http://localhost:3000/api/admin/outreach/street-order', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suburb: 'Torbay', streets: ['Gamma Street', 'Alpha Street', 'Alpha Street', ''] }),
      })
    );
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.order).toEqual(['Gamma Street', 'Alpha Street']);

    expect(marieDB.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO admin_settings'),
      ['outreach_street_order:Torbay', JSON.stringify(['Gamma Street', 'Alpha Street']), 'admin@test.com']
    );
  });

  it('rejects invalid bodies', async () => {
    mockAuth();

    const missingSuburb = await PUT(
      new Request('http://localhost:3000/api/admin/outreach/street-order', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ streets: ['A'] }),
      })
    );
    expect(missingSuburb.status).toBe(400);

    const notArray = await PUT(
      new Request('http://localhost:3000/api/admin/outreach/street-order', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suburb: 'Torbay', streets: 'Gamma Street' }),
      })
    );
    expect(notArray.status).toBe(400);
  });

  it('returns 401 for unauthenticated users', async () => {
    vi.mocked(auth).mockResolvedValueOnce(undefined as any);

    const response = await PUT(
      new Request('http://localhost:3000/api/admin/outreach/street-order', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suburb: 'Torbay', streets: ['A'] }),
      })
    );
    expect(response.status).toBe(401);
  });
});

describe('DELETE /api/admin/outreach/street-order', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('clears the saved order for the suburb', async () => {
    mockAuth();

    const response = await DELETE(
      new Request('http://localhost:3000/api/admin/outreach/street-order?suburb=Torbay')
    );
    expect(response.status).toBe(200);

    expect(marieDB.query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM admin_settings'),
      ['outreach_street_order:Torbay']
    );
  });

  it('returns 400 when suburb is missing', async () => {
    mockAuth();

    const response = await DELETE(new Request('http://localhost:3000/api/admin/outreach/street-order'));
    expect(response.status).toBe(400);
  });
});

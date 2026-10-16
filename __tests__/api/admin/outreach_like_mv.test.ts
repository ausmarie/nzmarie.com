import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/admin/outreach/like/route';
import { auth } from '@/lib/auth';
import { marieDB } from '@/lib/db';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  marieDB: {
    query: vi.fn().mockResolvedValue({ rows: [] }),
    ensureOutreachTablesExist: vi.fn(),
  },
}));

vi.mock('@/lib/permissions', () => ({
  isAdmin: vi.fn().mockReturnValue(true),
}));

describe('Outreach Like MV POST /api/admin/outreach/like', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.USE_OUTREACH_MV = 'true';
  });

  it('returns 401 if unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValueOnce(undefined as any);

    const response = await POST(new Request('http://localhost:3000/api/admin/outreach/like', {
      method: 'POST',
      body: JSON.stringify({ property_id: 'test-id', property_address: '1 Test St', suburb: 'Oteha', city: 'Auckland', region: 'Auckland' }),
    }));
    expect(response.status).toBe(401);
  });

  it('triggers MV REFRESH after insert', async () => {
    vi.mocked(auth).mockResolvedValueOnce({
      user: { email: 'nzlouis.com@gmail.com' },
    } as any);

    const response = await POST(new Request('http://localhost:3000/api/admin/outreach/like', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        property_id: 'test-id',
        property_address: '1 Test St',
        suburb: 'Oteha',
        city: 'Auckland',
        region: 'Auckland',
      }),
    }));

    expect(response.status).toBe(200);
    expect(marieDB.query).toHaveBeenCalledWith(
      'REFRESH MATERIALIZED VIEW CONCURRENTLY outreach_enriched'
    );
  });

  it('triggers MV REFRESH after delete (unlike)', async () => {
    vi.mocked(auth).mockResolvedValueOnce({
      user: { email: 'nzlouis.com@gmail.com' },
    } as any);

    vi.mocked(marieDB.query)
      .mockResolvedValueOnce({ rows: [{ id: 'existing-id', status: 'liked' }] } as any);

    const response = await POST(new Request('http://localhost:3000/api/admin/outreach/like', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        property_id: 'test-id',
        property_address: '1 Test St',
        suburb: 'Oteha',
        city: 'Auckland',
        region: 'Auckland',
      }),
    }));

    expect(response.status).toBe(200);
    expect(marieDB.query).toHaveBeenCalledWith(
      'REFRESH MATERIALIZED VIEW CONCURRENTLY outreach_enriched'
    );
  });

  it('upgrades existing pending property to liked on like', async () => {
    vi.mocked(auth).mockResolvedValueOnce({
      user: { email: 'nzlouis.com@gmail.com' },
    } as any);

    vi.mocked(marieDB.query)
      .mockResolvedValueOnce({ rows: [{ id: 'existing-id', status: 'pending' }] } as any);

    const response = await POST(new Request('http://localhost:3000/api/admin/outreach/like', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        property_id: 'test-id',
        property_address: '1 Test St',
        suburb: 'Oteha',
        city: 'Auckland',
        region: 'Auckland',
      }),
    }));

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.liked).toBe(true);
    expect(marieDB.query).toHaveBeenCalledWith(
      `UPDATE outreach_properties
         SET status = 'liked', campaign = 'favorites',
             street = COALESCE(NULLIF(TRIM(street), ''), $2)
         WHERE id = $1`,
      ['existing-id', 'Test St']
    );
    expect(marieDB.query).toHaveBeenCalledWith(
      'REFRESH MATERIALIZED VIEW CONCURRENTLY outreach_enriched'
    );
  });

  it('upgrades existing sent property to liked on like', async () => {
    vi.mocked(auth).mockResolvedValueOnce({
      user: { email: 'nzlouis.com@gmail.com' },
    } as any);

    vi.mocked(marieDB.query)
      .mockResolvedValueOnce({ rows: [{ id: 'existing-id-2', status: 'sent' }] } as any);

    const response = await POST(new Request('http://localhost:3000/api/admin/outreach/like', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        property_id: 'test-id',
        property_address: '2 Test Ave',
        suburb: 'Oteha',
        city: 'Auckland',
        region: 'Auckland',
      }),
    }));

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.liked).toBe(true);
    expect(marieDB.query).toHaveBeenCalledWith(
      `UPDATE outreach_properties
         SET status = 'liked', campaign = 'favorites',
             street = COALESCE(NULLIF(TRIM(street), ''), $2)
         WHERE id = $1`,
      ['existing-id-2', 'Test Ave']
    );
  });

  it('does not trigger MV REFRESH when MV is disabled', async () => {
    process.env.USE_OUTREACH_MV = 'false';
    vi.mocked(auth).mockResolvedValueOnce({
      user: { email: 'nzlouis.com@gmail.com' },
    } as any);

    const response = await POST(new Request('http://localhost:3000/api/admin/outreach/like', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        property_id: 'test-id',
        property_address: '2 Test Ave',
        suburb: 'Oteha',
        city: 'Auckland',
        region: 'Auckland',
      }),
    }));

    expect(response.status).toBe(200);
    const refreshCalls = vi.mocked(marieDB.query).mock.calls.filter(
      c => c[0] === 'REFRESH MATERIALIZED VIEW CONCURRENTLY outreach_enriched'
    );
    expect(refreshCalls).toHaveLength(0);
  });
});

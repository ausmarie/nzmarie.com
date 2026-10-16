import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PATCH, DELETE } from '@/app/api/admin/outreach/[id]/route';
import { PATCH as StatusPATCH } from '@/app/api/admin/outreach/[id]/status/route';
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

function mockAuth() {
  vi.mocked(auth).mockResolvedValueOnce({
    user: { email: 'nzlouis.com@gmail.com' },
  } as any);
}

const params = Promise.resolve({ id: 'test-id' });

describe('Outreach [id] MV PATCH /api/admin/outreach/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.USE_OUTREACH_MV = 'true';
  });

  it('returns 401 if unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValueOnce(undefined as any);

    const response = await PATCH(
      new Request('http://localhost:3000/api/admin/outreach/test-id', { method: 'PATCH', body: JSON.stringify({ status: 'sent' }) }),
      { params }
    );
    expect(response.status).toBe(401);
  });

  it('accepts property_address update', async () => {
    mockAuth();

    vi.mocked(marieDB.query)
      .mockResolvedValueOnce({ rows: [{ id: 'test-id', property_address: '37 Masons Road' }] } as any);

    const response = await PATCH(
      new Request('http://localhost:3000/api/admin/outreach/test-id', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ property_address: '37 Masons Road' }),
      }),
      { params }
    );

    expect(response.status).toBe(200);
    const queryCall = vi.mocked(marieDB.query).mock.calls[0][0] as string;
    expect(queryCall).toContain('property_address');
  });

  it('accepts suburb/city/region/street updates', async () => {
    mockAuth();

    vi.mocked(marieDB.query)
      .mockResolvedValueOnce({ rows: [{ id: 'test-id', suburb: 'Oteha', city: 'Auckland', region: 'Auckland', street: 'Masons Road' }] } as any);

    const response = await PATCH(
      new Request('http://localhost:3000/api/admin/outreach/test-id', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suburb: 'Oteha', city: 'Auckland', region: 'Auckland', street: 'Masons Road' }),
      }),
      { params }
    );

    expect(response.status).toBe(200);
    const queryCall = vi.mocked(marieDB.query).mock.calls[0][0] as string;
    expect(queryCall).toContain('suburb');
    expect(queryCall).toContain('city');
    expect(queryCall).toContain('region');
    expect(queryCall).toContain('street');
  });

  it('triggers MV REFRESH after update', async () => {
    mockAuth();

    vi.mocked(marieDB.query)
      .mockResolvedValueOnce({ rows: [{ id: 'test-id' }] } as any);

    const response = await PATCH(
      new Request('http://localhost:3000/api/admin/outreach/test-id', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'sent' }),
      }),
      { params }
    );

    expect(response.status).toBe(200);
    expect(marieDB.query).toHaveBeenCalledWith(
      'REFRESH MATERIALIZED VIEW CONCURRENTLY outreach_enriched'
    );
  });

  it('returns 400 when no valid fields', async () => {
    mockAuth();

    const response = await PATCH(
      new Request('http://localhost:3000/api/admin/outreach/test-id', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }),
      { params }
    );

    expect(response.status).toBe(400);
  });

  it('returns 404 when property not found', async () => {
    mockAuth();

    vi.mocked(marieDB.query).mockResolvedValueOnce({ rows: [] } as any);

    const response = await PATCH(
      new Request('http://localhost:3000/api/admin/outreach/test-id', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'sent' }),
      }),
      { params }
    );

    expect(response.status).toBe(404);
  });
});

describe('Outreach [id] MV DELETE /api/admin/outreach/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.USE_OUTREACH_MV = 'true';
  });

  it('returns 401 if unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValueOnce(undefined as any);

    const response = await DELETE(
      new Request('http://localhost:3000/api/admin/outreach/test-id', { method: 'DELETE' }),
      { params }
    );
    expect(response.status).toBe(401);
  });

  it('triggers MV REFRESH after delete', async () => {
    mockAuth();

    vi.mocked(marieDB.query).mockResolvedValueOnce({ rows: [{ id: 'test-id' }] } as any);

    const response = await DELETE(
      new Request('http://localhost:3000/api/admin/outreach/test-id', { method: 'DELETE' }),
      { params }
    );

    expect(response.status).toBe(200);
    expect(marieDB.query).toHaveBeenCalledWith(
      'REFRESH MATERIALIZED VIEW CONCURRENTLY outreach_enriched'
    );
  });

  it('returns 404 when property not found', async () => {
    mockAuth();

    vi.mocked(marieDB.query).mockResolvedValueOnce({ rows: [] } as any);

    const response = await DELETE(
      new Request('http://localhost:3000/api/admin/outreach/test-id', { method: 'DELETE' }),
      { params }
    );

    expect(response.status).toBe(404);
  });

  it('does not trigger MV REFRESH when MV is disabled', async () => {
    process.env.USE_OUTREACH_MV = 'false';
    mockAuth();

    vi.mocked(marieDB.query).mockResolvedValueOnce({ rows: [{ id: 'test-id' }] } as any);

    await DELETE(
      new Request('http://localhost:3000/api/admin/outreach/test-id', { method: 'DELETE' }),
      { params }
    );

    const refreshCalls = vi.mocked(marieDB.query).mock.calls.filter(
      c => c[0] === 'REFRESH MATERIALIZED VIEW CONCURRENTLY outreach_enriched'
    );
    expect(refreshCalls).toHaveLength(0);
  });
});

describe('Outreach [id]/status MV PATCH /api/admin/outreach/[id]/status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.USE_OUTREACH_MV = 'true';
  });

  it('returns 403 if unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValueOnce(undefined as any);

    const response = await StatusPATCH(
      new Request('http://localhost:3000/api/admin/outreach/test-id/status', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'sent' }),
      }),
      { params }
    );
    expect(response.status).toBe(403);
  });

  it('triggers MV REFRESH after status update', async () => {
    mockAuth();

    vi.mocked(marieDB.query).mockResolvedValueOnce({ rows: [{ id: 'test-id', status: 'sent' }] } as any);

    const response = await StatusPATCH(
      new Request('http://localhost:3000/api/admin/outreach/test-id/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'sent' }),
      }),
      { params }
    );

    expect(response.status).toBe(200);
    expect(marieDB.query).toHaveBeenCalledWith(
      'REFRESH MATERIALIZED VIEW CONCURRENTLY outreach_enriched'
    );
  });

  it('returns 400 for invalid status', async () => {
    mockAuth();

    const response = await StatusPATCH(
      new Request('http://localhost:3000/api/admin/outreach/test-id/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'invalid_status' }),
      }),
      { params }
    );
    expect(response.status).toBe(400);
  });
});

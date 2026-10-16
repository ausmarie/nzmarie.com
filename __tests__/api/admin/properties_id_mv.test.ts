import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockQuery = vi.hoisted(() => vi.fn());

vi.mock('@/lib/db', () => ({
  query: mockQuery,
}));

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/permissions', () => ({
  isAdmin: vi.fn(() => true),
}));

import { PATCH } from '../../../app/api/admin/properties/[id]/route';
import { auth } from '@/lib/auth';

describe('PATCH /api/admin/properties/[id] — MV refresh on no_junk_mail', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    process.env.USE_OUTREACH_MV = 'true';
    vi.mocked(auth).mockResolvedValue({
      user: { email: 'admin@example.com' },
    } as any);
  });

  it('triggers MV REFRESH when no_junk_mail is updated', async () => {
    // UPDATE, SELECT, then MV REFRESH (non-awaited, resolves later)
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'p1', no_junk_mail: true }] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await PATCH(
      new Request('http://localhost/api/admin/properties/p1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ no_junk_mail: true }),
      }),
      { params: Promise.resolve({ id: 'p1' }) }
    );

    expect(response.status).toBe(200);
    expect(mockQuery).toHaveBeenCalledWith(
      'REFRESH MATERIALIZED VIEW CONCURRENTLY outreach_enriched'
    );
  });

  it('does not trigger MV REFRESH when no_junk_mail is not in body', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'p1', address: '1 Test St' }] });

    const response = await PATCH(
      new Request('http://localhost/api/admin/properties/p1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: '1 New St' }),
      }),
      { params: Promise.resolve({ id: 'p1' }) }
    );

    expect(response.status).toBe(200);
    const refreshCalls = mockQuery.mock.calls.filter(
      c => c[0] === 'REFRESH MATERIALIZED VIEW CONCURRENTLY outreach_enriched'
    );
    expect(refreshCalls).toHaveLength(0);
  });

  it('does not trigger MV REFRESH when MV is disabled', async () => {
    process.env.USE_OUTREACH_MV = 'false';
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'p1', no_junk_mail: true }] });

    const response = await PATCH(
      new Request('http://localhost/api/admin/properties/p1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ no_junk_mail: true }),
      }),
      { params: Promise.resolve({ id: 'p1' }) }
    );

    expect(response.status).toBe(200);
    const refreshCalls = mockQuery.mock.calls.filter(
      c => c[0] === 'REFRESH MATERIALIZED VIEW CONCURRENTLY outreach_enriched'
    );
    expect(refreshCalls).toHaveLength(0);
  });

  it('returns 401 if unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValueOnce(undefined as any);

    const response = await PATCH(
      new Request('http://localhost/api/admin/properties/p1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ no_junk_mail: true }),
      }),
      { params: Promise.resolve({ id: 'p1' }) }
    );

    expect(response.status).toBe(401);
  });
});

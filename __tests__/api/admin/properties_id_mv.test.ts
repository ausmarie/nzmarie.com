import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockQuery = vi.hoisted(() => vi.fn());
const mockInvalidateDashboardStatsCache = vi.hoisted(() => vi.fn());
const mockInvalidateStreetClustersForSuburb = vi.hoisted(() => vi.fn());

vi.mock('@/lib/db', () => ({
  query: mockQuery,
}));

vi.mock('@/lib/redis', () => ({
  invalidateDashboardStatsCache: mockInvalidateDashboardStatsCache,
  invalidateStreetClustersForSuburb: mockInvalidateStreetClustersForSuburb,
}));

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/permissions', () => ({
  isAdmin: vi.fn(() => true),
}));

import { PATCH } from '../../../app/api/admin/properties/[id]/route';
import { auth } from '@/lib/auth';

function patchRequest(id: string, body: Record<string, unknown>) {
  return new Request(`http://localhost/api/admin/properties/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('PATCH /api/admin/properties/[id] — MV refresh on no_junk_mail', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockInvalidateDashboardStatsCache.mockReset();
    mockInvalidateDashboardStatsCache.mockResolvedValue(undefined);
    mockInvalidateStreetClustersForSuburb.mockReset();
    mockInvalidateStreetClustersForSuburb.mockResolvedValue(undefined);
    process.env.USE_OUTREACH_MV = 'true';
    vi.mocked(auth).mockResolvedValue({
      user: { email: 'admin@example.com' },
    } as any);
  });

  it('updates and returns the row in one query and triggers MV REFRESH', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'p1', no_junk_mail: true }] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await PATCH(patchRequest('p1', { no_junk_mail: true }), {
      params: Promise.resolve({ id: 'p1' }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.property.id).toBe('p1');

    const updateCall = mockQuery.mock.calls[0];
    expect(updateCall[0]).toContain('UPDATE properties');
    expect(updateCall[0]).toContain('RETURNING *');
    expect(mockQuery).toHaveBeenCalledWith(
      'REFRESH MATERIALIZED VIEW CONCURRENTLY outreach_enriched'
    );
    expect(mockInvalidateDashboardStatsCache).toHaveBeenCalledTimes(1);
    expect(mockInvalidateStreetClustersForSuburb).not.toHaveBeenCalled();
  });

  it('does not trigger MV REFRESH when no_junk_mail is not in body', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'p1', address: '1 New St', suburb: 'Torbay' }],
    });

    const response = await PATCH(patchRequest('p1', { address: '1 New St' }), {
      params: Promise.resolve({ id: 'p1' }),
    });

    expect(response.status).toBe(200);
    const refreshCalls = mockQuery.mock.calls.filter(
      (call) => call[0] === 'REFRESH MATERIALIZED VIEW CONCURRENTLY outreach_enriched'
    );
    expect(refreshCalls).toHaveLength(0);
    expect(mockInvalidateDashboardStatsCache).not.toHaveBeenCalled();
    expect(mockInvalidateStreetClustersForSuburb).toHaveBeenCalledWith('Torbay');
  });

  it('does not invalidate street clusters for non-address fields', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'p1', suburb: 'Torbay', bedrooms: 4 }],
    });

    const response = await PATCH(patchRequest('p1', { bedrooms: 4 }), {
      params: Promise.resolve({ id: 'p1' }),
    });

    expect(response.status).toBe(200);
    expect(mockInvalidateStreetClustersForSuburb).not.toHaveBeenCalled();
  });

  it('does not trigger MV REFRESH when MV is disabled', async () => {
    process.env.USE_OUTREACH_MV = 'false';
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'p1', no_junk_mail: true }] });

    const response = await PATCH(patchRequest('p1', { no_junk_mail: true }), {
      params: Promise.resolve({ id: 'p1' }),
    });

    expect(response.status).toBe(200);
    const refreshCalls = mockQuery.mock.calls.filter(
      (call) => call[0] === 'REFRESH MATERIALIZED VIEW CONCURRENTLY outreach_enriched'
    );
    expect(refreshCalls).toHaveLength(0);
  });

  it('returns 401 if unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValueOnce(undefined as any);

    const response = await PATCH(patchRequest('p1', { no_junk_mail: true }), {
      params: Promise.resolve({ id: 'p1' }),
    });

    expect(response.status).toBe(401);
    expect(mockQuery).not.toHaveBeenCalled();
  });
});

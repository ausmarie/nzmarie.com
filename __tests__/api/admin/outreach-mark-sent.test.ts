import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQuery = vi.hoisted(() => vi.fn());
const mockInvalidateStreetClustersForSuburb = vi.hoisted(() => vi.fn());

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({ user: { email: 'admin@example.com' } }),
}));

vi.mock('@/lib/db', () => ({
  marieDB: {
    query: mockQuery,
    ensureOutreachTablesExist: vi.fn(),
  },
}));

vi.mock('@/lib/permissions', () => ({
  isAdmin: vi.fn(() => true),
}));

vi.mock('@/lib/redis', () => ({
  invalidateStreetClustersForSuburb: mockInvalidateStreetClustersForSuburb,
}));

import { PATCH } from '@/app/api/admin/outreach/[id]/mark-sent/route';

describe('PATCH /api/admin/outreach/[id]/mark-sent', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockInvalidateStreetClustersForSuburb.mockReset();
    mockQuery.mockResolvedValue({
      rows: [{ id: 'outreach-1', suburb: 'Torbay', status: 'sent' }],
    });
    mockInvalidateStreetClustersForSuburb.mockResolvedValue(undefined);
  });

  it('waits for street-cluster cache invalidation before responding', async () => {
    let finishInvalidation: (() => void) | undefined;
    mockInvalidateStreetClustersForSuburb.mockImplementation(
      () => new Promise<void>((resolve) => {
        finishInvalidation = resolve;
      })
    );

    let responseResolved = false;
    const responsePromise = PATCH(new Request('http://localhost/api/admin/outreach/outreach-1/mark-sent'), {
      params: Promise.resolve({ id: 'outreach-1' }),
    }).then((response) => {
      responseResolved = true;
      return response;
    });

    await vi.waitFor(() => {
      expect(mockInvalidateStreetClustersForSuburb).toHaveBeenCalledWith('Torbay');
    });
    expect(responseResolved).toBe(false);

    finishInvalidation?.();
    const response = await responsePromise;
    expect(response.status).toBe(200);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockQuery = vi.hoisted(() => vi.fn());

vi.mock('@/lib/db', () => ({
  marieDB: {
    query: mockQuery,
  },
}));

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({ user: { email: 'admin@example.com' } }),
}));

vi.mock('@/lib/permissions', () => ({
  isAdmin: vi.fn(() => true),
}));

import { GET } from '../../../app/api/admin/leads/list/route';

describe('GET /api/admin/leads/list', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('returns leads with owner and contact fields ordered newest first', async () => {
    const rows = [
      {
        id: 'lead-2',
        property_address: '11 Honour Avenue',
        suburb: 'Northcross',
        status: 'new',
        priority: 'high',
        owner_name: 'Alice Smith',
        owner_email: 'alice@example.com',
        owner_phone: '0229876543',
        created_at: '2026-10-05T00:00:00.000Z',
      },
      {
        id: 'lead-1',
        property_address: '249 Sunset Road',
        suburb: 'Sunnynook',
        status: 'contacted',
        priority: 'medium',
        owner_name: 'John Doe',
        owner_email: 'john@example.com',
        owner_phone: '0211234567',
        created_at: '2026-10-01T00:00:00.000Z',
      },
    ];
    mockQuery.mockResolvedValueOnce({ rows });

    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.leads).toHaveLength(2);
    expect(body.leads[0].id).toBe('lead-2');
    expect(body.leads[0].owner_name).toBe('Alice Smith');
    expect(body.leads[0].owner_phone).toBe('0229876543');
    expect(body.leads[0].owner_email).toBe('alice@example.com');
    expect(body.leads[0].created_at).toBe('2026-10-05T00:00:00.000Z');
    expect(body.leads[1].id).toBe('lead-1');
  });

  it('queries leads ordered by created_at DESC and selects owner/contact columns', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await GET();

    const [sql] = mockQuery.mock.calls[0] as [string];
    expect(sql).toContain('owner_name');
    expect(sql).toContain('owner_email');
    expect(sql).toContain('owner_phone');
    expect(sql).toContain('created_at');
    expect(sql).toContain('ORDER BY created_at DESC');
  });

  it('returns 500 when the query fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockQuery.mockRejectedValueOnce(new Error('db down'));

    const response = await GET();
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.success).toBe(false);

    consoleSpy.mockRestore();
  });
});

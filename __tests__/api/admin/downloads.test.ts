import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/permissions', () => ({
  isAdmin: vi.fn(),
}));

vi.mock('@/lib/drizzle', () => ({
  db: { select: vi.fn(), execute: vi.fn() },
}));

import { auth } from '@/lib/auth';
import { isAdmin } from '@/lib/permissions';
import { db } from '@/lib/drizzle';
import { GET } from '../../../app/api/admin/downloads/route';

function createChain(data: any) {
  const chain: any = {};
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.orderBy = vi.fn(() => chain);
  chain.limit = vi.fn(() => chain);
  chain.offset = vi.fn(() => chain);
  chain.then = (resolve: (v: any) => void) => resolve(data);
  return chain;
}

function makeRequest(params?: Record<string, string>) {
  const search = params ? '?' + new URLSearchParams(params).toString() : '';
  return new Request(`http://localhost/api/admin/downloads${search}`);
}

describe('GET /api/admin/downloads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ user: { email: 'admin@test.com' } } as any);
    vi.mocked(isAdmin).mockReturnValue(true);
  });

  it('returns 200 with download records and pagination', async () => {
    const mockRows = [
      { id: 'd1', email: 'user@test.com', name: 'Test User', suburb: 'Albany', report_type: 'local_market', downloaded_at: new Date(), source: 'organic', tracking_code: null, phone: null, user_agent: null, ip_address: null, campaign_id: null, created_at: new Date() },
    ];

    vi.mocked(db.select).mockImplementationOnce(() => createChain(mockRows));
    vi.mocked(db.select).mockImplementationOnce(() => createChain([{ total: 1 }]));

    vi.mocked(db.execute).mockResolvedValueOnce({
      rows: [{ total_downloads: '10', this_month: '3', unique_users: '5' }],
    } as any);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].suburb).toBe('Albany');
    expect(body.pagination.total).toBe(1);
    expect(body.pagination.totalPages).toBe(1);
    expect(body.stats.total_downloads).toBe('10');
    expect(body.stats.unique_users).toBe('5');
  });

  it('returns 401 when not authenticated', async () => {
    vi.mocked(auth).mockResolvedValue({ user: null } as any);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns 401 when not admin', async () => {
    vi.mocked(isAdmin).mockReturnValue(false);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns 500 on database error', async () => {
    vi.mocked(db.execute).mockRejectedValue(new Error('DB error'));
    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
  });

  it('filters by source', async () => {
    const mockRows = [
      { id: 'd2', email: 'a@b.com', name: 'A', suburb: 'Glenfield', report_type: 'local_market', downloaded_at: new Date(), source: 'direct_mail', tracking_code: 'DM-123', phone: null, user_agent: null, ip_address: null, campaign_id: null, created_at: new Date() },
    ];

    vi.mocked(db.select).mockImplementationOnce(() => createChain(mockRows));
    vi.mocked(db.select).mockImplementationOnce(() => createChain([{ total: 1 }]));

    vi.mocked(db.execute).mockResolvedValueOnce({
      rows: [{ total_downloads: '5', this_month: '1', unique_users: '2' }],
    } as any);

    const res = await GET(makeRequest({ source: 'direct_mail' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].source).toBe('direct_mail');
  });

  it('filters by search query', async () => {
    const mockRows: any[] = [];

    vi.mocked(db.select).mockImplementationOnce(() => createChain(mockRows));
    vi.mocked(db.select).mockImplementationOnce(() => createChain([{ total: 0 }]));

    vi.mocked(db.execute).mockResolvedValueOnce({
      rows: [{ total_downloads: '0', this_month: '0', unique_users: '0' }],
    } as any);

    const res = await GET(makeRequest({ search: 'nonexistent' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(0);
    expect(body.pagination.total).toBe(0);
  });
});

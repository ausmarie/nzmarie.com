import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockQuery = vi.hoisted(() => vi.fn());

vi.mock('@/lib/db', () => ({
  query: mockQuery,
}));

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({ user: { email: 'admin@example.com' } }),
}));

vi.mock('@/lib/permissions', () => ({
  isSuperAdmin: vi.fn(() => true),
}));

import { GET } from '../../../../app/api/admin/analytics/last-sold-data/route';

describe('GET /api/admin/analytics/last-sold-data', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('returns suburbs with correct bucket counts', async () => {
    mockQuery.mockResolvedValue({
      rows: [
        { suburb: 'Albany', address: '1 Alpha Cr, Albany', last_sold_date: '2024-06-01' },
        { suburb: 'Albany', address: '2 Beta St, Albany', last_sold_date: '2022-06-01' },
        { suburb: 'Albany', address: '3 Gamma St, Albany', last_sold_date: '2019-06-01' },
        { suburb: 'Albany', address: '4 Delta Dr, Albany', last_sold_date: '2014-06-01' },
        { suburb: 'Albany', address: '5 Epsilon Ln, Albany', last_sold_date: '2009-06-01' },
        { suburb: 'Albany', address: '6 Zeta Rd, Albany', last_sold_date: null },
        { suburb: 'Oteha', address: '7 The Ave, Oteha', last_sold_date: '2025-03-01' },
        { suburb: 'Oteha', address: '8 The Ave, Oteha', last_sold_date: null },
      ],
    });

    const req = new Request('http://localhost/api/admin/analytics/last-sold-data');
    const res = await GET(req);
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.suburbs).toHaveLength(2);

    const albany = json.suburbs.find((s: { suburb: string }) => s.suburb === 'Albany');
    expect(albany.total).toBe(6);
    expect(albany.buckets.find((b: { range: string }) => b.range === '0-3').count).toBe(1);
    expect(albany.buckets.find((b: { range: string }) => b.range === '3-5').count).toBe(1);
    expect(albany.buckets.find((b: { range: string }) => b.range === '5-10').count).toBe(1);
    expect(albany.buckets.find((b: { range: string }) => b.range === '10-15').count).toBe(1);
    expect(albany.buckets.find((b: { range: string }) => b.range === '15+').count).toBe(1);
    expect(albany.buckets.find((b: { range: string }) => b.range === 'no_data').count).toBe(1);

    const oteha = json.suburbs.find((s: { suburb: string }) => s.suburb === 'Oteha');
    expect(oteha.total).toBe(2);
    expect(oteha.buckets.find((b: { range: string }) => b.range === '0-3').count).toBe(1);
    expect(oteha.buckets.find((b: { range: string }) => b.range === 'no_data').count).toBe(1);
  });

  it('includes northShore aggregate with correct totals', async () => {
    mockQuery.mockResolvedValue({
      rows: [
        { suburb: 'Albany', address: '1 Test St, Albany', last_sold_date: '2024-01-15' },
        { suburb: 'Oteha', address: '2 Test St, Oteha', last_sold_date: null },
      ],
    });

    const req = new Request('http://localhost/api/admin/analytics/last-sold-data');
    const res = await GET(req);
    const json = await res.json();

    expect(json.northShore.total).toBe(2);
    expect(json.northShore.buckets.find((b: { range: string }) => b.range === '0-3').count).toBe(1);
    expect(json.northShore.buckets.find((b: { range: string }) => b.range === 'no_data').count).toBe(1);
  });

  it('returns percentages that sum to 100 per suburb', async () => {
    mockQuery.mockResolvedValue({
      rows: [
        { suburb: 'Albany', address: '1 A St, Albany', last_sold_date: '2024-01-15' },
        { suburb: 'Albany', address: '2 B St, Albany', last_sold_date: '2021-06-01' },
        { suburb: 'Albany', address: '3 C St, Albany', last_sold_date: '2018-03-10' },
        { suburb: 'Albany', address: '4 D St, Albany', last_sold_date: '2012-11-20' },
      ],
    });

    const req = new Request('http://localhost/api/admin/analytics/last-sold-data');
    const res = await GET(req);
    const json = await res.json();

    const albany = json.suburbs.find((s: { suburb: string }) => s.suburb === 'Albany');
    const pctSum = albany.buckets.reduce((sum: number, b: { percentage: number }) => sum + b.percentage, 0);
    expect(pctSum).toBe(100);
  });

  it('sorts suburbs by total descending', async () => {
    mockQuery.mockResolvedValue({
      rows: [
        { suburb: 'Oteha', address: '1 Test, Oteha', last_sold_date: '2024-01-15' },
        { suburb: 'Albany', address: '1 Test, Albany', last_sold_date: '2024-01-15' },
        { suburb: 'Albany', address: '2 Test, Albany', last_sold_date: '2024-01-15' },
      ],
    });

    const req = new Request('http://localhost/api/admin/analytics/last-sold-data');
    const res = await GET(req);
    const json = await res.json();

    expect(json.suburbs[0].suburb).toBe('Albany');
    expect(json.suburbs[1].suburb).toBe('Oteha');
  });

  it('returns 403 for non-super-admin', async () => {
    const { isSuperAdmin } = await import('@/lib/permissions');
    vi.mocked(isSuperAdmin).mockReturnValueOnce(false);

    const req = new Request('http://localhost/api/admin/analytics/last-sold-data');
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it('filters by type=all returns all listings (no additional WHERE)', async () => {
    mockQuery.mockResolvedValue({
      rows: [
        { suburb: 'Albany', address: '1 Test, Albany', last_sold_date: '2024-01-15' },
        { suburb: 'Oteha', address: '2 Test, Oteha', last_sold_date: null },
      ],
    });

    const req = new Request('http://localhost/api/admin/analytics/last-sold-data?type=all');
    const res = await GET(req);
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.suburbs).toHaveLength(2);
  });

  it('filters by type=house only includes house listings in SQL', async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    const req = new Request('http://localhost/api/admin/analytics/last-sold-data?type=house');
    const res = await GET(req);
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.suburbs).toHaveLength(0);
    expect(json.northShore.total).toBe(0);
  });

  it('filters by type=townhouse only includes townhouse/unit/apartment listings in SQL', async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    const req = new Request('http://localhost/api/admin/analytics/last-sold-data?type=townhouse');
    const res = await GET(req);
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.suburbs).toHaveLength(0);
    expect(json.northShore.total).toBe(0);
  });

  it('defaults to type=all when no type param provided', async () => {
    mockQuery.mockResolvedValue({
      rows: [
        { suburb: 'Albany', address: '1 Test, Albany', last_sold_date: '2024-01-15' },
      ],
    });

    const req = new Request('http://localhost/api/admin/analytics/last-sold-data');
    const res = await GET(req);
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.suburbs).toHaveLength(1);
    expect(json.suburbs[0].suburb).toBe('Albany');
  });

  it('generates valid SQL syntax (no stray AND after WHERE)', async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    const req = new Request('http://localhost/api/admin/analytics/last-sold-data?type=all');
    await GET(req);

    const sqlArg = mockQuery.mock.calls[0][0] as string;
    expect(sqlArg).not.toContain('WHERE  AND');
    expect(sqlArg).not.toContain('WHERE AND');
    expect(sqlArg).toMatch(/WHERE\s+\S/);
    expect(sqlArg).toMatch(/\n  AND /);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockQuery = vi.hoisted(() => vi.fn());

vi.mock('pg', () => ({
  Pool: vi.fn(() => ({
    query: mockQuery,
  })),
}));

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({ user: { email: 'admin@example.com' } }),
}));

vi.mock('@/lib/permissions', () => ({
  isAdmin: vi.fn(() => true),
}));

import { GET } from '../../../app/api/admin/realestate/route';
import { PATCH } from '../../../app/api/admin/realestate/[id]/route';

describe('GET /api/admin/realestate', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('SELECT COUNT(*) as total FROM real_estate')) {
        return Promise.resolve({ rows: [{ total: '2' }] });
      }

      if (sql.includes('FROM real_estate')) {
        return Promise.resolve({
          rows: [
            {
              id: 're-1',
              address: '15 Marine Parade',
              status: 'for Sale',
              data: '{}',
              listing_date: '2026-06-15',
              listing_date_raw: '15 Jun 2026',
              price_display: '$1,200,000',
              agent_name: 'John Smith',
              bedroom_count: 4,
              bathroom_count: 2,
              land_area: 801,
              floor_area: 220,
              property_url: 'https://example.com/re-1',
              original_link: null,
              region: 'Auckland',
              latitude: '-36.7061',
              longitude: '174.7297',
              cover_image_url: null,
              images: null,
              normalized_lead_address: null,
              address_fingerprint: null,
              property_type: 'House',
              description: 'Beautiful home with sea views',
              listing_number: 'RE12345',
              listing_date_parsed: '2026-06-15',
            },
            {
              id: 're-2',
              address: '2/910 East Coast Road',
              status: null,
              data: null,
              listing_date: null,
              listing_date_raw: null,
              price_display: null,
              agent_name: null,
              bedroom_count: 3,
              bathroom_count: 1,
              land_area: null,
              floor_area: 150,
              property_url: null,
              original_link: 'https://example.com/re-2',
              region: null,
              latitude: null,
              longitude: null,
              cover_image_url: null,
              images: null,
              normalized_lead_address: null,
              address_fingerprint: null,
              property_type: null,
              description: null,
              listing_number: null,
              listing_date_parsed: null,
            },
          ],
        });
      }

      return Promise.resolve({ rows: [] });
    });
  });

  it('returns paginated realestate listings', async () => {
    const req = new Request('http://localhost/api/admin/realestate?page=1&limit=18');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.listings).toHaveLength(2);
    expect(json.listings[0].id).toBe('re-1');
    expect(json.listings[0].address).toBe('15 Marine Parade');
    expect(json.listings[0].bedroom_count).toBe(4);
    expect(json.listings[0].bathroom_count).toBe(2);
    expect(json.pagination.total).toBe(2);
    expect(json.pagination.page).toBe(1);
  });

  it('filters by search term', async () => {
    const req = new Request('http://localhost/api/admin/realestate?search=Marine');
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(mockQuery.mock.calls.some((call: unknown[]) =>
      (call[0] as string).includes('ILIKE')
    )).toBe(true);
  });

  it('filters by region', async () => {
    const req = new Request('http://localhost/api/admin/realestate?region=Auckland');
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(mockQuery.mock.calls.some((call: unknown[]) =>
      (call[0] as string).includes('LOWER(r.region)')
    )).toBe(true);
  });

  it('filters by min bedrooms', async () => {
    const req = new Request('http://localhost/api/admin/realestate?min_bedrooms=3');
    const res = await GET(req);

    expect(res.status).toBe(200);
  });

  it('filters by city via address ILIKE', async () => {
    const req = new Request('http://localhost/api/admin/realestate?city=North+Shore+City');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const dataCalls = mockQuery.mock.calls.filter((call: unknown[]) =>
      (call[0] as string).includes('FROM real_estate') && !(call[0] as string).includes('COUNT(*)')
    );
    expect(dataCalls.length).toBeGreaterThan(0);
    expect((dataCalls[0][0] as string).includes('LOWER(r.city) LIKE')).toBe(true);
    expect(dataCalls[0][1]).toContain('%North Shore City%');
  });

  it('filters by suburb via suburb column', async () => {
    const req = new Request('http://localhost/api/admin/realestate?suburb=Albany');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const dataCalls = mockQuery.mock.calls.filter((call: unknown[]) =>
      (call[0] as string).includes('FROM real_estate') && !(call[0] as string).includes('COUNT(*)')
    );
    expect(dataCalls.length).toBeGreaterThan(0);
    expect((dataCalls[0][0] as string).includes('LOWER(r.suburb) LIKE')).toBe(true);
    expect(dataCalls[0][1]).toContain('%Albany%');
  });

  it('filters by property_type', async () => {
    const req = new Request('http://localhost/api/admin/realestate?property_type=House');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const dataCalls = mockQuery.mock.calls.filter((call: unknown[]) =>
      (call[0] as string).includes('FROM real_estate') && !(call[0] as string).includes('COUNT(*)')
    );
    expect(dataCalls.length).toBeGreaterThan(0);
    expect((dataCalls[0][0] as string).includes('LOWER(r.property_type)')).toBe(true);
    expect(dataCalls[0][1]).toContain('House');
  });

  it('returns property_type and description fields in response', async () => {
    const req = new Request('http://localhost/api/admin/realestate?page=1&limit=18');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.listings[0].property_type).toBe('House');
    expect(json.listings[0].description).toBe('Beautiful home with sea views');
    expect(json.listings[0].listing_number).toBe('RE12345');
    expect(json.listings[0].listing_date_parsed).toBe('2026-06-15');
  });

  it('returns 401 for unauthorized users', async () => {
    const { auth } = await import('@/lib/auth');
    (vi.mocked(auth) as any).mockResolvedValueOnce(null);

    const req = new Request('http://localhost/api/admin/realestate');
    const res = await GET(req);

    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/admin/realestate/[id]', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockQuery.mockResolvedValue({ rows: [] });
  });

  it('updates a listing with valid fields', async () => {
    const req = new Request('http://localhost/api/admin/realestate/re-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ price_display: '$1,300,000', status: 'sold' }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: 're-1' }) });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);

    const updateCall = mockQuery.mock.calls.find((call: unknown[]) =>
      (call[0] as string).includes('UPDATE real_estate')
    );
    expect(updateCall).toBeDefined();
  });

  it('returns 400 when no valid fields are provided', async () => {
    const req = new Request('http://localhost/api/admin/realestate/re-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invalid_field: 'test' }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: 're-1' }) });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('No valid fields to update');
  });

  it('returns 401 for unauthorized users', async () => {
    const { auth } = await import('@/lib/auth');
    (vi.mocked(auth) as any).mockResolvedValueOnce(null);

    const req = new Request('http://localhost/api/admin/realestate/re-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ price_display: '$1,300,000' }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: 're-1' }) });

    expect(res.status).toBe(401);
  });

  it('converts empty string values to null', async () => {
    const req = new Request('http://localhost/api/admin/realestate/re-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent_name: '' }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: 're-1' }) });

    expect(res.status).toBe(200);
  });
});

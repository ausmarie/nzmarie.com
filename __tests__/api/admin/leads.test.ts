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

import { GET, POST } from '../../../app/api/admin/leads/route';

const mockLeadRow = {
  id: 'lead-1',
  property_address: '2/23 Sartors Avenue',
  property_id: 'prop-1',
  street: 'Sartors Avenue',
  suburb: 'Hillcrest',
  city: 'Auckland',
  region: 'Auckland',
  owner_name: 'John Doe',
  owner_email: 'john@example.com',
  owner_phone: '0211234567',
  source: 'outreach',
  source_outreach_id: 'outreach-1',
  status: 'new',
  priority: 'medium',
  summary: 'Interested in selling',
  notes: 'Call back next week',
  next_action: 'Send report',
  next_action_at: '2026-08-01',
  created_at: '2026-07-23T00:00:00.000Z',
  updated_at: '2026-07-23T00:00:00.000Z',
  joined_property_id: 'prop-1',
  image_url: 'https://example.com/img.jpg',
  bedrooms: 3,
  bathrooms: 2,
  garages: 1,
  rv: '950000',
  last_sold_price: '880000',
  last_sold_date: '2023-06-15',
  build_year: 1998,
  floor_area: '180',
  land_area: '450',
  property_url: 'https://example.com/prop',
  description: 'Nice home',
  property_history: 'Sold 2020 for $800k',
  realestate_url: 'https://realestate.co.nz/prop',
  on_market_sale: true,
  sale_listing_status: 'for sale',
  sale_price: '$1,050,000',
  sale_agent: 'Jane Agent',
  on_market_rent: false,
  rent_listing_status: null,
  rent_price: null,
  outreach_id: 'outreach-1',
  outreach_campaign: 'May 2026',
  outreach_status: 'converted',
  sent_at: '2026-05-01T00:00:00.000Z',
  last_sent_at: '2026-05-01T00:00:00.000Z',
  total_send_count: 1,
};

describe('GET /api/admin/leads', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('should return leads with pagination', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: '1' }] })
      .mockResolvedValueOnce({ rows: [mockLeadRow] });

    const request = new Request('http://localhost:3000/api/admin/leads');
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].property_address).toBe('2/23 Sartors Avenue');
    expect(body.pagination).toEqual({ page: 1, limit: 50, total: 1, totalPages: 1 });
  });

  it('should execute count query on leads table only (no JOINs)', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: '0' }] })
      .mockResolvedValueOnce({ rows: [] });

    const request = new Request('http://localhost:3000/api/admin/leads');
    await GET(request);

    const countCall = mockQuery.mock.calls[0];
    const dataCall = mockQuery.mock.calls[1];

    expect(countCall[0]).toContain('SELECT COUNT(*) as total');
    expect(countCall[0]).toContain('FROM leads l');
    expect(countCall[0]).not.toContain('LEFT JOIN');

    expect(dataCall[0]).toContain('SELECT l.*');
    expect(dataCall[0]).toContain('LEFT JOIN properties');
    expect(dataCall[0]).not.toContain('COUNT(*) OVER()');
  });

  it('should return empty data when no leads', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: '0' }] })
      .mockResolvedValueOnce({ rows: [] });

    const request = new Request('http://localhost:3000/api/admin/leads');
    const response = await GET(request);
    const body = await response.json();

    expect(body.data).toHaveLength(0);
    expect(body.pagination.total).toBe(0);
    expect(body.pagination.totalPages).toBe(0);
  });

  it('should filter by status', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: '1' }] })
      .mockResolvedValueOnce({ rows: [mockLeadRow] });

    const request = new Request('http://localhost:3000/api/admin/leads?status=new');
    await GET(request);

    expect(mockQuery.mock.calls[0][0]).toContain('l.status = $1');
    expect(mockQuery.mock.calls[0][1]).toContain('new');
  });

  it('should filter by priority', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: '0' }] })
      .mockResolvedValueOnce({ rows: [] });

    const request = new Request('http://localhost:3000/api/admin/leads?priority=high');
    await GET(request);

    expect(mockQuery.mock.calls[0][0]).toContain('l.priority = $1');
    expect(mockQuery.mock.calls[0][1]).toContain('high');
  });

  it('should filter by source', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: '0' }] })
      .mockResolvedValueOnce({ rows: [] });

    const request = new Request('http://localhost:3000/api/admin/leads?source=outreach');
    await GET(request);

    expect(mockQuery.mock.calls[0][0]).toContain('l.source = $1');
    expect(mockQuery.mock.calls[0][1]).toContain('outreach');
  });

  it('should filter by suburb ILIKE', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: '0' }] })
      .mockResolvedValueOnce({ rows: [] });

    const request = new Request('http://localhost:3000/api/admin/leads?suburb=hill');
    await GET(request);

    expect(mockQuery.mock.calls[0][0]).toContain('l.suburb ILIKE $1');
    expect(mockQuery.mock.calls[0][1]).toContain('hill');
  });

  it('should search across multiple fields', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: '0' }] })
      .mockResolvedValueOnce({ rows: [] });

    const request = new Request('http://localhost:3000/api/admin/leads?search=john');
    await GET(request);

    const countSql = mockQuery.mock.calls[0][0];
    const countParams = mockQuery.mock.calls[0][1];

    expect(countSql).toContain('l.property_address ILIKE $1');
    expect(countSql).toContain('l.owner_name ILIKE $1');
    expect(countSql).toContain('l.owner_email ILIKE $1');
    expect(countParams).toContain('%john%');
  });

  it('should apply pagination', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: '10' }] })
      .mockResolvedValueOnce({ rows: [] });

    const request = new Request('http://localhost:3000/api/admin/leads?page=2&limit=5');
    const response = await GET(request);
    const body = await response.json();

    expect(body.pagination).toEqual({ page: 2, limit: 5, total: 10, totalPages: 2 });

    const dataSql = mockQuery.mock.calls[1][0];
    const dataParams = mockQuery.mock.calls[1][1];
    expect(dataSql).toContain('LIMIT $');
    expect(dataSql).toContain('OFFSET $');
    expect(dataParams).toContain(5);
    expect(dataParams).toContain(5);
  });

  it('should return 401 when not authenticated', async () => {
    const { auth } = await import('@/lib/auth');
    vi.mocked(auth).mockResolvedValueOnce(null as any);

    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: '0' }] })
      .mockResolvedValueOnce({ rows: [] });

    const request = new Request('http://localhost:3000/api/admin/leads');
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it('should return 500 on database error', async () => {
    mockQuery.mockRejectedValue(new Error('DB connection failed'));

    const request = new Request('http://localhost:3000/api/admin/leads');
    const response = await GET(request);

    expect(response.status).toBe(500);
  });
});

describe('POST /api/admin/leads', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('should create a lead and return it', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [mockLeadRow] });

    const request = new Request('http://localhost:3000/api/admin/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        property_address: '2/23 Sartors Avenue',
        owner_name: 'John Doe',
        owner_email: 'john@example.com',
        owner_phone: '0211234567',
        source: 'manual',
        status: 'new',
        priority: 'medium',
      }),
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.property_address).toBe('2/23 Sartors Avenue');
  });

  it('should return 400 when property_address is missing', async () => {
    const request = new Request('http://localhost:3000/api/admin/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ owner_name: 'John' }),
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Property address is required');
  });

  it('should lookup property_id from outreach_properties when source_outreach_id is given', async () => {
    const outreachResult = { rows: [{ property_id: 'prop-from-outreach' }] };
    const insertResult = { rows: [mockLeadRow] };
    const updateResult = { rows: [] };

    mockQuery
      .mockResolvedValueOnce(outreachResult)
      .mockResolvedValueOnce(insertResult)
      .mockResolvedValueOnce(updateResult);

    const request = new Request('http://localhost:3000/api/admin/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        property_address: '2/23 Sartors Avenue',
        source_outreach_id: 'outreach-1',
        source: 'outreach',
      }),
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockQuery.mock.calls[0][0]).toContain('SELECT property_id FROM outreach_properties');
    expect(mockQuery.mock.calls[0][1]).toContain('outreach-1');
  });

  it('should update outreach_properties converted_to_lead_id after creation', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ property_id: null }] })
      .mockResolvedValueOnce({ rows: [mockLeadRow] })
      .mockResolvedValueOnce({ rows: [] });

    const request = new Request('http://localhost:3000/api/admin/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        property_address: '2/23 Sartors Avenue',
        source_outreach_id: 'outreach-1',
        source: 'outreach',
      }),
    });
    await POST(request);

    expect(mockQuery.mock.calls[2][0]).toContain('UPDATE outreach_properties');
    expect(mockQuery.mock.calls[2][0]).toContain('converted_to_lead_id = $1');
  });

  it('should return 401 when not authenticated', async () => {
    const { auth } = await import('@/lib/auth');
    vi.mocked(auth).mockResolvedValueOnce(null as any);

    const request = new Request('http://localhost:3000/api/admin/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ property_address: 'Test' }),
    });
    const response = await POST(request);

    expect(response.status).toBe(401);
  });

  it('should trim whitespace from text fields', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [mockLeadRow] });

    const request = new Request('http://localhost:3000/api/admin/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        property_address: '  2/23 Sartors Avenue  ',
        owner_name: '  John Doe  ',
      }),
    });
    await POST(request);

    const insertParams = mockQuery.mock.calls[0][1];
    const addressParam = insertParams.find((p: unknown) => typeof p === 'string' && p.includes('Sartors'));
    expect(addressParam).toBe('2/23 Sartors Avenue');
  });

  it('should return 500 on database error', async () => {
    mockQuery.mockRejectedValue(new Error('DB connection failed'));

    const request = new Request('http://localhost:3000/api/admin/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ property_address: 'Test' }),
    });
    const response = await POST(request);

    expect(response.status).toBe(500);
  });
});

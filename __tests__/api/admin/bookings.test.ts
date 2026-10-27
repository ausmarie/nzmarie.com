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

const mockDbQuery = vi.hoisted(() => vi.fn());

vi.mock('@/lib/db', () => ({
  marieDB: { query: mockDbQuery },
}));

import { auth } from '@/lib/auth';
import { isAdmin } from '@/lib/permissions';
import { db } from '@/lib/drizzle';
import { GET } from '../../../app/api/admin/bookings/route';
import { PATCH } from '../../../app/api/admin/bookings/[id]/route';

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
  return new Request(`http://localhost/api/admin/bookings${search}`);
}

describe('GET /api/admin/bookings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ user: { email: 'admin@test.com' } } as any);
    vi.mocked(isAdmin).mockReturnValue(true);
  });

  it('returns 200 with bookings and pagination', async () => {
    vi.mocked(db.execute).mockResolvedValueOnce({
      rows: [{ column_name: 'region' }, { column_name: 'city' }],
    } as any);

    const mockRows = [
      { id: '1', client_name: 'John Smith', email: 'john@test.com', phone: '021555', property_address: '15 Marine Parade', suburb: 'Albany', region: 'Auckland', city: 'North Shore City', contact_status: 'new', priority: 'high', created_at: new Date(), agent_notes: null, follow_up_at: null, last_contact_at: null, timeline: null, motivation: null, language_preference: null, heard_from: null, property_type: null, source_page: null, utm_source: null, utm_medium: null, utm_campaign: null, email_hash: '', status: 'Pending', updated_at: new Date() },
    ];

    vi.mocked(db.select).mockImplementationOnce(() => createChain(mockRows));
    vi.mocked(db.select).mockImplementationOnce(() => createChain([{ total: 1 }]));

    vi.mocked(db.execute).mockResolvedValueOnce({
      rows: [{ region: 'Auckland', city: 'North Shore City', suburb: 'Albany', count: 1 }],
    } as any);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].client_name).toBe('John Smith');
    expect(body.pagination.total).toBe(1);
    expect(body.pagination.totalPages).toBe(1);
    expect(body.locationStats).toBeDefined();
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

  it('filters by suburb', async () => {
    vi.mocked(db.execute).mockResolvedValueOnce({
      rows: [{ column_name: 'region' }, { column_name: 'city' }],
    } as any);

    const mockRows = [
      { id: '2', client_name: 'Jane Doe', email: 'jane@test.com', phone: '021222', property_address: '2 Beach Rd', suburb: 'Takapuna', region: 'Auckland', city: 'North Shore City', contact_status: 'contacted', priority: 'medium', created_at: new Date(), agent_notes: null, follow_up_at: null, last_contact_at: null, timeline: null, motivation: null, language_preference: null, heard_from: null, property_type: null, source_page: null, utm_source: null, utm_medium: null, utm_campaign: null, email_hash: '', status: 'Pending', updated_at: new Date() },
    ];

    vi.mocked(db.select).mockImplementationOnce(() => createChain(mockRows));
    vi.mocked(db.select).mockImplementationOnce(() => createChain([{ total: 1 }]));

    vi.mocked(db.execute).mockResolvedValueOnce({ rows: [] } as any);

    const res = await GET(makeRequest({ suburb: 'Takapuna' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(1);
  });

  it('handles missing location columns gracefully', async () => {
    vi.mocked(db.execute).mockResolvedValueOnce({ rows: [] } as any);

    const mockRows = [
      { id: '3', client_name: 'Bob', email: 'bob@test.com', phone: '', property_address: '1 Main St', suburb: 'UnknownPlace', region: null, city: null, contact_status: 'new', priority: 'low', created_at: new Date(), agent_notes: null, follow_up_at: null, timeline: null, motivation: null, language_preference: null, heard_from: null, priority_source: null },
    ];

    vi.mocked(db.select).mockImplementationOnce(() => createChain(mockRows));
    vi.mocked(db.select).mockImplementationOnce(() => createChain([{ total: 1 }]));

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data[0].region).toBeNull();
    expect(body.data[0].city).toBeNull();
    expect(body.locationStats).toEqual([]);
  });

  it('shows the timeline-derived priority for auto rows', async () => {
    vi.mocked(db.execute).mockResolvedValueOnce({
      rows: [{ column_name: 'region' }, { column_name: 'city' }],
    } as any);

    const mockRows = [
      { id: '4', client_name: 'Margaret', email: 'm@test.com', phone: '021', property_address: '4 Carnmore Place', suburb: 'Torbay', region: 'Auckland', city: 'Auckland', contact_status: 'new', priority: 'medium', priority_source: 'auto', created_at: new Date(), timeline: 'just-exploring' },
    ];

    vi.mocked(db.select).mockImplementationOnce(() => createChain(mockRows));
    vi.mocked(db.select).mockImplementationOnce(() => createChain([{ total: 1 }]));
    vi.mocked(db.execute).mockResolvedValueOnce({ rows: [] } as any);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data[0].priority).toBe('low');
    expect(body.data[0].priority_source).toBe('auto');
  });

  it('keeps a manual priority override', async () => {
    vi.mocked(db.execute).mockResolvedValueOnce({
      rows: [{ column_name: 'region' }, { column_name: 'city' }],
    } as any);

    const mockRows = [
      { id: '5', client_name: 'Manual', email: 'manual@test.com', phone: '021', property_address: '5 Manual St', suburb: 'Torbay', region: 'Auckland', city: 'Auckland', contact_status: 'new', priority: 'high', priority_source: 'manual', created_at: new Date(), timeline: 'just-exploring' },
    ];

    vi.mocked(db.select).mockImplementationOnce(() => createChain(mockRows));
    vi.mocked(db.select).mockImplementationOnce(() => createChain([{ total: 1 }]));
    vi.mocked(db.execute).mockResolvedValueOnce({ rows: [] } as any);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data[0].priority).toBe('high');
    expect(body.data[0].priority_source).toBe('manual');
  });
});

describe('PATCH /api/admin/bookings/[id] — priority source', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ user: { email: 'admin@test.com' } } as any);
    vi.mocked(isAdmin).mockReturnValue(true);
    mockDbQuery.mockResolvedValue({ rows: [{ id: '1' }] });
  });

  function patchRequest(body: Record<string, unknown>) {
    return new Request('http://localhost/api/admin/bookings/1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('marks the priority as manual when a priority is submitted', async () => {
    const res = await PATCH(patchRequest({ priority: 'high' }), {
      params: Promise.resolve({ id: '1' }),
    });

    expect(res.status).toBe(200);
    const sql = String(mockDbQuery.mock.calls[0][0]);
    expect(sql).toContain("priority_source = CASE WHEN priority IS DISTINCT FROM $1 THEN 'manual'");
  });

  it('does not touch the priority source when priority is omitted', async () => {
    const res = await PATCH(patchRequest({ agent_notes: 'Called owner' }), {
      params: Promise.resolve({ id: '1' }),
    });

    expect(res.status).toBe(200);
    const sql = String(mockDbQuery.mock.calls[0][0]);
    expect(sql).not.toContain('priority_source');
  });
});

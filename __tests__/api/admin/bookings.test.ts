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
import { GET } from '../../../app/api/admin/bookings/route';

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
      { id: '3', client_name: 'Bob', email: 'bob@test.com', phone: '', property_address: '1 Main St', suburb: 'UnknownPlace', region: null, city: null, contact_status: 'new', priority: 'low', created_at: new Date(), agent_notes: null, follow_up_at: null, last_contact_at: null, timeline: null, motivation: null, language_preference: null, heard_from: null, property_type: null, source_page: null, utm_source: null, utm_medium: null, utm_campaign: null, email_hash: '', status: 'Pending', updated_at: new Date() },
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
});

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/redis', () => ({
  getSearchHistory: vi.fn(),
  saveSearchHistory: vi.fn(),
}));

import { auth } from '@/lib/auth';
import { getSearchHistory, saveSearchHistory } from '@/lib/redis';
import { GET, POST } from '../../../app/api/admin/search-history/route';

describe('GET /api/admin/search-history', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ user: { adminId: '1', email: 'admin@test.com' } } as any);
    vi.mocked(getSearchHistory).mockResolvedValue(['Forrest Hill', 'Sunnynook']);
  });

  it('returns 200 with search history', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual(['Forrest Hill', 'Sunnynook']);
    expect(getSearchHistory).toHaveBeenCalledWith(1);
  });

  it('returns empty array when no history exists', async () => {
    vi.mocked(getSearchHistory).mockResolvedValue([]);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual([]);
  });

  it('returns 401 when not authenticated', async () => {
    vi.mocked(auth).mockResolvedValue({ user: null } as any);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns 401 when adminId is missing', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { email: 'admin@test.com' } } as any);
    const res = await GET();
    expect(res.status).toBe(401);
  });
});

describe('POST /api/admin/search-history', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ user: { adminId: '1', email: 'admin@test.com' } } as any);
  });

  it('returns 200 and saves query', async () => {
    const req = new Request('http://localhost/api/admin/search-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'Albany' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(saveSearchHistory).toHaveBeenCalledWith(1, 'Albany');
  });

  it('trims whitespace from query', async () => {
    const req = new Request('http://localhost/api/admin/search-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '  Forrest Hill  ' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(saveSearchHistory).toHaveBeenCalledWith(1, 'Forrest Hill');
  });

  it('returns 400 for empty query', async () => {
    const req = new Request('http://localhost/api/admin/search-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 for non-string query', async () => {
    const req = new Request('http://localhost/api/admin/search-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 123 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 401 when not authenticated', async () => {
    vi.mocked(auth).mockResolvedValue({ user: null } as any);
    const req = new Request('http://localhost/api/admin/search-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'Albany' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});

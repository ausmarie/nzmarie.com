import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/admin/outreach/default-campaign/route';
import { auth } from '@/lib/auth';
import { marieDB } from '@/lib/db';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  marieDB: {
    query: vi.fn(),
    ensureOutreachTablesExist: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/lib/permissions', () => ({
  isAdmin: vi.fn().mockReturnValue(true),
}));

describe('POST /api/admin/outreach/default-campaign', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('saves the default campaign via an upsert', async () => {
    vi.mocked(auth).mockResolvedValueOnce({
      user: { email: 'admin@test.com' },
    } as any);
    vi.mocked(marieDB.query).mockResolvedValueOnce({ rows: [] } as any);

    const response = await POST(
      new Request('http://localhost:3000/api/admin/outreach/default-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign: '2026_Q2_Torbay' }),
      })
    );
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);

    expect(marieDB.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO admin_settings'),
      ['default_outreach_campaign', '2026_Q2_Torbay', 'admin@test.com']
    );
  });

  it('rejects empty campaigns', async () => {
    vi.mocked(auth).mockResolvedValueOnce({
      user: { email: 'admin@test.com' },
    } as any);

    const response = await POST(
      new Request('http://localhost:3000/api/admin/outreach/default-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign: '   ' }),
      })
    );
    expect(response.status).toBe(400);
  });

  it('returns 401 for non-admin users', async () => {
    vi.mocked(auth).mockResolvedValueOnce(undefined as any);

    const response = await POST(
      new Request('http://localhost:3000/api/admin/outreach/default-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign: '2026_Q2_Torbay' }),
      })
    );
    expect(response.status).toBe(401);
  });
});

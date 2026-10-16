import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '@/app/api/admin/outreach/default-report/route';
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

describe('default-report API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValueOnce({ user: { email: 'admin@test.com' } } as any);
  });

  it('POST saves the default report as JSON in admin_settings with quarter', async () => {
    vi.mocked(marieDB.query).mockResolvedValueOnce({ rows: [] } as any);

    const response = await POST(
      new Request('http://localhost:3000/api/admin/outreach/default-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suburb: 'Oteha', label: '2026-Q2', quarter: '2026-Q2' }),
      })
    );
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);

    expect(marieDB.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO admin_settings'),
      ['default_outreach_report_2026-Q2', JSON.stringify({ suburb: 'Oteha', label: '2026-Q2' }), 'admin@test.com']
    );
  });

  it('POST saves default report without quarter (legacy)', async () => {
    vi.mocked(marieDB.query).mockResolvedValueOnce({ rows: [] } as any);

    const response = await POST(
      new Request('http://localhost:3000/api/admin/outreach/default-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suburb: 'Oteha', label: '2026-Q2' }),
      })
    );
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);

    expect(marieDB.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO admin_settings'),
      ['default_outreach_report', JSON.stringify({ suburb: 'Oteha', label: '2026-Q2' }), 'admin@test.com']
    );
  });

  it('POST rejects empty suburb or label', async () => {
    const response = await POST(
      new Request('http://localhost:3000/api/admin/outreach/default-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suburb: 'Oteha', label: '   ' }),
      })
    );
    expect(response.status).toBe(400);
  });

  it('POST returns 401 for unauthenticated users', async () => {
    vi.mocked(auth).mockReset();
    vi.mocked(auth).mockResolvedValueOnce(undefined as any);

    const response = await POST(
      new Request('http://localhost:3000/api/admin/outreach/default-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suburb: 'Oteha', label: '2026-Q2', quarter: '2026-Q2' }),
      })
    );
    expect(response.status).toBe(401);
  });

  it('GET returns the stored default report for quarter', async () => {
    vi.mocked(marieDB.query).mockResolvedValueOnce({
      rows: [{ setting_value: JSON.stringify({ suburb: 'Oteha', label: '2026-Q2' }) }],
    } as any);

    const response = await GET(new Request('http://localhost:3000/api/admin/outreach/default-report?quarter=2026-Q2'));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.defaultReport).toEqual({ suburb: 'Oteha', label: '2026-Q2' });
  });

  it('GET returns the stored default report without quarter (legacy)', async () => {
    vi.mocked(marieDB.query).mockResolvedValueOnce({
      rows: [{ setting_value: JSON.stringify({ suburb: 'Oteha', label: '2026-Q2' }) }],
    } as any);

    const response = await GET(new Request('http://localhost:3000/api/admin/outreach/default-report'));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.defaultReport).toEqual({ suburb: 'Oteha', label: '2026-Q2' });
  });

  it('GET returns null default when nothing is stored', async () => {
    vi.mocked(marieDB.query).mockResolvedValueOnce({ rows: [] } as any);

    const response = await GET(new Request('http://localhost:3000/api/admin/outreach/default-report?quarter=2026-Q2'));
    const data = await response.json();
    expect(data.defaultReport).toBeNull();
  });
});
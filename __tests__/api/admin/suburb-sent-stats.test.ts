import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/admin/outreach/suburb-sent-stats/route';
import { auth } from '@/lib/auth';
import { marieDB } from '@/lib/db';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  marieDB: {
    query: vi.fn().mockResolvedValue({ rows: [] }),
    ensureOutreachTablesExist: vi.fn(),
  },
}));

vi.mock('@/lib/permissions', () => ({
  isAdmin: vi.fn().mockReturnValue(true),
}));

function mockAuth() {
  vi.mocked(auth).mockResolvedValueOnce({
    user: { email: 'nzlouis.com@gmail.com' },
  } as any);
}

describe('GET /api/admin/outreach/suburb-sent-stats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 if unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValueOnce(undefined as any);
    const response = await GET(
      new Request('http://localhost:3000/api/admin/outreach/suburb-sent-stats')
    );
    expect(response.status).toBe(401);
  });

  it('returns per-suburb totals from rows', async () => {
    mockAuth();
    vi.mocked(marieDB.query).mockResolvedValueOnce({
      rows: [
        { suburb: 'Oteha', total: 100, sent: 60, unsent: 40 },
        { suburb: 'Torbay', total: 50, sent: 10, unsent: 35 },
      ],
    } as any);

    const response = await GET(
      new Request('http://localhost:3000/api/admin/outreach/suburb-sent-stats')
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.stats.Oteha).toEqual({ total: 100, sent: 60, unsent: 40 });
    expect(body.stats.Torbay).toEqual({ total: 50, sent: 10, unsent: 35 });
  });

  it('uses campaign regex and drops global sent heuristics when quarter is set', async () => {
    mockAuth();
    vi.mocked(marieDB.query).mockResolvedValueOnce({ rows: [] } as any);

    const response = await GET(
      new Request('http://localhost:3000/api/admin/outreach/suburb-sent-stats?quarter=2026-Q3')
    );
    expect(response.status).toBe(200);

    const sql = vi.mocked(marieDB.query).mock.calls[0][0] as string;
    const params = vi.mocked(marieDB.query).mock.calls[0][1] as unknown[];
    expect(sql).toContain('campaign_key ~ $3');
    expect(sql).toContain('op.last_campaign ~ $3');
    expect(sql).not.toContain("op.status = 'sent'");
    expect(sql).not.toContain('total_send_count');
    expect(sql).toContain('no_junk_mail');
    expect(params).toContain('Q3');
    expect(params).toContain(2026);
    expect(params).toContain('^2026[_-]Q3');
  });

  it('keeps global sent heuristics when quarter is not set', async () => {
    mockAuth();
    vi.mocked(marieDB.query).mockResolvedValueOnce({ rows: [] } as any);

    const response = await GET(
      new Request('http://localhost:3000/api/admin/outreach/suburb-sent-stats')
    );
    expect(response.status).toBe(200);

    const sql = vi.mocked(marieDB.query).mock.calls[0][0] as string;
    expect(sql).toContain("op.status = 'sent'");
    expect(sql).toContain('COALESCE(op.total_send_count, 0) > 0');
    expect(sql).not.toContain('campaign_key ~');
  });
});

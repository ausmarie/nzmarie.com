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

  it('uses indexed campaign ranges and drops global sent heuristics when a period is set', async () => {
    mockAuth();
    vi.mocked(marieDB.query).mockResolvedValueOnce({ rows: [] } as any);

    const response = await GET(
      new Request('http://localhost:3000/api/admin/outreach/suburb-sent-stats?quarter=2026-Q3')
    );
    expect(response.status).toBe(200);

    const sql = vi.mocked(marieDB.query).mock.calls[0][0] as string;
    const params = vi.mocked(marieDB.query).mock.calls[0][1] as unknown[];
    expect(sql).toContain('WITH period_sent_properties AS');
    expect(sql).toContain('sl.campaign_key >= $3 AND sl.campaign_key < $4');
    expect(sql).toContain('op.last_campaign >= $7 AND op.last_campaign < $8');
    expect(sql).not.toContain("op.status = 'sent'");
    expect(sql).not.toContain('total_send_count');
    expect(sql).toContain('no_junk_mail');
    expect(params).toContain('Q3');
    expect(params).toContain(2026);
    expect(params).toContain('2026_Q3');
    expect(params).toContain('2026-Q3');
  });

  it('uses indexed campaign prefix ranges for a monthly period', async () => {
    mockAuth();
    vi.mocked(marieDB.query).mockResolvedValueOnce({ rows: [] } as any);

    const response = await GET(
      new Request('http://localhost:3000/api/admin/outreach/suburb-sent-stats?quarter=2026-10')
    );
    expect(response.status).toBe(200);

    const sql = vi.mocked(marieDB.query).mock.calls[0][0] as string;
    const params = vi.mocked(marieDB.query).mock.calls[0][1] as unknown[];
    expect(sql).toContain('sl.campaign_key >= $3 AND sl.campaign_key < $4');
    expect(sql).not.toContain('campaign_key ~');
    expect(params).toEqual(expect.arrayContaining([
      '2026_M10', '2026_M11',
      '2026-M10', '2026-M11',
      '2026_10', '2026_11',
      '2026-10', '2026-11',
    ]));
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

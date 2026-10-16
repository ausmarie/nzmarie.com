import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET as campaignStatsGET } from '@/app/api/admin/outreach/campaign-stats/route';
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

describe('GET /api/admin/outreach/campaign-stats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds available campaigns from uploaded report sets merged with historical send-log campaigns', async () => {
    vi.mocked(auth).mockResolvedValueOnce({
      user: { email: 'admin@test.com' },
    } as any);

    vi.mocked(marieDB.query)
      .mockResolvedValueOnce({
        rows: [{ setting_value: '2026_Q2_Torbay' }],
      } as any)
      .mockResolvedValueOnce({
        rows: [
          { suburb: 'Torbay', year: 2026, quarter: 'Q2', latest_uploaded_at: '2026-08-01T00:00:00.000Z' },
          { suburb: 'Oteha', year: 2026, quarter: 'Q1', latest_uploaded_at: '2026-07-01T00:00:00.000Z' },
        ],
      } as any)
      .mockResolvedValueOnce({
        rows: [
          { campaign_key: '2026_Q2_Torbay', latest_sent_at: '2026-08-02T00:00:00.000Z' },
          { campaign_key: '2025_Q4_Takapuna', latest_sent_at: '2025-12-01T00:00:00.000Z' },
        ],
      } as any);

    const response = await campaignStatsGET(
      new Request('http://localhost:3000/api/admin/outreach/campaign-stats')
    );
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.available_campaigns).toContain('2026_Q2_Torbay');
    expect(data.available_campaigns).toContain('2026_Q1_Oteha');
    expect(data.available_campaigns).toContain('2025_Q4_Takapuna');
    // Most recently uploaded report first (matches the Outreach Filter by Report order).
    expect(data.available_campaigns[0]).toBe('2026_Q2_Torbay');
    // Send-log-only campaigns (no active report upload) sort after report-backed ones.
    expect(data.available_campaigns[data.available_campaigns.length - 1]).toBe('2025_Q4_Takapuna');
    // Admin-configured default campaign is surfaced so the page can pre-select it
    expect(data.default_campaign).toBe('2026_Q2_Torbay');
  });

  it('orders campaigns by most recent report upload (mirroring Filter by Report), send-log-only keys last', async () => {
    vi.useFakeTimers();
    // Bump the clock past the campaign-list cache TTL so the list is re-queried.
    vi.setSystemTime(Date.now() + 10 * 60 * 1000);

    vi.mocked(auth).mockResolvedValueOnce({
      user: { email: 'admin@test.com' },
    } as any);

    vi.mocked(marieDB.query)
      .mockResolvedValueOnce({ rows: [] } as any)
      .mockResolvedValueOnce({
        rows: [
          { suburb: 'Oteha', year: 2026, quarter: 'Q1', latest_uploaded_at: '2026-03-01T00:00:00.000Z' },
          { suburb: 'Torbay', year: 2026, quarter: 'Q2', latest_uploaded_at: '2026-08-01T00:00:00.000Z' },
          { suburb: 'Albany', year: 2025, quarter: 'Q4', latest_uploaded_at: '2026-06-15T00:00:00.000Z' },
        ],
      } as any)
      .mockResolvedValueOnce({
        rows: [
          { campaign_key: '2025_Q4_Albany', latest_sent_at: '2025-12-01T00:00:00.000Z' },
          { campaign_key: 'Xmas2025', latest_sent_at: '2025-12-10T00:00:00.000Z' },
        ],
      } as any);

    const response = await campaignStatsGET(
      new Request('http://localhost:3000/api/admin/outreach/campaign-stats')
    );
    expect(response.status).toBe(200);

    const data = await response.json();
    // Torbay's report was uploaded most recently → first. Albany was uploaded
    // after Oteha even though its report period is older → before Oteha.
    expect(data.available_campaigns[0]).toBe('2026_Q2_Torbay');
    expect(data.available_campaigns[1]).toBe('2025_Q4_Albany');
    expect(data.available_campaigns[2]).toBe('2026_Q1_Oteha');
    // Send-log-only keys with no active report upload sort last.
    expect(data.available_campaigns[data.available_campaigns.length - 1]).toBe('Xmas2025');

    vi.useRealTimers();
  });

  it('returns 401 for non-admin users', async () => {
    vi.mocked(auth).mockResolvedValueOnce(undefined as any);

    const response = await campaignStatsGET(
      new Request('http://localhost:3000/api/admin/outreach/campaign-stats')
    );
    expect(response.status).toBe(401);
  });

  it('counts Pending as the full pending+sent list (excludes liked), split into unsent/sent/no-junk', async () => {
    vi.mocked(auth).mockResolvedValueOnce({
      user: { email: 'admin@test.com' },
    } as any);

    // Query order for a per-campaign request:
    // 1. daily sends by campaign_key
    // 2. daily pending list (+ no-junk flags)
    // 3. interacted/converted status
    // 4. remaining (unsent)
    // 5. scans
    // 6. business card scans
    vi.mocked(marieDB.query)
      .mockResolvedValueOnce({
        rows: [
          { send_date: '2026-08-01', total_sent: 100 },
          { send_date: '2026-08-02', total_sent: 75 },
        ],
      } as any)
      .mockResolvedValueOnce({
        rows: [
          { day: '2026-06-01', daily_pending: 200, daily_no_junk: 50 },
          { day: '2026-06-02', daily_pending: 74, daily_no_junk: 27 },
        ],
      } as any)
      .mockResolvedValueOnce({ rows: [{ status: 'interacted', count: 2 }] } as any)
      .mockResolvedValueOnce({ rows: [{ remaining: 22 }] } as any)
      .mockResolvedValueOnce({ rows: [] } as any)
      .mockResolvedValueOnce({ rows: [] } as any);

    const response = await campaignStatsGET(
      new Request('http://localhost:3000/api/admin/outreach/campaign-stats?campaign=2026_Q2_Torbay')
    );
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.summary.pending_count).toBe(274);
    expect(data.summary.sent_count).toBe(175);
    expect(data.summary.no_junk_mail_count).toBe(77);
    expect(data.summary.remaining_count).toBe(22);
    expect(data.summary.remaining_count + data.summary.sent_count + data.summary.no_junk_mail_count)
      .toBe(data.summary.pending_count);
  });

  it('aggregates daily_scans using new devices for uv and captures sql query', async () => {
    vi.mocked(auth).mockResolvedValueOnce({
      user: { email: 'admin@test.com' },
    } as any);

    let capturedScanSql = '';
    vi.mocked(marieDB.query)
      .mockResolvedValueOnce({ rows: [] } as any)
      .mockResolvedValueOnce({ rows: [] } as any)
      .mockResolvedValueOnce({ rows: [] } as any)
      .mockResolvedValueOnce({ rows: [] } as any)
      .mockImplementationOnce(((sql: string) => {
        capturedScanSql = sql;
        return {
          rows: [
            { scan_date: '2026-08-01', pv: 10, uv: 4 },
            { scan_date: '2026-08-02', pv: 5, uv: 2 },
          ],
        };
      }) as any)
      .mockResolvedValueOnce({
        rows: [
          { scan_date: '2026-08-01', pv: 8, uv: 3 },
        ],
      } as any);

    const response = await campaignStatsGET(
      new Request('http://localhost:3000/api/admin/outreach/campaign-stats?campaign=2026_Q2_Oteha')
    );
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(capturedScanSql).toContain('COUNT(*) FILTER (WHERE is_new_device = TRUE)::int AS uv');
    expect(data.summary.total_scans_pv).toBe(15);
    expect(data.summary.total_scans_uv).toBe(6);
    expect(data.business_card_summary).toEqual({ pv: 8, uv: 3 });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/permissions', () => ({
  isAdmin: vi.fn(),
}));

vi.mock('@/lib/drizzle', () => ({
  db: { execute: vi.fn() },
}));

vi.mock('@/lib/redis', () => ({
  getCachedOrFetch: vi.fn((_key: string, fn: () => Promise<unknown>) => fn()),
}));

vi.mock('@/lib/campaign-tracker', () => ({
  ensureCampaignTablesExist: vi.fn(),
}));

import { auth } from '@/lib/auth';
import { isAdmin } from '@/lib/permissions';
import { db } from '@/lib/drizzle';
import { GET } from '../../../app/api/admin/dashboard/stats/route';

function makeRequest(suburb?: string) {
  const url = suburb
    ? `http://localhost/api/admin/dashboard/stats?suburb=${suburb}`
    : 'http://localhost/api/admin/dashboard/stats';
  return new Request(url);
}

describe('GET /api/admin/dashboard/stats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ user: { email: 'admin@test.com' } } as any);
    vi.mocked(isAdmin).mockReturnValue(true);
  });

  it('returns 200 with stats structure', async () => {
    const mockRow = {
      new_leads: '5',
      high_priority_leads: '2',
      pending_outreach: '10',
      sent_outreach: '20',
      today_followups: '3',
      overdue_followups: '1',
      today_downloads: '7',
      total_downloads: '100',
      month_downloads: '30',
      total_bookings: '50',
      month_bookings: '12',
      qr_codes_total: '8',
      pdf_reports_total: '15',
      outreach_by_suburb: [{ suburb: 'Albany', pending_count: 5, sent_count: 10, total_count: 15 }],
      recent_downloads: [{ id: '1', email: 'a@b.com', name: 'T', suburb: 'Albany', downloaded_at: new Date().toISOString(), source: 'organic', tracking_code: null }],
    };

    vi.mocked(db.execute).mockResolvedValue({ rows: [mockRow] } as any);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.stats.newLeads).toBe(5);
    expect(body.stats.highPriorityLeads).toBe(2);
    expect(body.stats.pendingOutreach).toBe(10);
    expect(body.stats.sentOutreach).toBe(20);
    expect(body.stats.sentSummary).toEqual({
      total_sent: 10,
      suburb_count: 1,
      suburbs: [{ suburb: 'Albany', sent_count: 10 }],
      quarterly: [],
    });
    expect(body.stats.outreachBySuburb).toHaveLength(1);
    expect(body.stats.scanStats).toEqual({
      total_scans: 0,
      total_unique: 0,
      total_new_devices: 0,
      campaigns: [],
    });
    expect(body.stats.downloadsBySuburb).toEqual([]);
    expect(body.stats.recentDownloads).toHaveLength(1);
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

  it('returns zeroes when all counts are null', async () => {
    const emptyRow = {
      new_leads: null, high_priority_leads: null, pending_outreach: null,
      sent_outreach: null, today_followups: null, overdue_followups: null,
      today_downloads: null, total_downloads: null, month_downloads: null,
      total_bookings: null, month_bookings: null, qr_codes_total: null,
      pdf_reports_total: null, outreach_by_suburb: null, recent_downloads: null,
    };

    vi.mocked(db.execute).mockResolvedValue({ rows: [emptyRow] } as any);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.stats.newLeads).toBe(0);
    expect(body.stats.outreachBySuburb).toEqual([]);
    expect(body.stats.recentDownloads).toEqual([]);
  });

  it('passes suburb filter to query', async () => {
    const mockRow = {
      new_leads: '3', high_priority_leads: '1', pending_outreach: '5',
      sent_outreach: '10', today_followups: '2', overdue_followups: '0',
      today_downloads: '4', total_downloads: '50', month_downloads: '15',
      total_bookings: '25', month_bookings: '8', qr_codes_total: '4',
      pdf_reports_total: '10', outreach_by_suburb: null, recent_downloads: null,
    };

    vi.mocked(db.execute).mockResolvedValue({ rows: [mockRow] } as any);

    const res = await GET(makeRequest('Takapuna'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.suburb).toBe('Takapuna');
    expect(body.stats.newLeads).toBe(3);
  });

  it('queries live outreach tables for sent summary', async () => {
    const mockRow = {
      new_leads: '1', high_priority_leads: '0', pending_outreach: '2',
      sent_outreach: '0', today_followups: '0', overdue_followups: '0',
      today_downloads: '0', total_downloads: '0', month_downloads: '0',
      total_bookings: '0', month_bookings: '0', qr_codes_total: '0',
      pdf_reports_total: '0', outreach_by_suburb: null, recent_downloads: null,
      sent_summary_suburbs: [
        { suburb: 'Albany', sent_count: 5 },
        { suburb: 'Torbay', sent_count: 3 },
      ],
      sent_summary_suburb_count: '2',
      sent_summary_total_sent: '8',
    };

    let capturedSql = '';
    vi.mocked(db.execute).mockImplementation(((sql: any) => {
      capturedSql += JSON.stringify(sql?.queryChunks ?? []);
      return { rows: [mockRow] };
    }) as any);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(capturedSql).toContain('FROM outreach_properties');
    expect(capturedSql).toContain('WHERE LOWER(status) = \'sent\'');
    expect(capturedSql).toContain('FROM campaign_analytics');
    expect(capturedSql).not.toContain('outreach_selected_properties');
    expect(body.stats.sentSummary).toEqual({
      total_sent: 8,
      suburb_count: 2,
      suburbs: [
        { suburb: 'Albany', sent_count: 5 },
        { suburb: 'Torbay', sent_count: 3 },
      ],
      quarterly: [],
    });
  });

  it('returns scan stats and normalizes campaign names', async () => {
    const mockRow = {
      new_leads: '1', high_priority_leads: '0', pending_outreach: '0',
      sent_outreach: '0', today_followups: '0', overdue_followups: '0',
      today_downloads: '0', total_downloads: '0', month_downloads: '0',
      total_bookings: '0', month_bookings: '0', qr_codes_total: '0',
      pdf_reports_total: '0', outreach_by_suburb: null, recent_downloads: null,
      total_scans: '42',
      total_unique_scans: '18',
      scan_campaigns: [
        { campaign_key: '2026_Q2_Torbay', campaign_name: 'Torbay campaign', total_pv: '30', total_uv: '12' },
        { campaign_key: '2026_Q2_Albany', campaign_name: '', total_pv: '12', total_uv: '6' },
      ],
    };

    vi.mocked(db.execute).mockResolvedValue({ rows: [mockRow] } as any);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.stats.scanStats).toEqual({
      total_scans: 42,
      total_unique: 18,
      total_new_devices: 0,
      campaigns: [
        { campaign_key: '2026_Q2_Torbay', campaign_name: 'Torbay Campaign', total_pv: 30, total_uv: 12, new_devices: 0 },
        { campaign_key: '2026_Q2_Albany', campaign_name: '2026 Q2 Albany', total_pv: 12, total_uv: 6, new_devices: 0 },
      ],
    });
  });

  it('sorts scan campaigns by new_devices DESC, then total_pv DESC, then name ASC', async () => {
    const mockRow = {
      new_leads: '0', high_priority_leads: '0', pending_outreach: '0',
      sent_outreach: '0', today_followups: '0', overdue_followups: '0',
      today_downloads: '0', total_downloads: '0', month_downloads: '0',
      total_bookings: '0', month_bookings: '0', qr_codes_total: '0',
      pdf_reports_total: '0', outreach_by_suburb: null, recent_downloads: null,
      total_scans: '100',
      total_unique_scans: '50',
      total_new_devices: '30',
      scan_campaigns: [
        { campaign_key: 'c1', campaign_name: 'Sub A', total_pv: '50', total_uv: '20', new_devices: '5' },
        { campaign_key: 'c2', campaign_name: 'Sub B', total_pv: '20', total_uv: '15', new_devices: '15' },
        { campaign_key: 'c3', campaign_name: 'Sub C', total_pv: '80', total_uv: '15', new_devices: '5' },
        { campaign_key: 'c4', campaign_name: 'Sub D', total_pv: '10', total_uv: '10', new_devices: '15' },
      ],
    };

    vi.mocked(db.execute).mockResolvedValue({ rows: [mockRow] } as any);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    const campaigns = body.stats.scanStats.campaigns;
    expect(campaigns.map((c: any) => c.campaign_name)).toEqual([
      'Sub B',
      'Sub D',
      'Sub C',
      'Sub A',
    ]);
  });

  it('returns downloads by suburb breakdown', async () => {
    const mockRow = {
      new_leads: '1', high_priority_leads: '0', pending_outreach: '0',
      sent_outreach: '0', today_followups: '0', overdue_followups: '0',
      today_downloads: '2', total_downloads: '12', month_downloads: '5',
      total_bookings: '0', month_bookings: '0', qr_codes_total: '0',
      pdf_reports_total: '0', outreach_by_suburb: null, recent_downloads: null,
      downloads_by_suburb: [
        { suburb: 'Torbay', download_count: '7' },
        { suburb: 'Albany', download_count: '5' },
      ],
    };

    vi.mocked(db.execute).mockResolvedValue({ rows: [mockRow] } as any);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.stats.totalDownloads).toBe(12);
    expect(body.stats.downloadsBySuburb).toEqual([
      { suburb: 'Torbay', download_count: 7 },
      { suburb: 'Albany', download_count: 5 },
    ]);
  });

  it('returns dispatch trend merging sent and junk buckets', async () => {
    const mockRow = {
      new_leads: '1', high_priority_leads: '0', pending_outreach: '0',
      sent_outreach: '0', today_followups: '0', overdue_followups: '0',
      today_downloads: '0', total_downloads: '0', month_downloads: '0',
      total_bookings: '0', month_bookings: '0', qr_codes_total: '0',
      pdf_reports_total: '0', outreach_by_suburb: null, recent_downloads: null,
      sent_monthly: [
        { suburb: 'Torbay', bucket: '2026-07-01', sent: '10' },
        { suburb: 'Torbay', bucket: '2026-08-01', sent: '5' },
        { suburb: 'Albany', bucket: '2026-07-01', sent: '3' },
      ],
      junk_monthly: [
        { suburb: 'Torbay', bucket: '2026-07-01', junk: '2' },
        { suburb: 'Albany', bucket: '2026-07-01', junk: '1' },
      ],
      sent_quarterly: [
        { suburb: 'Torbay', bucket: '2026-07-01', sent: '15' },
      ],
      junk_quarterly: [
        { suburb: 'Torbay', bucket: '2026-07-01', junk: '2' },
      ],
      sent_daily: [], junk_daily: [], sent_weekly: [], junk_weekly: [],
      dispatch_by_suburb: [
        { suburb: 'Torbay', sent_count: '15', junk_count: '2', total_count: '20', first_sent_at: '2026-07-02T01:00:00.000Z', last_sent_at: '2026-08-10T01:00:00.000Z' },
        { suburb: 'Albany', sent_count: '3', junk_count: '1', total_count: '4', first_sent_at: null, last_sent_at: null },
      ],
    };

    vi.mocked(db.execute).mockResolvedValue({ rows: [mockRow] } as any);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.stats.dispatchTrend.monthly).toEqual([
      { bucket: '2026-07-01', sent: 13, junk: 3 },
      { bucket: '2026-08-01', sent: 5, junk: 0 },
    ]);
    expect(body.stats.dispatchTrend.quarterly).toEqual([
      { bucket: '2026-07-01', sent: 15, junk: 2 },
    ]);
    expect(body.stats.dispatchTrend.daily).toEqual([]);
    expect(body.stats.dispatchTrend.seriesBySuburb.monthly['Torbay-Q2-2026']).toEqual([
      { bucket: '2026-07-01', sent: 10, junk: 2 },
      { bucket: '2026-08-01', sent: 5, junk: 0 },
    ]);
    expect(body.stats.dispatchTrend.bySuburb).toEqual([
      {
        suburb: 'Torbay-Q2-2026',
        raw_suburb: 'Torbay',
        quarter_key: null,
        report_url: null,
        sent_count: 15,
        junk_count: 2,
        unsent_count: 3,
        total_count: 20,
        first_sent_at: '2026-07-02T01:00:00.000Z',
        last_sent_at: '2026-08-10T01:00:00.000Z',
      },
      {
        suburb: 'Albany-Q2-2026',
        raw_suburb: 'Albany',
        quarter_key: null,
        report_url: null,
        sent_count: 3,
        junk_count: 1,
        unsent_count: 0,
        total_count: 4,
        first_sent_at: null,
        last_sent_at: null,
      },
    ]);
  });

  it('filters dispatch trend by selected suburb', async () => {
    const mockRow = {
      new_leads: '1', high_priority_leads: '0', pending_outreach: '0',
      sent_outreach: '0', today_followups: '0', overdue_followups: '0',
      today_downloads: '0', total_downloads: '0', month_downloads: '0',
      total_bookings: '0', month_bookings: '0', qr_codes_total: '0',
      pdf_reports_total: '0', outreach_by_suburb: null, recent_downloads: null,
      sent_monthly: [
        { suburb: 'Torbay', bucket: '2026-07-01', sent: '10' },
        { suburb: 'Albany', bucket: '2026-07-01', sent: '3' },
      ],
      junk_monthly: [
        { suburb: 'Torbay', bucket: '2026-07-01', junk: '2' },
      ],
      sent_quarterly: [], junk_quarterly: [], sent_daily: [], junk_daily: [], sent_weekly: [], junk_weekly: [],
      dispatch_by_suburb: [
        { suburb: 'Torbay', sent_count: '10', junk_count: '2', total_count: '12', first_sent_at: null, last_sent_at: null },
        { suburb: 'Albany', sent_count: '3', junk_count: '0', total_count: '3', first_sent_at: null, last_sent_at: null },
      ],
    };

    vi.mocked(db.execute).mockResolvedValue({ rows: [mockRow] } as any);

    const res = await GET(makeRequest('Torbay'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.stats.dispatchTrend.monthly).toEqual([
      { bucket: '2026-07-01', sent: 10, junk: 2 },
    ]);
    expect(body.stats.dispatchTrend.bySuburb).toEqual([
      {
        suburb: 'Torbay-Q2-2026',
        raw_suburb: 'Torbay',
        quarter_key: null,
        report_url: null,
        sent_count: 10,
        junk_count: 2,
        unsent_count: 0,
        total_count: 12,
        first_sent_at: null,
        last_sent_at: null,
      },
    ]);
  });

  it('orders dispatch by suburb by most recent sent date first', async () => {
    const mockRow = {
      new_leads: '1', high_priority_leads: '0', pending_outreach: '0',
      sent_outreach: '0', today_followups: '0', overdue_followups: '0',
      today_downloads: '0', total_downloads: '0', month_downloads: '0',
      total_bookings: '0', month_bookings: '0', qr_codes_total: '0',
      pdf_reports_total: '0', outreach_by_suburb: null, recent_downloads: null,
      sent_monthly: [], junk_monthly: [], sent_quarterly: [], junk_quarterly: [],
      sent_daily: [], junk_daily: [], sent_weekly: [], junk_weekly: [],
      dispatch_by_suburb: [
        { suburb: 'Albany', sent_count: '3', junk_count: '1', total_count: '4', first_sent_at: null, last_sent_at: null },
        { suburb: 'Browns Bay', sent_count: '5', junk_count: '0', total_count: '5', first_sent_at: '2026-07-01T00:00:00.000Z', last_sent_at: '2026-07-20T00:00:00.000Z' },
        { suburb: 'Torbay', sent_count: '15', junk_count: '2', total_count: '20', first_sent_at: '2026-07-02T01:00:00.000Z', last_sent_at: '2026-08-10T01:00:00.000Z' },
      ],
    };

    vi.mocked(db.execute).mockResolvedValue({ rows: [mockRow] } as any);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.stats.dispatchTrend.bySuburb.map((s: { suburb: string }) => s.suburb)).toEqual(['Torbay-Q2-2026', 'Browns Bay-Q2-2026', 'Albany-Q2-2026']);
  });

  it('includes last_sent_at in outreach by suburb and orders it by most recent send', async () => {
    const mockRow = {
      new_leads: '1', high_priority_leads: '0', pending_outreach: '0',
      sent_outreach: '0', today_followups: '0', overdue_followups: '0',
      today_downloads: '0', total_downloads: '0', month_downloads: '0',
      total_bookings: '0', month_bookings: '0', qr_codes_total: '0',
      pdf_reports_total: '0', recent_downloads: null,
      outreach_by_suburb: [
        { suburb: 'Albany', pending_count: 5, sent_count: 10, total_count: 15, last_sent_at: '2026-07-01T00:00:00.000Z' },
        { suburb: 'Torbay', pending_count: 2, sent_count: 12, total_count: 14, last_sent_at: '2026-08-01T00:00:00.000Z' },
        { suburb: 'Browns Bay', pending_count: 1, sent_count: 0, total_count: 1, last_sent_at: null },
      ],
    };

    let capturedSql = '';
    vi.mocked(db.execute).mockImplementation(((sql: any) => {
      capturedSql += JSON.stringify(sql?.queryChunks ?? []);
      return { rows: [mockRow] };
    }) as any);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(capturedSql).toContain('last_sent_at DESC NULLS LAST');
    expect(body.stats.outreachBySuburb).toEqual([
      { suburb: 'Albany', pending_count: 5, sent_count: 10, total_count: 15, last_sent_at: '2026-07-01T00:00:00.000Z' },
      { suburb: 'Torbay', pending_count: 2, sent_count: 12, total_count: 14, last_sent_at: '2026-08-01T00:00:00.000Z' },
      { suburb: 'Browns Bay', pending_count: 1, sent_count: 0, total_count: 1, last_sent_at: null },
    ]);
  });

  it('defaults dispatch trend to empty arrays when fields are missing', async () => {
    const emptyRow = {
      new_leads: null, high_priority_leads: null, pending_outreach: null,
      sent_outreach: null, today_followups: null, overdue_followups: null,
      today_downloads: null, total_downloads: null, month_downloads: null,
      total_bookings: null, month_bookings: null, qr_codes_total: null,
      pdf_reports_total: null, outreach_by_suburb: null, recent_downloads: null,
    };

    vi.mocked(db.execute).mockResolvedValue({ rows: [emptyRow] } as any);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.stats.dispatchTrend).toEqual({
      daily: [], weekly: [], monthly: [], quarterly: [],
      seriesBySuburb: { daily: {}, weekly: {}, monthly: {}, quarterly: {} },
      bySuburb: [],
    });
  });

  it('builds quarterly sent summary with report links and dispatch quarter keys', async () => {
    const mainRow = {
      new_leads: '0', high_priority_leads: '0', pending_outreach: '0',
      sent_outreach: '0', today_followups: '0', overdue_followups: '0',
      today_downloads: '0', total_downloads: '0', month_downloads: '0',
      total_bookings: '0', month_bookings: '0', qr_codes_total: '0',
      pdf_reports_total: '0', outreach_by_suburb: null, recent_downloads: null,
      sent_summary_suburbs: null, sent_summary_suburb_count: '0', sent_summary_total_sent: '0',
      quarterly_suburb_sent: [
        { quarter_key: '2026-Q3', suburb: 'Oteha', sent_count: '5', last_sent_at: '2026-10-11T00:00:00.000Z' },
        { quarter_key: '2026-Q3', suburb: 'Torbay', sent_count: '3', last_sent_at: '2026-10-12T00:00:00.000Z' },
        { quarter_key: '2026-Q2', suburb: 'Oteha', sent_count: '209', last_sent_at: '2026-10-01T00:00:00.000Z' },
        { quarter_key: null, suburb: 'Broken', sent_count: '1', last_sent_at: null },
      ],
      dispatch_by_suburb: [
        { suburb: 'Oteha', campaign_key: '2026_Q3_Oteha', sent_count: '5', junk_count: '0', total_count: '5', first_sent_at: null, last_sent_at: '2026-10-11T00:00:00.000Z' },
        { suburb: 'Oteha', campaign_key: '2026_Q2_Oteha', sent_count: '209', junk_count: '0', total_count: '209', first_sent_at: null, last_sent_at: '2026-10-01T00:00:00.000Z' },
        { suburb: 'Torbay', campaign_key: 'Torbay', sent_count: '1', junk_count: '0', total_count: '1', first_sent_at: null, last_sent_at: null },
      ],
      sent_daily: [], junk_daily: [], sent_weekly: [], junk_weekly: [],
      sent_monthly: [], junk_monthly: [], sent_quarterly: [], junk_quarterly: [],
    };

    let allSql = '';
    vi.mocked(db.execute).mockImplementation(((sql: any) => {
      const text = JSON.stringify(sql?.queryChunks ?? []);
      if (text.includes('file_url')) {
        return { rows: [
          { suburb: 'Oteha', quarter: 'Q3', year: 2026, file_url: 'https://example.com/oteha-q3.pdf' },
          { suburb: 'Oteha', quarter: 'Q2', year: 2026, file_url: 'https://example.com/oteha-q2.pdf' },
        ] };
      }
      allSql += text;
      return { rows: [mainRow] };
    }) as any);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(allSql).toContain('quarterly_suburb_sent_cte');
    expect(allSql).toContain('substring(sl.campaign_key');
    expect(allSql).toContain('COUNT(DISTINCT op.id)');
    expect(allSql).toContain('[0-9]{4}');
    expect(allSql).not.toContain('^d{4}');
    expect(body.stats.sentSummary.total_sent).toBe(217);
    expect(body.stats.sentSummary.quarterly).toEqual([
      {
        quarter_key: '2026-Q3',
        total_sent: 8,
        suburbs: [
          { suburb: 'Oteha', sent_count: 5, last_sent_at: '2026-10-11T00:00:00.000Z', report_url: 'https://example.com/oteha-q3.pdf' },
          { suburb: 'Torbay', sent_count: 3, last_sent_at: '2026-10-12T00:00:00.000Z', report_url: null },
        ],
      },
      {
        quarter_key: '2026-Q2',
        total_sent: 209,
        suburbs: [
          { suburb: 'Oteha', sent_count: 209, last_sent_at: '2026-10-01T00:00:00.000Z', report_url: 'https://example.com/oteha-q2.pdf' },
        ],
      },
    ]);

    const bySuburb = body.stats.dispatchTrend.bySuburb;
    const otehaQ3 = bySuburb.find((s: { suburb: string }) => s.suburb === 'Oteha-Q3-2026');
    const otehaQ2 = bySuburb.find((s: { suburb: string }) => s.suburb === 'Oteha-Q2-2026');
    expect(otehaQ3).toMatchObject({
      quarter_key: '2026-Q3',
      report_url: 'https://example.com/oteha-q3.pdf',
    });
    expect(otehaQ2).toMatchObject({
      quarter_key: '2026-Q2',
      report_url: 'https://example.com/oteha-q2.pdf',
    });
    const plainTorbay = bySuburb.find((s: { suburb: string }) => s.suburb.startsWith('Torbay-'));
    expect(plainTorbay).toMatchObject({ quarter_key: null, report_url: null });
  });

  it('matches report URLs case-insensitively', async () => {
    const mainRow = {
      new_leads: '0', high_priority_leads: '0', pending_outreach: '0',
      sent_outreach: '0', today_followups: '0', overdue_followups: '0',
      today_downloads: '0', total_downloads: '0', month_downloads: '0',
      total_bookings: '0', month_bookings: '0', qr_codes_total: '0',
      pdf_reports_total: '0', outreach_by_suburb: null, recent_downloads: null,
      sent_summary_suburbs: null, sent_summary_suburb_count: '0', sent_summary_total_sent: '0',
      quarterly_suburb_sent: [
        { quarter_key: '2026-Q2', suburb: 'Oteha', sent_count: '209', last_sent_at: '2026-10-01T00:00:00.000Z' },
      ],
      dispatch_by_suburb: [],
      sent_daily: [], junk_daily: [], sent_weekly: [], junk_weekly: [],
      sent_monthly: [], junk_monthly: [], sent_quarterly: [], junk_quarterly: [],
    };

    vi.mocked(db.execute).mockImplementation(((sql: any) => {
      const text = JSON.stringify(sql?.queryChunks ?? []);
      if (text.includes('file_url')) {
        return { rows: [
          { suburb: 'oteha', quarter: 'q2', year: 2026, file_url: 'https://example.com/oteha-q2.pdf' },
        ] };
      }
      return { rows: [mainRow] };
    }) as any);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.stats.sentSummary.quarterly[0].suburbs[0].report_url).toBe('https://example.com/oteha-q2.pdf');
  });

  it('keeps report_url when merging fallback-campaign rows with proper campaign rows', async () => {
    const baseRow = {
      new_leads: '0', high_priority_leads: '0', pending_outreach: '0',
      sent_outreach: '0', today_followups: '0', overdue_followups: '0',
      today_downloads: '0', total_downloads: '0', month_downloads: '0',
      total_bookings: '0', month_bookings: '0', qr_codes_total: '0',
      pdf_reports_total: '0', outreach_by_suburb: null, recent_downloads: null,
      sent_summary_suburbs: null, sent_summary_suburb_count: '0', sent_summary_total_sent: '0',
      quarterly_suburb_sent: [],
      sent_daily: [], junk_daily: [], sent_weekly: [], junk_weekly: [],
      sent_monthly: [], junk_monthly: [], sent_quarterly: [], junk_quarterly: [],
    };

    const dispatchRowsFallbackFirst = [
      { suburb: 'Albany', campaign_key: 'favorites', sent_count: '133', junk_count: '0', total_count: '133', first_sent_at: null, last_sent_at: null },
      { suburb: 'Albany', campaign_key: '2026_Q2_Albany', sent_count: '188', junk_count: '0', total_count: '188', first_sent_at: null, last_sent_at: '2026-09-20T00:00:00.000Z' },
    ];

    for (const dispatchRows of [dispatchRowsFallbackFirst, [...dispatchRowsFallbackFirst].reverse()]) {
      vi.clearAllMocks();
      vi.mocked(db.execute).mockImplementation(((sql: any) => {
        const text = JSON.stringify(sql?.queryChunks ?? []);
        if (text.includes('file_url')) {
          return { rows: [{ suburb: 'Albany', quarter: 'Q2', year: 2026, file_url: 'https://example.com/albany-q2.pdf' }] };
        }
        return { rows: [{ ...baseRow, dispatch_by_suburb: dispatchRows }] };
      }) as any);

      const res = await GET(makeRequest());
      const body = await res.json();

      expect(res.status).toBe(200);
      const albany = body.stats.dispatchTrend.bySuburb.find((s: { raw_suburb: string }) => s.raw_suburb === 'Albany');
      expect(albany).toMatchObject({
        quarter_key: '2026-Q2',
        report_url: 'https://example.com/albany-q2.pdf',
        sent_count: 321,
        total_count: 321,
      });
    }
  });
});

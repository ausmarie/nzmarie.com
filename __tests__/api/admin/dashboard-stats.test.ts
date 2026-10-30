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
  getDashboardStatsCached: vi.fn((_key: string, fn: () => Promise<unknown>) => fn()),
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
      today: { total_sent: 0, suburbs: [] },
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

  it('returns a lightweight summary for progressive loading', async () => {
    const summaryRow = {
      sent_summary_suburbs: [
        { suburb: 'Oteha', sent_count: '5' },
        { suburb: 'Torbay', sent_count: '3' },
      ],
      sent_summary_suburb_count: '2',
      sent_summary_total_sent: '8',
      today_suburb_sent: [{ suburb: 'Albany', sent_count: '7' }],
      quarter_overview_totals: [
        { quarter_key: '2026-Q3', total_sent: '826' },
        { quarter_key: '2026-Q2', total_sent: '1815' },
      ],
      total_bookings: '9',
      recent_appraisals: [
        {
          id: 'new-1',
          client_name: 'Latest Lead',
          email: 'latest@example.com',
          phone: '021 000 0002',
          suburb: 'Sunnynook',
          property_address: '249 Sunset Road, Sunnynook',
          contact_status: 'not_contacted',
          created_at: '2026-10-06T05:30:08.784Z',
        },
      ],
    };

    let summarySql = '';
    vi.mocked(db.execute).mockImplementation(((sql: any) => {
      summarySql = JSON.stringify(sql?.queryChunks ?? []);
      return { rows: [summaryRow] };
    }) as any);

    const res = await GET(new Request('http://localhost/api/admin/dashboard/stats?part=summary'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.part).toBe('summary');
    expect(body.stats.totalBookings).toBe(9);
    expect(body.stats.sentSummary).toEqual({
      total_sent: 2641,
      suburb_count: 2,
      suburbs: [
        { suburb: 'Oteha', sent_count: 5 },
        { suburb: 'Torbay', sent_count: 3 },
      ],
      today: { total_sent: 7, suburbs: [{ suburb: 'Albany', sent_count: 7 }] },
      quarterly: [
        { quarter_key: '2026-Q3', total_sent: 826, suburbs: [] },
        { quarter_key: '2026-Q2', total_sent: 1815, suburbs: [] },
      ],
    });
    expect(body.stats.recentAppraisals).toHaveLength(1);
    expect(body.stats.recentAppraisals[0].client_name).toBe('Latest Lead');
    expect(body.stats.targetQuarterKey).toBe('2026-Q3');
    expect(summarySql).toContain('today_sent_cte');
    expect(summarySql).toContain('quarter_overview_totals');
    expect(summarySql).not.toContain('dispatch_by_suburb_cte');
    expect(summarySql).not.toContain('junk_props_base');
    expect(summarySql).not.toContain('outreach_send_logs sl ON sl.outreach_property_id');
    expect(body.stats.dispatchTrend).toBeUndefined();
    // Summary must stay a single round trip: the report-URL lookup is only
    // needed by the full payload and would make the priority cards wait.
    expect(db.execute).toHaveBeenCalledTimes(1);
  });

  it('keeps the summary Total Sent identical to the quarter overview totals', async () => {
    // Guard against the headline drifting away from the quarter cards again.
    const summaryRow = {
      sent_summary_suburbs: [{ suburb: 'Oteha', sent_count: '9000' }],
      sent_summary_suburb_count: '1',
      sent_summary_total_sent: '9000',
      quarterly_suburb_sent: [{ quarter_key: '2026-Q3', suburb: 'Oteha', sent_count: '9000' }],
      quarter_overview_totals: [
        { quarter_key: '2026-Q3', total_sent: '826' },
        { quarter_key: '2026-Q2', total_sent: '1815' },
      ],
      today_suburb_sent: [],
      total_bookings: '0',
      recent_appraisals: [],
    };

    vi.mocked(db.execute).mockResolvedValue({ rows: [summaryRow] } as any);

    const res = await GET(new Request('http://localhost/api/admin/dashboard/stats?part=summary'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.stats.sentSummary.total_sent).toBe(2641);
    expect(body.stats.sentSummary.quarterly.map((q: { total_sent: number }) => q.total_sent)).toEqual([826, 1815]);
    expect(body.quarterKey).toBe('2026-Q3');
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
    expect(capturedSql).toContain("WHERE status = 'sent'");
    expect(capturedSql).toContain('FROM campaign_analytics');
    expect(capturedSql).not.toContain('outreach_selected_properties');
    expect(body.stats.sentSummary).toEqual({
      total_sent: 8,
      suburb_count: 2,
      suburbs: [
        { suburb: 'Albany', sent_count: 5 },
        { suburb: 'Torbay', sent_count: 3 },
      ],
      today: { total_sent: 0, suburbs: [] },
      quarterly: [],
    });
  });

  it('returns today sent counts per suburb sorted by count', async () => {
    const mockRow = {
      new_leads: '0', high_priority_leads: '0', pending_outreach: '0',
      sent_outreach: '0', today_followups: '0', overdue_followups: '0',
      today_downloads: '0', total_downloads: '0', month_downloads: '0',
      total_bookings: '0', month_bookings: '0', qr_codes_total: '0',
      pdf_reports_total: '0', outreach_by_suburb: null, recent_downloads: null,
      sent_summary_suburbs: [{ suburb: 'Albany', sent_count: 10 }],
      sent_summary_suburb_count: '1',
      sent_summary_total_sent: '10',
      today_suburb_sent: [
        { suburb: 'Torbay', sent_count: '7' },
        { suburb: 'Albany', sent_count: '12' },
        { suburb: 'Oteha', sent_count: 0 },
      ],
      sent_daily: [], junk_daily: [], sent_weekly: [], junk_weekly: [],
      sent_monthly: [], junk_monthly: [], sent_quarterly: [], junk_quarterly: [],
    };

    let capturedSql = '';
    vi.mocked(db.execute).mockImplementation(((sql: any) => {
      capturedSql += JSON.stringify(sql?.queryChunks ?? []);
      return { rows: [mockRow] };
    }) as any);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(capturedSql).toContain('today_suburb_sent');
    expect(capturedSql).toContain('CURRENT_TIMESTAMP AT TIME ZONE');
    expect(body.stats.sentSummary.today).toEqual({
      total_sent: 19,
      suburbs: [
        { suburb: 'Albany', sent_count: 12 },
        { suburb: 'Torbay', sent_count: 7 },
      ],
    });
  });

  it('filters today sent counts by suburb', async () => {    const mockRow = {
      new_leads: '0', high_priority_leads: '0', pending_outreach: '0',
      sent_outreach: '0', today_followups: '0', overdue_followups: '0',
      today_downloads: '0', total_downloads: '0', month_downloads: '0',
      total_bookings: '0', month_bookings: '0', qr_codes_total: '0',
      pdf_reports_total: '0', outreach_by_suburb: null, recent_downloads: null,
      today_suburb_sent: [{ suburb: 'Oteha', sent_count: '4' }],
      sent_daily: [], junk_daily: [], sent_weekly: [], junk_weekly: [],
      sent_monthly: [], junk_monthly: [], sent_quarterly: [], junk_quarterly: [],
    };

    let capturedSql = '';
    vi.mocked(db.execute).mockImplementation(((sql: any) => {
      capturedSql += JSON.stringify(sql?.queryChunks ?? []);
      return { rows: [mockRow] };
    }) as any);

    const res = await GET(makeRequest('Oteha'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(capturedSql).toContain('AND suburb = ');
    expect(body.stats.sentSummary.today).toEqual({
      total_sent: 4,
      suburbs: [{ suburb: 'Oteha', sent_count: 4 }],
    });
  });

  it('returns the latest appraisals with contact details and time', async () => {
    const mockRow = {
      new_leads: '0', high_priority_leads: '0', pending_outreach: '0',
      sent_outreach: '0', today_followups: '0', overdue_followups: '0',
      today_downloads: '0', total_downloads: '0', month_downloads: '0',
      total_bookings: '9', month_bookings: '2', qr_codes_total: '0',
      pdf_reports_total: '0', outreach_by_suburb: null, recent_downloads: null,
      recent_appraisals: [
        {
          id: 'old-1',
          client_name: 'Earlier Lead',
          email: 'earlier@example.com',
          phone: '021 000 0001',
          suburb: 'Albany',
          property_address: '1 Old Street, Albany',
          contact_status: 'contacted',
          created_at: '2026-09-01T02:00:00.000Z',
        },
        {
          id: 'new-1',
          client_name: 'Latest Lead',
          email: 'latest@example.com',
          phone: '021 000 0002',
          suburb: 'Sunnynook',
          property_address: '249 Sunset Road, Sunnynook',
          contact_status: 'not_contacted',
          created_at: '2026-10-06T05:30:08.784Z',
        },
        { id: 'bad-1', client_name: 'Missing Created At', email: 'none@example.com' },
      ],
      today_suburb_sent: [],
      sent_daily: [], junk_daily: [], sent_weekly: [], junk_weekly: [],
      sent_monthly: [], junk_monthly: [], sent_quarterly: [], junk_quarterly: [],
    };

    let capturedSql = '';
    vi.mocked(db.execute).mockImplementation(((sql: any) => {
      capturedSql += JSON.stringify(sql?.queryChunks ?? []);
      return { rows: [mockRow] };
    }) as any);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(capturedSql).toContain('recent_appraisals');
    expect(capturedSql).toContain('FROM appraisal_leads');
    expect(body.stats.totalBookings).toBe(9);
    expect(body.stats.recentAppraisals).toEqual([
      {
        id: 'new-1',
        client_name: 'Latest Lead',
        email: 'latest@example.com',
        phone: '021 000 0002',
        suburb: 'Sunnynook',
        property_address: '249 Sunset Road, Sunnynook',
        contact_status: 'not_contacted',
        created_at: '2026-10-06T05:30:08.784Z',
      },
      {
        id: 'old-1',
        client_name: 'Earlier Lead',
        email: 'earlier@example.com',
        phone: '021 000 0001',
        suburb: 'Albany',
        property_address: '1 Old Street, Albany',
        contact_status: 'contacted',
        created_at: '2026-09-01T02:00:00.000Z',
      },
      {
        id: 'bad-1',
        client_name: 'Missing Created At',
        email: 'none@example.com',
        phone: '',
        suburb: '',
        property_address: '',
        contact_status: '',
        created_at: null,
      },
    ]);
  });

  it('returns an empty recent appraisals list when none exist', async () => {
    const mockRow = {
      new_leads: '0', high_priority_leads: '0', pending_outreach: '0',
      sent_outreach: '0', today_followups: '0', overdue_followups: '0',
      today_downloads: '0', total_downloads: '0', month_downloads: '0',
      total_bookings: '0', month_bookings: '0', qr_codes_total: '0',
      pdf_reports_total: '0', outreach_by_suburb: null, recent_downloads: null,
      sent_daily: [], junk_daily: [], sent_weekly: [], junk_weekly: [],
      sent_monthly: [], junk_monthly: [], sent_quarterly: [], junk_quarterly: [],
    };

    vi.mocked(db.execute).mockResolvedValue({ rows: [mockRow] } as any);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.stats.recentAppraisals).toEqual([]);
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
        { suburb: 'Torbay', campaign_key: '2026_Q2_Torbay', bucket: '2026-07-01', junk: '2' },
        { suburb: 'Albany', campaign_key: '2026_Q2_Albany', bucket: '2026-07-01', junk: '1' },
      ],
      sent_quarterly: [
        { suburb: 'Torbay', bucket: '2026-07-01', sent: '15' },
      ],
      junk_quarterly: [
        { suburb: 'Torbay', campaign_key: '2026_Q2_Torbay', bucket: '2026-07-01', junk: '2' },
      ],
      sent_yearly: [
        { suburb: 'Torbay', bucket: '2026-01-01', sent: '15' },
      ],
      junk_yearly: [
        { suburb: 'Torbay', campaign_key: '2026_Q2_Torbay', bucket: '2026-01-01', junk: '2' },
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
    expect(body.stats.dispatchTrend.yearly).toEqual([
      { bucket: '2026-01-01', sent: 15, junk: 2 },
    ]);
    expect(body.stats.dispatchTrend.seriesBySuburb.yearly['Torbay-Q2-2026']).toEqual([
      { bucket: '2026-01-01', sent: 15, junk: 2 },
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

  it('limits dispatch volume junk to the target report quarter', async () => {
    const mockRow = {
      quarter_key: '2026-Q3',
      quarter: 'Q3',
      year: 2026,
      suburbs_count: '6',
      total_properties: '826',
      total_sent: '0',
      total_unsent: '0',
      total_partial: '0',
      total_send_events: '0',
      new_leads: '0', high_priority_leads: '0', pending_outreach: '0',
      sent_outreach: '0', today_followups: '0', overdue_followups: '0',
      today_downloads: '0', total_downloads: '0', month_downloads: '0',
      total_bookings: '0', month_bookings: '0', qr_codes_total: '0',
      pdf_reports_total: '0', outreach_by_suburb: null, recent_downloads: null,
      sent_daily: [
        { suburb: 'Torbay', campaign_key: '2026_Q3_Torbay', bucket: '2026-10-20', sent: '5' },
        { suburb: 'Torbay', campaign_key: '2026_Q2_Torbay', bucket: '2026-08-20', sent: '7' },
      ],
      junk_daily: [
        { suburb: 'Torbay', campaign_key: '2026_Q3_Torbay', bucket: '2026-10-20', junk: '2' },
        { suburb: 'Torbay', campaign_key: '2026_Q2_Torbay', bucket: '2026-08-20', junk: '9' },
        { suburb: 'Albany', campaign_key: 'favorites', bucket: '2026-10-01', junk: '50' },
      ],
      sent_weekly: [], junk_weekly: [],
      sent_monthly: [], junk_monthly: [],
      sent_quarterly: [], junk_quarterly: [],
      sent_yearly: [], junk_yearly: [],
      dispatch_by_suburb: [],
    };

    let capturedSql = '';
    vi.mocked(db.execute).mockImplementation(((sql: any) => {
      capturedSql += JSON.stringify(sql?.queryChunks ?? []);
      return { rows: [mockRow] };
    }) as any);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    // Junk is also filtered in SQL so older quarters do not have to be
    // aggregated and shipped to the client on every dashboard load.
    expect(capturedSql).toContain('^2026[_-]Q3');
    expect(body.stats.dispatchTrend.daily).toEqual([
      { bucket: '2026-08-20', sent: 7, junk: 0 },
      { bucket: '2026-10-20', sent: 5, junk: 2 },
    ]);
    expect(body.stats.dispatchTrend.seriesBySuburb.daily['Torbay-Q3-2026']).toEqual([
      { bucket: '2026-10-20', sent: 5, junk: 2 },
    ]);
    expect(body.stats.dispatchTrend.seriesBySuburb.daily['Torbay-Q2-2026']).toEqual([
      { bucket: '2026-08-20', sent: 7, junk: 0 },
    ]);
    expect(body.stats.dispatchTrend.seriesBySuburb.daily['Albany-Q3-2026']).toBeUndefined();
  });

  it('follows the quarter view as the active quarter, like the Top Cards', async () => {
    for (const target of ['2026-Q4', '2027-Q3']) {
      vi.clearAllMocks();
      vi.mocked(auth).mockResolvedValue({ user: { email: 'admin@test.com' } } as any);
      vi.mocked(isAdmin).mockReturnValue(true);

      const [year, quarter] = target.split('-');
      const targetCampaign = `${year}_${quarter}_Torbay`;
      const baseRow = {
        quarter_key: target,
        quarter,
        year: Number(year),
        new_leads: '0', high_priority_leads: '0', pending_outreach: '0',
        sent_outreach: '0', today_followups: '0', overdue_followups: '0',
        today_downloads: '0', total_downloads: '0', month_downloads: '0',
        total_bookings: '0', month_bookings: '0', qr_codes_total: '0',
        pdf_reports_total: '0', outreach_by_suburb: null, recent_downloads: null,
        junk_daily: [
          { suburb: 'Torbay', campaign_key: targetCampaign, bucket: `${year}-10-20`, junk: '4' },
          { suburb: 'Torbay', campaign_key: '2026_Q3_Torbay', bucket: '2026-10-01', junk: '9' },
          { suburb: 'Albany', campaign_key: 'favorites', bucket: '2026-10-01', junk: '50' },
        ],
        sent_daily: [], sent_weekly: [], junk_weekly: [],
        sent_monthly: [], junk_monthly: [], sent_quarterly: [], junk_quarterly: [],
        sent_yearly: [], junk_yearly: [], dispatch_by_suburb: [],
      };

      let capturedSql = '';
      vi.mocked(db.execute).mockImplementation(((sql: any) => {
        const text = JSON.stringify(sql?.queryChunks ?? []);
        capturedSql += text;
        if (text.includes('latest_quarter_key')) {
          return { rows: [{ quarter_key: target, latest_quarter_key: target }] };
        }
        return { rows: [baseRow] };
      }) as any);

      const res = await GET(makeRequest());
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.stats.targetQuarterKey).toBe(target);
      expect(capturedSql).toContain(`^${year}[_-]${quarter}`);
      expect(body.stats.dispatchTrend.seriesBySuburb.daily[`Torbay-${quarter}-${year}`]).toEqual([
        { bucket: `${year}-10-20`, sent: 0, junk: 4 },
      ]);
      expect(body.stats.dispatchTrend.seriesBySuburb.daily['Torbay-Q3-2026']).toBeUndefined();
      expect(body.stats.dispatchTrend.seriesBySuburb.daily['Albany-Q3-2026']).toBeUndefined();
    }
  });

  it('falls back to live send activity while the quarter view is still empty', async () => {
    const baseRow = {
      new_leads: '0', high_priority_leads: '0', pending_outreach: '0',
      sent_outreach: '0', today_followups: '0', overdue_followups: '0',
      today_downloads: '0', total_downloads: '0', month_downloads: '0',
      total_bookings: '0', month_bookings: '0', qr_codes_total: '0',
      pdf_reports_total: '0', outreach_by_suburb: null, recent_downloads: null,
      sent_daily: [], junk_daily: [], sent_weekly: [], junk_weekly: [],
      sent_monthly: [], junk_monthly: [], sent_quarterly: [], junk_quarterly: [],
      sent_yearly: [], junk_yearly: [], dispatch_by_suburb: [],
    };

    let capturedSql = '';
    vi.mocked(db.execute).mockImplementation(((sql: any) => {
      const text = JSON.stringify(sql?.queryChunks ?? []);
      capturedSql += text;
      if (text.includes('latest_quarter_key')) {
        return { rows: [{ latest_quarter_key: '2026-Q4' }] };
      }
      return { rows: [baseRow] };
    }) as any);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.stats.targetQuarterKey).toBe('2026-Q4');
    expect(capturedSql).toContain('latest_live_quarter');
    expect(capturedSql).toContain('^2026[_-]Q4');
  });

  it('lists a report period uploaded in Assets before anything was sent', async () => {
    // Regression: Long Bay had a 2026-Q3 report uploaded in Assets, but because
    // the suburb already sent mail in 2026-Q2 the quarter audience was empty,
    // so the row came back as 0/0/0/0 and the timeline hid it entirely.
    const mockRow = {
      new_leads: '0', high_priority_leads: '0', pending_outreach: '0',
      sent_outreach: '0', today_followups: '0', overdue_followups: '0',
      today_downloads: '0', total_downloads: '0', month_downloads: '0',
      total_bookings: '0', month_bookings: '0', qr_codes_total: '0',
      pdf_reports_total: '0', outreach_by_suburb: null, recent_downloads: null,
      sent_daily: [], junk_daily: [], sent_weekly: [], junk_weekly: [],
      sent_monthly: [], junk_monthly: [], sent_quarterly: [], junk_quarterly: [],
      sent_yearly: [], junk_yearly: [],
      dispatch_by_suburb: [
        {
          suburb: 'Long Bay',
          campaign_key: '2026_Q3_Long Bay',
          period_key: '2026-Q3',
          sent_count: '0',
          junk_count: '24',
          total_count: '126',
          first_sent_at: null,
          last_sent_at: null,
        },
      ],
    };

    let allSql = '';
    vi.mocked(db.execute).mockImplementation(((sql: any) => {
      const text = JSON.stringify(sql?.queryChunks ?? []);
      if (text.includes('file_url')) {
        return {
          rows: [{ suburb: 'Long Bay', quarter: 'Q3', year: 2026, file_url: 'https://example.com/long-bay-q3.pdf' }],
        };
      }
      allSql += text;
      return { rows: [mockRow] };
    }) as any);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.stats.dispatchTrend.bySuburb).toEqual([
      {
        suburb: 'Long Bay-Q3-2026',
        raw_suburb: 'Long Bay',
        quarter_key: '2026-Q3',
        report_url: 'https://example.com/long-bay-q3.pdf',
        sent_count: 0,
        junk_count: 24,
        unsent_count: 102,
        total_count: 126,
        first_sent_at: null,
        last_sent_at: null,
      },
    ]);
    // The audience CTE must keep the suburb working set for a period that has
    // no dispatch activity yet, otherwise the row above is all zeros.
    expect(allSql).toContain('dispatch_period_activity');
    expect(allSql).toContain('(prev.suburb IS NULL OR act.suburb IS NULL)');
  });

  it('reports junk mail per report quarter, not as one running total', async () => {
    // Torbay: 2026-Q2 was the first campaign for the suburb, so the bulk of the
    // no-junk-mail addresses were discovered then; 2026-Q3 only has the few new
    // ones. Each quarter must keep its own figure.
    const mockRow = {
      new_leads: '0', high_priority_leads: '0', pending_outreach: '0',
      sent_outreach: '0', today_followups: '0', overdue_followups: '0',
      today_downloads: '0', total_downloads: '0', month_downloads: '0',
      total_bookings: '0', month_bookings: '0', qr_codes_total: '0',
      pdf_reports_total: '0', outreach_by_suburb: null, recent_downloads: null,
      sent_daily: [], junk_daily: [], sent_weekly: [], junk_weekly: [],
      sent_monthly: [], junk_monthly: [], sent_quarterly: [], junk_quarterly: [],
      sent_yearly: [], junk_yearly: [],
      dispatch_by_suburb: [
        {
          suburb: 'Torbay',
          campaign_key: '2026_Q3_Torbay',
          period_key: '2026-Q3',
          sent_count: '345',
          junk_count: '12',
          total_count: '357',
          first_sent_at: '2026-10-19T00:00:00.000Z',
          last_sent_at: '2026-10-26T00:00:00.000Z',
        },
        {
          suburb: 'Torbay',
          campaign_key: '2026_Q2_Torbay',
          period_key: '2026-Q2',
          sent_count: '357',
          junk_count: '261',
          total_count: '618',
          first_sent_at: '2026-07-01T00:00:00.000Z',
          last_sent_at: '2026-09-14T00:00:00.000Z',
        },
      ],
    };

    let allSql = '';
    vi.mocked(db.execute).mockImplementation(((sql: any) => {
      const text = JSON.stringify(sql?.queryChunks ?? []);
      if (text.includes('file_url')) return { rows: [] };
      allSql += text;
      return { rows: [mockRow] };
    }) as any);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    const bySuburb = body.stats.dispatchTrend.bySuburb as Array<{
      suburb: string;
      quarter_key: string;
      sent_count: number;
      junk_count: number;
      unsent_count: number;
      total_count: number;
    }>;
    const q2 = bySuburb.find((row) => row.quarter_key === '2026-Q2')!;
    const q3 = bySuburb.find((row) => row.quarter_key === '2026-Q3')!;

    expect(q2).toMatchObject({ suburb: 'Torbay-Q2-2026', junk_count: 261, sent_count: 357, unsent_count: 0, total_count: 618 });
    expect(q3).toMatchObject({ suburb: 'Torbay-Q3-2026', junk_count: 12, sent_count: 345, unsent_count: 0, total_count: 357 });
    // Junk is a slice of the audience, so the progress bar can never overflow.
    for (const row of bySuburb) {
      expect(row.sent_count + row.junk_count).toBeLessThanOrEqual(row.total_count);
    }

    // Junk is attributed to the campaign that was current when the address was
    // flagged, and those addresses are part of that quarter's audience.
    expect(allSql).toContain('dispatch_junk_periods');
    expect(allSql).toContain('dispatch_junk_by_period');
    expect(allSql).toContain('sr.uploaded_at <= j.junk_at');
    expect(allSql).toContain('FROM dispatch_junk_periods');
    // Junk mail only exists for a quarter that actually dispatched something.
    expect(allSql).toContain('ps.sent_count > 0');
  });

  it('does not count junk mail for a quarter that was never dispatched', async () => {
    const mockRow = {
      new_leads: '0', high_priority_leads: '0', pending_outreach: '0',
      sent_outreach: '0', today_followups: '0', overdue_followups: '0',
      today_downloads: '0', total_downloads: '0', month_downloads: '0',
      total_bookings: '0', month_bookings: '0', qr_codes_total: '0',
      pdf_reports_total: '0', outreach_by_suburb: null, recent_downloads: null,
      sent_daily: [], junk_daily: [], sent_weekly: [], junk_weekly: [],
      sent_monthly: [], junk_monthly: [], sent_quarterly: [], junk_quarterly: [],
      sent_yearly: [], junk_yearly: [],
      dispatch_by_suburb: [
        {
          suburb: 'Castor Bay',
          campaign_key: '2026_Q2_Castor Bay',
          period_key: '2026-Q2',
          sent_count: '0',
          junk_count: '0',
          total_count: '171',
          first_sent_at: null,
          last_sent_at: null,
        },
      ],
    };

    vi.mocked(db.execute).mockImplementation(((sql: any) => {
      const text = JSON.stringify(sql?.queryChunks ?? []);
      if (text.includes('file_url')) return { rows: [] };
      return { rows: [mockRow] };
    }) as any);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.stats.dispatchTrend.bySuburb).toEqual([
      {
        suburb: 'Castor Bay-Q2-2026',
        raw_suburb: 'Castor Bay',
        quarter_key: '2026-Q2',
        report_url: null,
        sent_count: 0,
        junk_count: 0,
        unsent_count: 171,
        total_count: 171,
        first_sent_at: null,
        last_sent_at: null,
      },
    ]);
  });

  it('counts send logs that have no report link (legacy campaigns)', async () => {
    // Regression guard: an inner join on suburb_reports used to drop Q2 logs
    // whose suburb_report_id was never backfilled, collapsing Q2 sent counts.
    const mockRow = {
      new_leads: '0', high_priority_leads: '0', pending_outreach: '0',
      sent_outreach: '0', today_followups: '0', overdue_followups: '0',
      today_downloads: '0', total_downloads: '0', month_downloads: '0',
      total_bookings: '0', month_bookings: '0', qr_codes_total: '0',
      pdf_reports_total: '0', outreach_by_suburb: null, recent_downloads: null,
      sent_daily: [], junk_daily: [], sent_weekly: [], junk_weekly: [],
      sent_monthly: [], junk_monthly: [], sent_quarterly: [], junk_quarterly: [],
      sent_yearly: [], junk_yearly: [], dispatch_by_suburb: [],
    };

    let allSql = '';
    vi.mocked(db.execute).mockImplementation(((sql: any) => {
      const text = JSON.stringify(sql?.queryChunks ?? []);
      if (text.includes('file_url')) return { rows: [] };
      allSql += text;
      return { rows: [mockRow] };
    }) as any);

    await GET(makeRequest());

    expect(allSql).toContain('FROM outreach_send_logs sl');
    expect(allSql).not.toContain('AND sr.id IS NOT NULL');
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
        { suburb: 'Torbay', campaign_key: '2026_Q2_Torbay', bucket: '2026-07-01', junk: '2' },
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
      daily: [], weekly: [], monthly: [], quarterly: [], yearly: [],
      seriesBySuburb: { daily: {}, weekly: {}, monthly: {}, quarterly: {}, yearly: {} },
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
    expect(allSql).toContain('outreach_by_suburb_full_cte');
    expect(allSql).toContain("COUNT(*) FILTER (WHERE op.status = 'sent')");
    expect(allSql).toContain('[0-9]{4}');
    expect(allSql).toContain('[_-]Q([1-4])');
    expect(allSql).toContain('outreach_canonical.period_key = rq.period_key');
    expect(allSql).toContain('returned.suburb_report_id = sl.suburb_report_id');
    expect(allSql).toContain("returned.status = 'pending'");
    expect(allSql.match(/returned\.outreach_property_id = sl\.outreach_property_id/g)).toHaveLength(1);
    // The send log scan is now shared by the timeline, quarterly summary and
    // dispatch aggregates instead of being repeated (and billed) three times.
    expect((allSql.match(/FROM outreach_send_logs sl/g) || []).length).toBeLessThanOrEqual(3);
    expect(allSql).toContain('returned.quarter_key = rq.period_key');
    expect(allSql).toContain('quarter_status_sent.status = \'sent\'');
    expect(allSql).toContain('quarter_status_sent.outreach_property_id');
    // The audience must not be filtered by outreach_properties.created_at: those
    // rows are imported after the fact, so for 2026-Q2 that filter emptied the
    // audience and collapsed junk/unsent to zero.
    expect(allSql).not.toContain('op.created_at < rq.period_end');
    expect(allSql).toContain('junk_props_base');
    expect(allSql).toContain('junk_props_raw');
    expect(allSql).toContain('junk_props_report');
    expect(allSql).toContain('ROW_NUMBER() OVER (PARTITION BY j.op_id ORDER BY sr.uploaded_at DESC)');
    expect(allSql).toContain('LEFT JOIN junk_props_report');
    expect(allSql).toContain('no_junk_mail_updated_at');
    expect(allSql).toContain('sr.uploaded_at <= j.junk_at');
    expect(allSql).not.toContain('(SELECT sr.year::text');
    expect(allSql).toContain("op.created_at AT TIME ZONE 'Pacific/Auckland'");
    expect(allSql).not.toContain('dispatched_ids_cte');
    expect(allSql).not.toContain("AND LOWER(op.status) = 'pending'");
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

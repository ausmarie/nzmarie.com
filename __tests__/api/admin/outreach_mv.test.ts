import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { DateTime } from 'luxon';
import { GET, POST } from '@/app/api/admin/outreach/route';
import { auth } from '@/lib/auth';
import { marieDB } from '@/lib/db';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  marieDB: {
    query: vi.fn(),
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

describe('Outreach MV GET /api/admin/outreach', () => {
  const OLD_ENV = process.env.USE_OUTREACH_MV;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.USE_OUTREACH_MV = 'true';
  });

  afterAll(() => {
    process.env.USE_OUTREACH_MV = OLD_ENV;
  });

  it('returns 401 if unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValueOnce(undefined as any);

    const response = await GET(new Request('http://localhost:3000/api/admin/outreach'));
    expect(response.status).toBe(401);
  });

  it('returns property list with pagination via MV', async () => {
    mockAuth();

    const mockRows = [
      { id: '1', property_address: '1 Test St', suburb: 'Oteha', city: 'Auckland', region: 'Auckland', total_count: '2' },
      { id: '2', property_address: '2 Test St', suburb: 'Oteha', city: 'Auckland', region: 'Auckland', total_count: '2' },
    ];

    vi.mocked(marieDB.query)
      .mockResolvedValueOnce({ rows: mockRows } as any)
      .mockResolvedValueOnce({ rows: [{ total: '2' }] } as any);

    const response = await GET(new Request('http://localhost:3000/api/admin/outreach?limit=10&page=1'));
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toHaveLength(2);
    expect(data.pagination.total).toBe(2);
  });

  it('returns card view fields when view=card', async () => {
    mockAuth();

    const mockRows = [
      { id: '1', property_address: '1 Test St', suburb: 'Oteha', total_count: '1' },
    ];

    vi.mocked(marieDB.query)
      .mockResolvedValueOnce({ rows: mockRows } as any)
      .mockResolvedValueOnce({ rows: [{ total: '0' }] } as any);

    const response = await GET(new Request('http://localhost:3000/api/admin/outreach?view=card&limit=10'));
    expect(response.status).toBe(200);

    const queryCall = vi.mocked(marieDB.query).mock.calls[0][0] as string;
    expect(queryCall).toContain('cover_image_url, bedrooms, bathrooms, car_spaces');
  });

  it('filters by sentStatus and suburb with reportQuarter', async () => {
    mockAuth();

    vi.mocked(marieDB.query)
      .mockResolvedValueOnce({ rows: [] } as any)
      .mockResolvedValueOnce({ rows: [{ total: '0' }] } as any);

    const response = await GET(new Request('http://localhost:3000/api/admin/outreach?sent_status=sent&suburb=Oteha&report_quarter=2026-Q2&limit=10'));
    expect(response.status).toBe(200);

    const queryCall = vi.mocked(marieDB.query).mock.calls[0][0] as string;
    const params = vi.mocked(marieDB.query).mock.calls[0][1] as unknown[];
    expect(queryCall).toContain('outreach_send_logs');
    expect(params).toContain('Oteha');
    expect(params).toContain('Q2');
  });

  it('qualifies the correlated id as outreach_enriched.id in sent + reportQuarter EXISTS', async () => {
    mockAuth();

    vi.mocked(marieDB.query)
      .mockResolvedValueOnce({ rows: [] } as any)
      .mockResolvedValueOnce({ rows: [{ total: '0' }] } as any);

    const response = await GET(new Request('http://localhost:3000/api/admin/outreach?status=sent&report_quarter=2026-Q2&limit=10'));
    expect(response.status).toBe(200);

    const queryCall = vi.mocked(marieDB.query).mock.calls[0][0] as string;
    expect(queryCall).toContain('sl2.outreach_property_id = outreach_enriched.id');
    expect(queryCall).not.toMatch(/sl2\.outreach_property_id = id\b/);
    const params = vi.mocked(marieDB.query).mock.calls[0][1] as unknown[];
    expect(params).toContain('Q2');
    expect(params).toContain('^2026[_-]Q2');
  });

  it('qualifies the correlated id for plain sent status without quarter', async () => {
    mockAuth();

    vi.mocked(marieDB.query)
      .mockResolvedValueOnce({ rows: [] } as any)
      .mockResolvedValueOnce({ rows: [{ total: '0' }] } as any);

    const response = await GET(new Request('http://localhost:3000/api/admin/outreach?status=sent&limit=10'));
    expect(response.status).toBe(200);

    const queryCall = vi.mocked(marieDB.query).mock.calls[0][0] as string;
    expect(queryCall).toContain('sl2.outreach_property_id = outreach_enriched.id');
    expect(queryCall).not.toMatch(/sl2\.outreach_property_id = id\b/);
  });

  it('qualifies the correlated id in the quarter-aware status select', async () => {
    mockAuth();

    vi.mocked(marieDB.query)
      .mockResolvedValueOnce({ rows: [] } as any)
      .mockResolvedValueOnce({ rows: [{ total: '0' }] } as any);

    const response = await GET(new Request('http://localhost:3000/api/admin/outreach?status=pending&report_quarter=2026-Q3&limit=10'));
    expect(response.status).toBe(200);

    const queryCall = vi.mocked(marieDB.query).mock.calls[0][0] as string;
    expect(queryCall).toContain('slq.outreach_property_id = outreach_enriched.id');
    expect(queryCall).not.toMatch(/slq\.outreach_property_id = id\b/);
  });

  it('filters by sentStatus=unsent without suburb', async () => {
    mockAuth();

    vi.mocked(marieDB.query)
      .mockResolvedValueOnce({ rows: [] } as any)
      .mockResolvedValueOnce({ rows: [{ total: '0' }] } as any);

    const response = await GET(new Request('http://localhost:3000/api/admin/outreach?sent_status=unsent&limit=10'));
    expect(response.status).toBe(200);

    const queryCall = vi.mocked(marieDB.query).mock.calls[0][0] as string;
    expect(queryCall).toContain('NOT EXISTS (SELECT 1 FROM outreach_send_logs sl3');
    expect(queryCall).toContain('(no_junk_mail IS NULL OR no_junk_mail = false)');
  });

  it('filters by market_status', async () => {
    mockAuth();

    vi.mocked(marieDB.query)
      .mockResolvedValueOnce({ rows: [] } as any)
      .mockResolvedValueOnce({ rows: [{ total: '0' }] } as any);

    const response = await GET(new Request('http://localhost:3000/api/admin/outreach?market_status=for_sale&limit=10'));
    expect(response.status).toBe(200);

    const queryCall = vi.mocked(marieDB.query).mock.calls[0][0] as string;
    expect(queryCall).toContain('on_market_sale = true');
  });

  it('filters by no_junk_mail', async () => {
    mockAuth();

    vi.mocked(marieDB.query)
      .mockResolvedValueOnce({ rows: [] } as any)
      .mockResolvedValueOnce({ rows: [{ total: '0' }] } as any);

    const response = await GET(new Request('http://localhost:3000/api/admin/outreach?no_junk_mail=true&limit=10'));
    expect(response.status).toBe(200);

    const queryCall = vi.mocked(marieDB.query).mock.calls[0][0] as string;
    expect(queryCall).toContain('no_junk_mail = true');
  });

  it('filters sent properties by sent_dates', async () => {
    mockAuth();

    vi.mocked(marieDB.query)
      .mockResolvedValueOnce({ rows: [] } as any)
      .mockResolvedValueOnce({ rows: [{ total: '0' }] } as any);

    const response = await GET(new Request('http://localhost:3000/api/admin/outreach?status=sent&sent_dates=2026-07-01,2026-07-02&limit=10'));
    expect(response.status).toBe(200);

    const queryCall = vi.mocked(marieDB.query).mock.calls[0][0] as string;
    const params = vi.mocked(marieDB.query).mock.calls[0][1] as unknown[];
    const range1Start = DateTime.fromISO('2026-07-01', { zone: 'Pacific/Auckland' })
      .startOf('day')
      .toUTC()
      .toISO();
    const range1End = DateTime.fromISO('2026-07-01', { zone: 'Pacific/Auckland' })
      .plus({ days: 1 })
      .startOf('day')
      .toUTC()
      .toISO();
    const range2Start = DateTime.fromISO('2026-07-02', { zone: 'Pacific/Auckland' })
      .startOf('day')
      .toUTC()
      .toISO();
    const range2End = DateTime.fromISO('2026-07-02', { zone: 'Pacific/Auckland' })
      .plus({ days: 1 })
      .startOf('day')
      .toUTC()
      .toISO();
    expect(queryCall).toContain('EXISTS (SELECT 1 FROM outreach_send_logs sl6 WHERE sl6.outreach_property_id = outreach_enriched.id AND (');
    expect(queryCall).toContain('sl6.sent_at >= $1');
    expect(queryCall).toContain('sl6.sent_at < $2');
    expect(queryCall).toContain('sl6.sent_at >= $3');
    expect(queryCall).toContain('sl6.sent_at < $4');
    expect(params).toContain(range1Start);
    expect(params).toContain(range1End);
    expect(params).toContain(range2Start);
    expect(params).toContain(range2End);
  });

  it('filters sent properties by sent_dates in legacy mode', async () => {
    mockAuth();
    process.env.USE_OUTREACH_MV = 'false';

    vi.mocked(marieDB.query)
      .mockResolvedValueOnce({ rows: [] } as any)
      .mockResolvedValueOnce({ rows: [{ total: '0' }] } as any);

    const response = await GET(new Request('http://localhost:3000/api/admin/outreach?status=sent&sent_dates=2026-07-03&limit=10'));
    expect(response.status).toBe(200);

    const queryCall = vi.mocked(marieDB.query).mock.calls[0][0] as string;
    const params = vi.mocked(marieDB.query).mock.calls[0][1] as unknown[];
    const rangeStart = DateTime.fromISO('2026-07-03', { zone: 'Pacific/Auckland' })
      .startOf('day')
      .toUTC()
      .toISO();
    const rangeEnd = DateTime.fromISO('2026-07-03', { zone: 'Pacific/Auckland' })
      .plus({ days: 1 })
      .startOf('day')
      .toUTC()
      .toISO();
    expect(queryCall).toContain('outreach_send_logs sl6 WHERE sl6.outreach_property_id = op.id');
    expect(queryCall).toContain('EXISTS (SELECT 1 FROM outreach_send_logs sl6 WHERE sl6.outreach_property_id = op.id AND ((');
    expect(queryCall).toContain('sl6.sent_at >= $1');
    expect(queryCall).toContain('sl6.sent_at < $2');
    expect(params).toContain(rangeStart);
    expect(params).toContain(rangeEnd);
  });

  it('combines report_quarter and sent_dates in MV mode', async () => {
    mockAuth();

    vi.mocked(marieDB.query)
      .mockResolvedValueOnce({ rows: [] } as any)
      .mockResolvedValueOnce({ rows: [{ total: '0' }] } as any);

    const response = await GET(new Request('http://localhost:3000/api/admin/outreach?status=sent&report_quarter=2026-Q2&sent_dates=2026-10-14&limit=10'));
    expect(response.status).toBe(200);

    const queryCall = vi.mocked(marieDB.query).mock.calls[0][0] as string;
    const params = vi.mocked(marieDB.query).mock.calls[0][1] as unknown[];
    expect(queryCall).toContain('sl2.outreach_property_id = outreach_enriched.id');
    expect(queryCall).toContain('EXISTS (SELECT 1 FROM outreach_send_logs sl6 WHERE sl6.outreach_property_id = outreach_enriched.id AND (');
    expect(params).toContain('Q2');
    expect(params).toContain(2026);
    expect(params).toContain('^2026[_-]Q2');
    const dayStart = DateTime.fromISO('2026-10-14', { zone: 'Pacific/Auckland' }).startOf('day').toUTC().toISO();
    const dayEnd = DateTime.fromISO('2026-10-14', { zone: 'Pacific/Auckland' }).plus({ days: 1 }).startOf('day').toUTC().toISO();
    expect(params).toContain(dayStart);
    expect(params).toContain(dayEnd);
  });

  it('combines report_quarter and sent_dates in legacy mode', async () => {
    mockAuth();
    process.env.USE_OUTREACH_MV = 'false';

    vi.mocked(marieDB.query)
      .mockResolvedValueOnce({ rows: [] } as any)
      .mockResolvedValueOnce({ rows: [{ total: '0' }] } as any);

    const response = await GET(new Request('http://localhost:3000/api/admin/outreach?status=sent&report_quarter=2026-Q2&sent_dates=2026-10-14&limit=10'));
    expect(response.status).toBe(200);

    const queryCall = vi.mocked(marieDB.query).mock.calls[0][0] as string;
    const params = vi.mocked(marieDB.query).mock.calls[0][1] as unknown[];
    expect(queryCall).toContain('sl2.outreach_property_id = op.id');
    expect(queryCall).toContain('EXISTS (SELECT 1 FROM outreach_send_logs sl6 WHERE sl6.outreach_property_id = op.id AND (');
    expect(params).toContain('Q2');
    expect(params).toContain(2026);
    expect(params).toContain('^2026[_-]Q2');
    const dayStart = DateTime.fromISO('2026-10-14', { zone: 'Pacific/Auckland' }).startOf('day').toUTC().toISO();
    const dayEnd = DateTime.fromISO('2026-10-14', { zone: 'Pacific/Auckland' }).plus({ days: 1 }).startOf('day').toUTC().toISO();
    expect(params).toContain(dayStart);
    expect(params).toContain(dayEnd);
  });

  it('includes both pending and sent records when status=pending and sent_status=all in MV mode', async () => {
    mockAuth();

    vi.mocked(marieDB.query)
      .mockResolvedValueOnce({ rows: [] } as any)
      .mockResolvedValueOnce({ rows: [{ total: '0' }] } as any);

    const response = await GET(new Request('http://localhost:3000/api/admin/outreach?status=pending&sent_status=all&suburb=Torbay&limit=10'));
    expect(response.status).toBe(200);

    const queryCall = vi.mocked(marieDB.query).mock.calls[0][0] as string;
    expect(queryCall).toContain("status IN ('pending', 'sent')");
  });

  it('includes both pending and sent records when status=pending and sent_status=all in legacy mode', async () => {
    process.env.USE_OUTREACH_MV = 'false';
    mockAuth();

    vi.mocked(marieDB.query)
      .mockResolvedValueOnce({ rows: [] } as any)
      .mockResolvedValueOnce({ rows: [{ total: '0' }] } as any);

    const response = await GET(new Request('http://localhost:3000/api/admin/outreach?status=pending&sent_status=all&suburb=Torbay&limit=10'));
    expect(response.status).toBe(200);

    const queryCall = vi.mocked(marieDB.query).mock.calls[0][0] as string;
    expect(queryCall).toContain("op.status IN ('pending', 'sent')");
  });

  it('returns quarter-aware status and quarter-only sent filter for all + reportQuarter in MV mode', async () => {
    mockAuth();

    vi.mocked(marieDB.query)
      .mockResolvedValueOnce({ rows: [] } as any)
      .mockResolvedValueOnce({ rows: [{ total: '0' }] } as any);

    const response = await GET(new Request('http://localhost:3000/api/admin/outreach?status=pending&sent_status=all&suburb=Oteha&report_quarter=2026-Q3&limit=10'));
    expect(response.status).toBe(200);

    const dataQuery = vi.mocked(marieDB.query).mock.calls[0][0] as string;
    const dataParams = vi.mocked(marieDB.query).mock.calls[0][1] as unknown[];
    expect(dataQuery).toContain("status IN ('pending', 'sent')");
    expect(dataQuery).toContain("CASE WHEN EXISTS");
    expect(dataQuery).toContain("THEN 'sent' ELSE 'pending' END AS status");
    expect(dataQuery).toContain('campaign_key ~');
    expect(dataParams).toContain('^2026[_-]Q3');
    expect(dataParams).toContain('Q3');
    expect(dataParams).toContain(2026);

    const countQuery = vi.mocked(marieDB.query).mock.calls[1][0] as string;
    expect(countQuery).not.toContain('CASE WHEN EXISTS');
  });

  it('drops global send-history clauses for sent + reportQuarter in MV mode', async () => {
    mockAuth();

    vi.mocked(marieDB.query)
      .mockResolvedValueOnce({ rows: [] } as any)
      .mockResolvedValueOnce({ rows: [{ total: '0' }] } as any);

    const response = await GET(new Request('http://localhost:3000/api/admin/outreach?status=pending&sent_status=sent&suburb=Oteha&report_quarter=2026-Q3&limit=10'));
    expect(response.status).toBe(200);

    const dataQuery = vi.mocked(marieDB.query).mock.calls[0][0] as string;
    expect(dataQuery).toContain("status IN ('pending', 'sent')");
    expect(dataQuery).toContain('EXISTS (SELECT 1 FROM outreach_send_logs sl3');
    expect(dataQuery).not.toContain('OR COALESCE(total_send_count, 0) > 0');
    expect(dataQuery).toContain("THEN 'sent' ELSE 'pending' END AS status");
  });

  it('matches campaign keys with quarter regex in sent + reportQuarter in MV mode', async () => {
    mockAuth();

    vi.mocked(marieDB.query)
      .mockResolvedValueOnce({ rows: [] } as any)
      .mockResolvedValueOnce({ rows: [{ total: '0' }] } as any);

    const response = await GET(new Request('http://localhost:3000/api/admin/outreach?status=pending&sent_status=sent&suburb=Oteha&report_quarter=2026-Q3&limit=10'));
    expect(response.status).toBe(200);

    const dataQuery = vi.mocked(marieDB.query).mock.calls[0][0] as string;
    const dataParams = vi.mocked(marieDB.query).mock.calls[0][1] as unknown[];
    expect(dataQuery).toMatch(/sl3\.campaign_key ~ \$\d+/);
    expect(dataQuery).toMatch(/last_campaign ~ \$\d+/);
    expect(dataParams).toContain('^2026[_-]Q3');
    expect(dataParams).not.toContain('2026-Q3');
    expect(dataParams).not.toContain('2026_Q3');
  });

  it('keeps earlier-quarter sends in unsent + reportQuarter in MV mode', async () => {
    mockAuth();

    vi.mocked(marieDB.query)
      .mockResolvedValueOnce({ rows: [] } as any)
      .mockResolvedValueOnce({ rows: [{ total: '0' }] } as any);

    const response = await GET(new Request('http://localhost:3000/api/admin/outreach?status=pending&sent_status=unsent&suburb=Oteha&report_quarter=2026-Q3&limit=10'));
    expect(response.status).toBe(200);

    const dataQuery = vi.mocked(marieDB.query).mock.calls[0][0] as string;
    expect(dataQuery).toContain("status IN ('pending', 'sent')");
    expect(dataQuery).toContain('NOT EXISTS (SELECT 1 FROM outreach_send_logs sl3');
    expect(dataQuery).not.toContain("status <> 'sent'");
    expect(dataQuery).not.toContain('COALESCE(total_send_count, 0) = 0');
    expect(dataQuery).toContain('(no_junk_mail IS NULL OR no_junk_mail = false)');
  });

  it('returns quarter-aware status and quarter-only filters in legacy mode', async () => {
    process.env.USE_OUTREACH_MV = 'false';
    mockAuth();

    vi.mocked(marieDB.query)
      .mockResolvedValueOnce({ rows: [] } as any)
      .mockResolvedValueOnce({ rows: [{ total: '0' }] } as any);

    const response = await GET(new Request('http://localhost:3000/api/admin/outreach?status=pending&sent_status=unsent&suburb=Oteha&report_quarter=2026-Q3&limit=10'));
    expect(response.status).toBe(200);

    const dataQuery = vi.mocked(marieDB.query).mock.calls[0][0] as string;
    const dataParams = vi.mocked(marieDB.query).mock.calls[0][1] as unknown[];
    expect(dataQuery).toContain("op.status IN ('pending', 'sent')");
    expect(dataQuery).toContain('NOT EXISTS (SELECT 1 FROM outreach_send_logs sl3');
    expect(dataQuery).not.toContain("op.status <> 'sent'");
    expect(dataQuery).not.toContain('COALESCE(op.total_send_count, 0) = 0');
    expect(dataQuery).toContain('slq.outreach_property_id = op.id');
    expect(dataQuery).toContain("THEN 'sent' ELSE 'pending' END AS status");
    expect(dataParams).toContain('^2026[_-]Q3');
    expect(dataParams).toContain('Q3');

    const countQuery = vi.mocked(marieDB.query).mock.calls[1][0] as string;
    expect(countQuery).not.toContain('CASE WHEN EXISTS');
  });

  it('keeps global clauses for unsent without reportQuarter in legacy mode', async () => {
    process.env.USE_OUTREACH_MV = 'false';
    mockAuth();

    vi.mocked(marieDB.query)
      .mockResolvedValueOnce({ rows: [] } as any)
      .mockResolvedValueOnce({ rows: [{ total: '0' }] } as any);

    const response = await GET(new Request('http://localhost:3000/api/admin/outreach?status=pending&sent_status=unsent&suburb=Oteha&limit=10'));
    expect(response.status).toBe(200);

    const dataQuery = vi.mocked(marieDB.query).mock.calls[0][0] as string;
    expect(dataQuery).toContain("op.status = 'pending'");
    expect(dataQuery).toContain('COALESCE(op.total_send_count, 0) = 0');
    expect(dataQuery).not.toContain('CASE WHEN EXISTS');
    expect(dataQuery).not.toContain('@@QUARTER_STATUS@@');
  });
});

describe('Outreach MV POST /api/admin/outreach (add property)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.USE_OUTREACH_MV = 'true';
  });

  it('returns 401 if unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValueOnce(undefined as any);

    const response = await POST(new Request('http://localhost:3000/api/admin/outreach', {
      method: 'POST',
      body: JSON.stringify({ property_address: '1 Test St', suburb: 'Oteha', city: 'Auckland', region: 'Auckland' }),
    }));
    expect(response.status).toBe(401);
  });

  it('triggers MV REFRESH after insert', async () => {
    vi.mocked(auth).mockResolvedValueOnce({
      user: { email: 'nzlouis.com@gmail.com' },
    } as any);

    vi.mocked(marieDB.query)
      .mockResolvedValueOnce({ rows: [] } as any)
      .mockResolvedValueOnce({ rows: [{ id: 'new-id', status: 'pending' }] } as any)
      .mockResolvedValueOnce({ rows: [] } as any);

    const response = await POST(new Request('http://localhost:3000/api/admin/outreach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        property_address: '1 Test St',
        suburb: 'Oteha',
        city: 'Auckland',
        region: 'Auckland',
      }),
    }));

    expect(response.status).toBe(200);
    expect(marieDB.query).toHaveBeenCalledWith(
      'REFRESH MATERIALIZED VIEW CONCURRENTLY outreach_enriched'
    );
  });

  it('does not trigger MV REFRESH when MV is disabled', async () => {
    process.env.USE_OUTREACH_MV = 'false';
    vi.mocked(auth).mockResolvedValueOnce({
      user: { email: 'nzlouis.com@gmail.com' },
    } as any);

    vi.mocked(marieDB.query)
      .mockResolvedValueOnce({ rows: [] } as any)
      .mockResolvedValueOnce({ rows: [{ id: 'new-id', status: 'pending' }] } as any);

    const response = await POST(new Request('http://localhost:3000/api/admin/outreach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        property_address: '2 Test Ave',
        suburb: 'Oteha',
        city: 'Auckland',
        region: 'Auckland',
      }),
    }));

    expect(response.status).toBe(200);
    const refreshCalls = vi.mocked(marieDB.query).mock.calls.filter(
      c => c[0] === 'REFRESH MATERIALIZED VIEW CONCURRENTLY outreach_enriched'
    );
    expect(refreshCalls).toHaveLength(0);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PATCH, DELETE } from '@/app/api/admin/outreach/[id]/route';
import { PATCH as StatusPATCH } from '@/app/api/admin/outreach/[id]/status/route';
import { auth } from '@/lib/auth';
import { marieDB } from '@/lib/db';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  marieDB: {
    query: vi.fn().mockResolvedValue({ rows: [] }),
    connect: vi.fn(),
    ensureOutreachTablesExist: vi.fn(),
  },
  ensureQuarterDispatchJunkSchema: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/permissions', () => ({
  isAdmin: vi.fn().mockReturnValue(true),
}));

function mockAuth() {
  vi.mocked(auth).mockResolvedValueOnce({
    user: { email: 'nzlouis.com@gmail.com' },
  } as any);
}

const params = Promise.resolve({ id: 'test-id' });

describe('Outreach [id] MV PATCH /api/admin/outreach/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.USE_OUTREACH_MV = 'true';
  });

  it('returns 401 if unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValueOnce(undefined as any);

    const response = await PATCH(
      new Request('http://localhost:3000/api/admin/outreach/test-id', { method: 'PATCH', body: JSON.stringify({ status: 'sent' }) }),
      { params }
    );
    expect(response.status).toBe(401);
  });

  it('accepts property_address update', async () => {
    mockAuth();

    vi.mocked(marieDB.query)
      .mockResolvedValueOnce({ rows: [{ id: 'test-id', property_address: '37 Masons Road' }] } as any);

    const response = await PATCH(
      new Request('http://localhost:3000/api/admin/outreach/test-id', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ property_address: '37 Masons Road' }),
      }),
      { params }
    );

    expect(response.status).toBe(200);
    const queryCall = vi.mocked(marieDB.query).mock.calls[0][0] as string;
    expect(queryCall).toContain('property_address');
  });

  it('accepts suburb/city/region/street updates', async () => {
    mockAuth();

    vi.mocked(marieDB.query)
      .mockResolvedValueOnce({ rows: [{ id: 'test-id', suburb: 'Oteha', city: 'Auckland', region: 'Auckland', street: 'Masons Road' }] } as any);

    const response = await PATCH(
      new Request('http://localhost:3000/api/admin/outreach/test-id', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suburb: 'Oteha', city: 'Auckland', region: 'Auckland', street: 'Masons Road' }),
      }),
      { params }
    );

    expect(response.status).toBe(200);
    const queryCall = vi.mocked(marieDB.query).mock.calls[0][0] as string;
    expect(queryCall).toContain('suburb');
    expect(queryCall).toContain('city');
    expect(queryCall).toContain('region');
    expect(queryCall).toContain('street');
  });

  it('triggers MV REFRESH after update', async () => {
    mockAuth();

    vi.mocked(marieDB.query)
      .mockResolvedValueOnce({ rows: [{ id: 'test-id' }] } as any);

    const response = await PATCH(
      new Request('http://localhost:3000/api/admin/outreach/test-id', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'sent' }),
      }),
      { params }
    );

    expect(response.status).toBe(200);
    expect(marieDB.query).toHaveBeenCalledWith(
      'REFRESH MATERIALIZED VIEW CONCURRENTLY outreach_enriched'
    );
  });

  it('returns 400 when no valid fields', async () => {
    mockAuth();

    const response = await PATCH(
      new Request('http://localhost:3000/api/admin/outreach/test-id', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }),
      { params }
    );

    expect(response.status).toBe(400);
  });

  it('returns 404 when property not found', async () => {
    mockAuth();

    vi.mocked(marieDB.query).mockResolvedValueOnce({ rows: [] } as any);

    const response = await PATCH(
      new Request('http://localhost:3000/api/admin/outreach/test-id', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'sent' }),
      }),
      { params }
    );

    expect(response.status).toBe(404);
  });

  it('updates properties.no_junk_mail via property_id when only no_junk_mail is provided', async () => {
    mockAuth();

    vi.mocked(marieDB.query)
      .mockResolvedValueOnce({
        rows: [{ id: 'test-id', suburb: 'Torbay', property_id: '96d479bd-6139-4949-a617-f9f83b7973a0' }],
      } as any)
      .mockResolvedValueOnce({ rows: [] } as any);

    const response = await PATCH(
      new Request('http://localhost:3000/api/admin/outreach/test-id', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ no_junk_mail: true }),
      }),
      { params }
    );

    expect(response.status).toBe(200);
    const calls = vi.mocked(marieDB.query).mock.calls;
    const selectSql = calls[0][0] as string;
    expect(selectSql).toContain('outreach_properties WHERE id = $1');
    expect(selectSql).not.toContain('no_junk_mail');
    const propertiesSql = calls[1][0] as string;
    expect(propertiesSql).toContain('UPDATE properties SET no_junk_mail');
    expect(propertiesSql).toContain('id = $2');
    expect(calls.some(([query]) => String(query).includes('outreach_property_quarter_status'))).toBe(false);
  });

  it('records Pending junk against the selected active quarter report', async () => {
    mockAuth();
    const transactionQuery = vi.fn().mockResolvedValue({ rows: [] });
    vi.mocked(marieDB.connect).mockResolvedValueOnce({
      query: transactionQuery,
      release: vi.fn(),
    } as any);

    vi.mocked(marieDB.query)
      .mockResolvedValueOnce({
        rows: [{
          id: 'test-id',
          suburb: 'Torbay',
          property_address: '5 Cliff Road',
          property_id: '96d479bd-6139-4949-a617-f9f83b7973a0',
        }],
      } as any)
      .mockResolvedValueOnce({ rows: [{ id: 'report-id' }] } as any)
      .mockResolvedValue({ rows: [] } as any);

    const response = await PATCH(
      new Request('http://localhost:3000/api/admin/outreach/test-id', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          no_junk_mail: true,
          quarter: 'Q3',
          year: 2026,
          suburb_report_id: 'report-id',
          suburb: 'Torbay',
        }),
      }),
      { params }
    );

    expect(response.status).toBe(200);
    const calls = vi.mocked(marieDB.query).mock.calls;
    const reportLookup = calls.find(([query]) => String(query).includes('FROM suburb_reports'));
    expect(reportLookup?.[0]).toContain("status = 'active'");
    const transactionCalls = transactionQuery.mock.calls;
    const quarterStatus = transactionCalls.find(([query]) => String(query).includes('INSERT INTO outreach_property_quarter_status'));
    expect(quarterStatus?.[0]).toContain('is_junk');
    expect(quarterStatus?.[0]).toContain('junk_at = NOW()');
    expect(quarterStatus?.[1]).toEqual(['test-id', 'report-id', 'Torbay', 'Q3', 2026]);
    expect((await response.json()).quarter_junk_recorded).toBe(true);
    expect(transactionCalls.some(([query]) => String(query).includes('UPDATE properties SET no_junk_mail'))).toBe(true);
    expect(transactionCalls[0][0]).toBe('BEGIN');
    expect(transactionCalls.at(-1)?.[0]).toBe('COMMIT');
  });

  it('records junk for an address already sent in the selected report even after the send window', async () => {
    mockAuth();
    const transactionQuery = vi.fn().mockResolvedValue({ rows: [] });
    vi.mocked(marieDB.connect).mockResolvedValueOnce({
      query: transactionQuery,
      release: vi.fn(),
    } as any);

    vi.mocked(marieDB.query)
      .mockResolvedValueOnce({
        rows: [{
          id: 'test-id',
          suburb: 'Murrays Bay',
          property_address: '500A Beach Road',
          property_id: '945da4eb-ec11-7b3e-5a3d-b8585d672bf0',
        }],
      } as any)
      .mockResolvedValueOnce({ rows: [{ id: 'report-id' }] } as any)
      .mockResolvedValue({ rows: [] } as any);

    const response = await PATCH(
      new Request('http://localhost:3000/api/admin/outreach/test-id', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          no_junk_mail: true,
          quarter: 'Q2',
          year: 2026,
          suburb_report_id: 'report-id',
          suburb: 'Murrays Bay',
        }),
      }),
      { params }
    );

    expect(response.status).toBe(200);
    expect((await response.json()).quarter_junk_recorded).toBe(true);
    const transactionCalls = transactionQuery.mock.calls;
    const quarterStatus = transactionCalls.find(([query]) => String(query).includes('INSERT INTO outreach_property_quarter_status'));
    expect(quarterStatus?.[1]).toEqual(['test-id', 'report-id', 'Murrays Bay', 'Q2', 2026]);
    expect(transactionCalls.some(([query]) => String(query).includes('SET is_junk = FALSE, junk_at = NULL'))).toBe(false);
  });

  it('records a late map junk mark against the quarter selected in the UI', async () => {
    mockAuth();
    const transactionQuery = vi.fn().mockResolvedValue({ rows: [] });
    vi.mocked(marieDB.connect).mockResolvedValueOnce({
      query: transactionQuery,
      release: vi.fn(),
    } as any);

    vi.mocked(marieDB.query)
      .mockResolvedValueOnce({
        rows: [{
          id: 'test-id',
          suburb: 'Murrays Bay',
          property_address: '500A Beach Road',
          property_id: '945da4eb-ec11-7b3e-5a3d-b8585d672bf0',
        }],
      } as any)
      .mockResolvedValueOnce({ rows: [{ id: 'q3-report-id' }] } as any)
      .mockResolvedValue({ rows: [] } as any);

    const response = await PATCH(
      new Request('http://localhost:3000/api/admin/outreach/test-id', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          no_junk_mail: true,
          quarter: 'Q3',
          year: 2026,
          suburb_report_id: 'q3-report-id',
          suburb: 'Murrays Bay',
        }),
      }),
      { params }
    );

    expect(response.status).toBe(200);
    expect((await response.json()).quarter_junk_recorded).toBe(true);
    const quarterStatus = transactionQuery.mock.calls.find(
      ([query]) => String(query).includes('INSERT INTO outreach_property_quarter_status')
    );
    // The address may have been sent in Q2, but the map is showing the Q3
    // Pending audience, so the junk mark must land on the selected Q3 report.
    expect(quarterStatus?.[1]).toEqual(['test-id', 'q3-report-id', 'Murrays Bay', 'Q3', 2026]);
  });

  it('records out-of-window Pending junk against the selected report instead of dropping it', async () => {
    mockAuth();
    const transactionQuery = vi.fn().mockResolvedValue({ rows: [] });
    vi.mocked(marieDB.connect).mockResolvedValueOnce({
      query: transactionQuery,
      release: vi.fn(),
    } as any);

    vi.mocked(marieDB.query)
      .mockResolvedValueOnce({
        rows: [{
          id: 'test-id',
          suburb: 'Torbay',
          property_address: '5 Cliff Road',
          property_id: '96d479bd-6139-4949-a617-f9f83b7973a0',
        }],
      } as any)
      .mockResolvedValueOnce({ rows: [{ id: 'report-id' }] } as any)
      .mockResolvedValue({ rows: [] } as any);

    const response = await PATCH(
      new Request('http://localhost:3000/api/admin/outreach/test-id', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          no_junk_mail: true,
          quarter: 'Q3',
          year: 2026,
          suburb_report_id: 'report-id',
          suburb: 'Torbay',
        }),
      }),
      { params }
    );

    expect(response.status).toBe(200);
    expect((await response.json()).quarter_junk_recorded).toBe(true);
    const transactionCalls = transactionQuery.mock.calls;
    const quarterStatus = transactionCalls.find(([query]) => String(query).includes('INSERT INTO outreach_property_quarter_status'));
    expect(quarterStatus?.[1]).toEqual(['test-id', 'report-id', 'Torbay', 'Q3', 2026]);
    expect(transactionCalls.some(([query]) => String(query).includes('SET is_junk = FALSE, junk_at = NULL'))).toBe(false);
    expect(transactionCalls.some(([query]) => String(query).includes('UPDATE properties SET no_junk_mail'))).toBe(true);
    expect(transactionCalls.at(-1)?.[0]).toBe('COMMIT');
  });

  it('clears junk in every report quarter when No Junk Mail is removed', async () => {
    mockAuth();
    const transactionQuery = vi.fn().mockResolvedValue({ rows: [] });
    vi.mocked(marieDB.connect).mockResolvedValueOnce({
      query: transactionQuery,
      release: vi.fn(),
    } as any);

    vi.mocked(marieDB.query)
      .mockResolvedValueOnce({
        rows: [{
          id: 'test-id',
          suburb: 'Torbay',
          property_address: '5 Cliff Road',
          property_id: '96d479bd-6139-4949-a617-f9f83b7973a0',
        }],
      } as any)
      .mockResolvedValueOnce({ rows: [{ id: 'report-id' }] } as any)
      .mockResolvedValue({ rows: [] } as any);

    const response = await PATCH(
      new Request('http://localhost:3000/api/admin/outreach/test-id', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          no_junk_mail: false,
          quarter: 'Q3',
          year: 2026,
          suburb_report_id: 'report-id',
          suburb: 'Torbay',
        }),
      }),
      { params }
    );

    expect(response.status).toBe(200);
    expect((await response.json()).quarter_junk_recorded).toBe(false);
    const transactionCalls = transactionQuery.mock.calls;
    expect(transactionCalls.some(([query]) => String(query).includes('report.id AS report_id'))).toBe(false);
    const clearJunk = transactionCalls.find(([query]) => String(query).includes('SET is_junk = FALSE, junk_at = NULL'));
    expect(clearJunk?.[0]).toContain('WHERE outreach_property_id = $1');
    expect(clearJunk?.[1]).toEqual(['test-id']);
    expect(transactionCalls.some(([query]) => String(query).includes('INSERT INTO outreach_property_quarter_status'))).toBe(false);
  });

  it('does not include no_junk_mail in the outreach UPDATE when combined with other fields', async () => {
    mockAuth();

    vi.mocked(marieDB.query)
      .mockResolvedValueOnce({
        rows: [{ id: 'test-id', suburb: 'Torbay', property_id: '96d479bd-6139-4949-a617-f9f83b7973a0' }],
      } as any)
      .mockResolvedValueOnce({ rows: [] } as any);

    const response = await PATCH(
      new Request('http://localhost:3000/api/admin/outreach/test-id', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'sent', no_junk_mail: true }),
      }),
      { params }
    );

    expect(response.status).toBe(200);
    const calls = vi.mocked(marieDB.query).mock.calls;
    const outreachSql = calls[0][0] as string;
    expect(outreachSql).toContain('UPDATE outreach_properties');
    expect(outreachSql).toContain('status');
    expect(outreachSql).not.toContain('no_junk_mail');
    const propertiesSql = calls[1][0] as string;
    expect(propertiesSql).toContain('UPDATE properties SET no_junk_mail');
  });

  it('updates properties.no_junk_mail via address+suburb fallback when property_id is missing', async () => {
    mockAuth();

    vi.mocked(marieDB.query)
      .mockResolvedValueOnce({
        rows: [{ id: 'test-id', suburb: 'Torbay', property_address: '5 Cliff Road', property_id: null }],
      } as any)
      .mockResolvedValueOnce({ rows: [] } as any);

    const response = await PATCH(
      new Request('http://localhost:3000/api/admin/outreach/test-id', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ no_junk_mail: false }),
      }),
      { params }
    );

    expect(response.status).toBe(200);
    const calls = vi.mocked(marieDB.query).mock.calls;
    const propertiesSql = calls[1][0] as string;
    expect(propertiesSql).toContain('UPDATE properties SET no_junk_mail');
    expect(propertiesSql).toContain('LOWER(TRIM(address))');
    expect(propertiesSql).toContain('LOWER(TRIM(suburb))');
  });
});

describe('Outreach [id] MV DELETE /api/admin/outreach/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.USE_OUTREACH_MV = 'true';
  });

  it('returns 401 if unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValueOnce(undefined as any);

    const response = await DELETE(
      new Request('http://localhost:3000/api/admin/outreach/test-id', { method: 'DELETE' }),
      { params }
    );
    expect(response.status).toBe(401);
  });

  it('triggers MV REFRESH after delete', async () => {
    mockAuth();

    vi.mocked(marieDB.query).mockResolvedValueOnce({ rows: [{ id: 'test-id' }] } as any);

    const response = await DELETE(
      new Request('http://localhost:3000/api/admin/outreach/test-id', { method: 'DELETE' }),
      { params }
    );

    expect(response.status).toBe(200);
    expect(marieDB.query).toHaveBeenCalledWith(
      'REFRESH MATERIALIZED VIEW CONCURRENTLY outreach_enriched'
    );
  });

  it('returns 404 when property not found', async () => {
    mockAuth();

    vi.mocked(marieDB.query).mockResolvedValueOnce({ rows: [] } as any);

    const response = await DELETE(
      new Request('http://localhost:3000/api/admin/outreach/test-id', { method: 'DELETE' }),
      { params }
    );

    expect(response.status).toBe(404);
  });

  it('does not trigger MV REFRESH when MV is disabled', async () => {
    process.env.USE_OUTREACH_MV = 'false';
    mockAuth();

    vi.mocked(marieDB.query).mockResolvedValueOnce({ rows: [{ id: 'test-id' }] } as any);

    await DELETE(
      new Request('http://localhost:3000/api/admin/outreach/test-id', { method: 'DELETE' }),
      { params }
    );

    const refreshCalls = vi.mocked(marieDB.query).mock.calls.filter(
      c => c[0] === 'REFRESH MATERIALIZED VIEW CONCURRENTLY outreach_enriched'
    );
    expect(refreshCalls).toHaveLength(0);
  });
});

describe('Outreach [id]/status MV PATCH /api/admin/outreach/[id]/status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.USE_OUTREACH_MV = 'true';
  });

  it('returns 403 if unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValueOnce(undefined as any);

    const response = await StatusPATCH(
      new Request('http://localhost:3000/api/admin/outreach/test-id/status', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'sent' }),
      }),
      { params }
    );
    expect(response.status).toBe(403);
  });

  it('triggers MV REFRESH after status update', async () => {
    mockAuth();

    vi.mocked(marieDB.query).mockResolvedValueOnce({ rows: [{ id: 'test-id', status: 'sent' }] } as any);

    const response = await StatusPATCH(
      new Request('http://localhost:3000/api/admin/outreach/test-id/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'sent' }),
      }),
      { params }
    );

    expect(response.status).toBe(200);
    expect(marieDB.query).toHaveBeenCalledWith(
      'REFRESH MATERIALIZED VIEW CONCURRENTLY outreach_enriched'
    );
  });

  it('returns 400 for invalid status', async () => {
    mockAuth();

    const response = await StatusPATCH(
      new Request('http://localhost:3000/api/admin/outreach/test-id/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'invalid_status' }),
      }),
      { params }
    );
    expect(response.status).toBe(400);
  });
});

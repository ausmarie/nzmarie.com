import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/admin/outreach/street-clusters/route';
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

function addr(street: string, property_address: string, lat?: number, lng?: number) {
  return { street, property_address, house_number: null, lat: lat ?? null, lng: lng ?? null };
}

describe('GET /api/admin/outreach/street-clusters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 if unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValueOnce(undefined as any);

    const response = await GET(
      new Request('http://localhost:3000/api/admin/outreach/street-clusters?suburb=Torbay')
    );
    expect(response.status).toBe(401);
  });

  it('returns 400 when suburb is missing', async () => {
    mockAuth();
    const response = await GET(
      new Request('http://localhost:3000/api/admin/outreach/street-clusters')
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Missing suburb parameter');
  });

  it('orders streets by nearest distance and returns runs', async () => {
    mockAuth();

    vi.mocked(marieDB.query)
      .mockResolvedValueOnce({
        rows: [
          addr('Alpha Street', '1 Alpha Street', -36.6958, 174.7453),
          addr('Alpha Street', '3 Alpha Street', -36.6958, 174.7453),
          addr('Alpha Street', '5 Alpha Street', -36.6958, 174.7453),
          addr('Alpha Street', '7 Alpha Street', -36.6958, 174.7453),
          addr('Alpha Street', '9 Alpha Street', -36.6958, 174.7453),
          addr('Beta Street', '2 Beta Street', -36.6959, 174.7454),
          addr('Beta Street', '4 Beta Street', -36.6959, 174.7454),
          addr('Beta Street', '6 Beta Street', -36.6959, 174.7454),
          addr('NoCoord Street', '1 NoCoord Street'),
        ],
      } as any)
      .mockResolvedValueOnce({ rows: [] } as any);

    const response = await GET(
      new Request('http://localhost:3000/api/admin/outreach/street-clusters?suburb=Torbay&radius=500&budget=20')
    );
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.suburb).toBe('Torbay');
    expect(body.radius).toBe(500);
    expect(body.budget).toBe(20);
    expect(body.manualOrder).toBe(false);

    // Alpha (house 1) is the start street, then the nearest street Beta,
    // then the no-coordinate street appended at the end.
    const runStreets = body.runs[0].groups.flatMap((g: any) => g.streets.map((s: any) => s.street));
    expect(runStreets).toEqual(['Alpha Street', 'Beta Street', 'NoCoord Street']);

    expect(body.groups).toHaveLength(1);
    expect(body.groups[0].streets).toHaveLength(3);
    expect(body.groups[0].totalPending).toBe(9);

    expect(body.runs).toHaveLength(1);
    expect(body.runs[0].totalPending).toBe(9);
    expect(body.runs[0].streetCount).toBe(3);
    expect(body.runs[0].runId).toBe(1);

    const alpha = body.runs[0].groups
      .flatMap((g: any) => g.streets)
      .find((s: any) => s.street === 'Alpha Street');
    expect(alpha.addresses).toEqual([
      '1 Alpha Street', '3 Alpha Street', '5 Alpha Street', '7 Alpha Street', '9 Alpha Street',
    ]);

    expect(body.unclusteredStreets).toEqual([{ street: 'NoCoord Street', has_coords: false }]);
  });

  it('clamps radius and budget to allowed ranges', async () => {
    mockAuth();
    vi.mocked(marieDB.query).mockResolvedValue({ rows: [] } as any);

    const response = await GET(
      new Request('http://localhost:3000/api/admin/outreach/street-clusters?suburb=Torbay&radius=99999&budget=99999')
    );
    const body = await response.json();
    expect(body.radius).toBe(2000);
    expect(body.budget).toBe(100);
  });

  it('returns 500 when the DB query throws', async () => {
    mockAuth();
    vi.mocked(marieDB.query).mockRejectedValueOnce(new Error('boom'));

    const response = await GET(
      new Request('http://localhost:3000/api/admin/outreach/street-clusters?suburb=Torbay')
    );
    expect(response.status).toBe(500);
  });

  it('applies a saved manual order when one exists', async () => {
    mockAuth();

    vi.mocked(marieDB.query)
      .mockResolvedValueOnce({
        rows: [
          addr('Alpha Street', '1 Alpha Street', -36.6958, 174.7453),
          addr('Beta Street', '2 Beta Street', -36.6959, 174.7454),
          addr('Gamma Street', '3 Gamma Street', -36.6957, 174.7452),
          addr('NoCoord Street', '1 NoCoord Street'),
          addr('NoCoord Street', '2 NoCoord Street'),
        ],
      } as any)
      .mockResolvedValueOnce({
        rows: [{ setting_value: JSON.stringify(['Gamma Street', 'Alpha Street']) }],
      } as any);

    const response = await GET(
      new Request('http://localhost:3000/api/admin/outreach/street-clusters?suburb=Torbay&radius=500&budget=20')
    );
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.manualOrder).toBe(true);
    expect(body.manualOrderCount).toBe(2);

    const runStreets = body.runs[0].groups.flatMap((g: any) => g.streets.map((s: any) => s.street));
    // Saved order first (Gamma, Alpha), then remaining streets alphabetically (Beta),
    // then the no-coordinate street appended at the end.
    expect(runStreets).toEqual(['Gamma Street', 'Alpha Street', 'Beta Street', 'NoCoord Street']);
  });

  it('returns manualOrder false when no saved order exists', async () => {
    mockAuth();

    vi.mocked(marieDB.query)
      .mockResolvedValueOnce({
        rows: [
          addr('Alpha Street', '1 Alpha Street', -36.6958, 174.7453),
        ],
      } as any)
      .mockResolvedValueOnce({ rows: [] } as any);

    const response = await GET(
      new Request('http://localhost:3000/api/admin/outreach/street-clusters?suburb=Torbay')
    );
    const body = await response.json();
    expect(body.manualOrder).toBe(false);
  });

  it('starts the route from the requested start_street and reports it back', async () => {
    mockAuth();

    vi.mocked(marieDB.query)
      .mockResolvedValueOnce({
        rows: [
          addr('Alpha Street', '1 Alpha Street', -36.6958, 174.7453),
          addr('Alpha Street', '3 Alpha Street', -36.6958, 174.7453),
          addr('Beta Street', '2 Beta Street', -36.6959, 174.7454),
          addr('Beta Street', '4 Beta Street', -36.6959, 174.7454),
          addr('Gamma Street', '5 Gamma Street', -36.7, 174.74),
          addr('NoCoord Street', '1 NoCoord Street'),
        ],
      } as any)
      .mockResolvedValueOnce({ rows: [] } as any);

    const response = await GET(
      new Request('http://localhost:3000/api/admin/outreach/street-clusters?suburb=Torbay&start_street=Beta%20Street&budget=20')
    );
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.startStreet).toBe('Beta Street');
    expect(body.allStreets).toEqual([
      { street: 'Alpha Street', count: 2 },
      { street: 'Beta Street', count: 2 },
      { street: 'Gamma Street', count: 1 },
      { street: 'NoCoord Street', count: 1 },
    ]);

    // Beta is first (requested start), Alpha is nearest, then Gamma, then no-coord.
    const runStreets = body.runs[0].groups.flatMap((g: any) => g.streets.map((s: any) => s.street));
    expect(runStreets).toEqual(['Beta Street', 'Alpha Street', 'Gamma Street', 'NoCoord Street']);
  });

  it('falls back to the default start when start_street is unknown', async () => {
    mockAuth();

    vi.mocked(marieDB.query)
      .mockResolvedValueOnce({
        rows: [
          addr('Alpha Street', '1 Alpha Street', -36.6958, 174.7453),
          addr('Beta Street', '2 Beta Street', -36.6959, 174.7454),
        ],
      } as any)
      .mockResolvedValueOnce({ rows: [] } as any);

    const response = await GET(
      new Request('http://localhost:3000/api/admin/outreach/street-clusters?suburb=Torbay&start_street=Missing%20Street')
    );
    const body = await response.json();
    // Default start is the smallest house number street.
    expect(body.startStreet).toBe('Alpha Street');
    const runStreets = body.runs[0].groups.flatMap((g: any) => g.streets.map((s: any) => s.street));
    expect(runStreets).toEqual(['Alpha Street', 'Beta Street']);
  });

  it('returns addressCoords when address_coords=true with sent flags and statuses', async () => {
    mockAuth();
    vi.mocked(marieDB.query)
      .mockResolvedValueOnce({
        rows: [
          { id: '1', street: 'Alpha Street', property_address: '1 Alpha Street', house_number: 1, lat: -36.7, lng: 174.7, no_junk_mail: false },
          { id: '2', street: 'Alpha Street', property_address: '3 Alpha Street', house_number: 3, lat: -36.7001, lng: 174.7001, no_junk_mail: false },
          { id: '3', street: 'Beta Street', property_address: '2 Beta Street', house_number: 2, lat: -36.701, lng: 174.701, no_junk_mail: true },
        ],
      } as any)
      // sent rows
      .mockResolvedValueOnce({ rows: [{ outreach_property_id: '1' }] } as any)
      // stored order
      .mockResolvedValueOnce({ rows: [] } as any);

    const response = await GET(
      new Request('http://localhost:3000/api/admin/outreach/street-clusters?suburb=Torbay&address_coords=true')
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    const alpha = body.runs[0].groups.flatMap((g: any) => g.streets).find((s: any) => s.street === 'Alpha Street');
    expect(alpha.addressCoords).toBeDefined();
    expect(alpha.addressCoords.map((a: any) => ({ address: a.address, lat: a.lat, lng: a.lng, sent: a.sent, status: a.status }))).toEqual([
      { address: '1 Alpha Street', lat: -36.7, lng: 174.7, sent: true, status: 'sent' },
      { address: '3 Alpha Street', lat: -36.7001, lng: 174.7001, sent: false, status: 'unsent' },
    ]);
    const beta = body.runs[0].groups.flatMap((g: any) => g.streets).find((s: any) => s.street === 'Beta Street');
    expect(beta.addressCoords![0].status).toBe('junk');
  });

  it('deduplicates duplicate rows for the same address and resolves one final status by precedence (sent > junk > unsent)', async () => {
    mockAuth();
    vi.mocked(marieDB.query)
      .mockResolvedValueOnce({
        rows: [
          { id: '1', street: 'Helen Ryburn Place', property_address: '26 Helen Ryburn Place', house_number: 26, lat: -36.7, lng: 174.7, no_junk_mail: true },
          { id: '2', street: 'Helen Ryburn Place', property_address: '26 Helen Ryburn Place', house_number: 26, lat: -36.7, lng: 174.7, no_junk_mail: false, sent_at: '2026-08-13T00:00:00Z', total_send_count: 1 },
        ],
      } as any)
      .mockResolvedValueOnce({ rows: [{ outreach_property_id: '2' }] } as any)
      .mockResolvedValueOnce({ rows: [] } as any);

    const response = await GET(
      new Request('http://localhost:3000/api/admin/outreach/street-clusters?suburb=Torbay&address_coords=true')
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    const street = body.runs[0].groups.flatMap((g: any) => g.streets).find((s: any) => s.street === 'Helen Ryburn Place');
    expect(street.addressCoords).toHaveLength(1);
    expect(street.addressCoords[0].status).toBe('sent');
    expect(street.addressCoords[0].sent).toBe(true);
  });

  it('includes both pending and sent records with status sent when sent_status is all', async () => {
    mockAuth();
    vi.mocked(marieDB.query)
      .mockResolvedValueOnce({
        rows: [
          { id: '1', street: 'Alpha Street', property_address: '1 Alpha Street', house_number: 1, lat: -36.7, lng: 174.7, no_junk_mail: false, status: 'sent', sent_at: '2026-08-13T00:00:00Z', total_send_count: 1 },
          { id: '2', street: 'Alpha Street', property_address: '3 Alpha Street', house_number: 3, lat: -36.7001, lng: 174.7001, no_junk_mail: false, status: 'pending', sent_at: null, total_send_count: 0 },
        ],
      } as any)
      .mockResolvedValueOnce({ rows: [] } as any)
      .mockResolvedValueOnce({ rows: [] } as any);

    const response = await GET(
      new Request('http://localhost:3000/api/admin/outreach/street-clusters?suburb=Torbay&status=pending&sent_status=all&address_coords=true')
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    const querySql = vi.mocked(marieDB.query).mock.calls[0][0] as string;
    expect(querySql).toContain("op.status IN ('pending', 'sent')");

    const alpha = body.runs[0].groups.flatMap((g: any) => g.streets).find((s: any) => s.street === 'Alpha Street');
    expect(alpha.addressCoords).toEqual([
      { address: '1 Alpha Street', lat: -36.7, lng: 174.7, sent: true, status: 'sent' },
      { address: '3 Alpha Street', lat: -36.7001, lng: 174.7001, sent: false, status: 'unsent' },
    ]);
  });

  it('computes address sent/status per quarter when report_quarter is set', async () => {
    mockAuth();
    vi.mocked(marieDB.query)
      .mockResolvedValueOnce({
        rows: [
          { id: '1', street: 'Alpha Street', property_address: '1 Alpha Street', house_number: 1, lat: -36.7, lng: 174.7, no_junk_mail: false, status: 'sent', sent_at: '2026-05-01T00:00:00Z', total_send_count: 1, last_campaign: '2026_Q2_Oteha' },
          { id: '2', street: 'Alpha Street', property_address: '3 Alpha Street', house_number: 3, lat: -36.7001, lng: 174.7001, no_junk_mail: false, status: 'pending', last_campaign: null },
          { id: '3', street: 'Alpha Street', property_address: '5 Alpha Street', house_number: 5, lat: -36.7002, lng: 174.7002, no_junk_mail: false, status: 'sent', last_campaign: '2026_Q3_Oteha' },
        ],
      } as any)
      .mockResolvedValueOnce({ rows: [{ outreach_property_id: '3' }] } as any)
      .mockResolvedValueOnce({ rows: [] } as any);

    const response = await GET(
      new Request('http://localhost:3000/api/admin/outreach/street-clusters?suburb=Oteha&status=pending&sent_status=all&report_quarter=2026-Q3&address_coords=true')
    );
    expect(response.status).toBe(200);

    const listSql = vi.mocked(marieDB.query).mock.calls[0][0] as string;
    expect(listSql).toContain("op.status IN ('pending', 'sent')");

    const sendSql = vi.mocked(marieDB.query).mock.calls[1][0] as string;
    const sendParams = vi.mocked(marieDB.query).mock.calls[1][1] as unknown[];
    expect(sendSql).toContain('campaign_key ~ $5');
    expect(sendParams).toContain('^2026[_-]Q3');

    const body = await response.json();
    const alpha = body.runs[0].groups.flatMap((g: any) => g.streets).find((s: any) => s.street === 'Alpha Street');
    expect(alpha.addressCoords).toEqual([
      { address: '1 Alpha Street', lat: -36.7, lng: 174.7, sent: false, status: 'unsent' },
      { address: '3 Alpha Street', lat: -36.7001, lng: 174.7001, sent: false, status: 'unsent' },
      { address: '5 Alpha Street', lat: -36.7002, lng: 174.7002, sent: true, status: 'sent' },
    ]);
  });
});

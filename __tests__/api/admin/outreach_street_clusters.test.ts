import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/admin/outreach/street-clusters/route';
import { auth } from '@/lib/auth';
import { marieDB } from '@/lib/db';
import {
  getStreetClustersFromCache,
  setStreetClustersInCache,
} from '@/lib/redis';

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

vi.mock('@/lib/redis', () => ({
  streetClustersKey: vi.fn((suburb, status, sentStatus, quarter, budget) =>
    `street_clusters:${suburb}:${status}:${sentStatus}:${quarter ?? 'all'}:${budget}`
  ),
  getStreetClustersFromCache: vi.fn(),
  setStreetClustersInCache: vi.fn(async () => undefined),
}));

function point(street: string, lat: number, lng: number) {
  return {
    street,
    suburb: 'Torbay',
    lat,
    lng,
    pendingCount: 1,
    addresses: [`1 ${street}`],
  };
}

const cachedAlphaOrder = {
  success: true,
  radius: 500,
  budget: 30,
  suburb: 'Torbay',
  groups: [
    {
      groupId: 1,
      streets: [point('Alpha Street', -36.6958, 174.7453), point('Beta Street', -36.6959, 174.7454), point('Zeta Street', -36.7, 174.75)],
      totalPending: 3,
      extentMeters: 0,
    },
  ],
  runs: [
    {
      runId: 1,
      groups: [
        {
          groupId: 1,
          streets: [point('Alpha Street', -36.6958, 174.7453), point('Beta Street', -36.6959, 174.7454), point('Zeta Street', -36.7, 174.75)],
          totalPending: 3,
          extentMeters: 0,
        },
      ],
      totalPending: 3,
      streetCount: 3,
    },
  ],
  startStreet: 'Alpha Street',
  allStreets: [
    { street: 'Alpha Street', count: 1 },
    { street: 'Beta Street', count: 1 },
    { street: 'Zeta Street', count: 1 },
  ],
  manualOrder: false,
  manualOrderCount: 0,
};

const addressRows = [
  { street: 'Alpha Street', house_number: '1', property_address: '1 Alpha Street', lat: '-36.6958', lng: '174.7453' },
  { street: 'Beta Street', house_number: '1', property_address: '1 Beta Street', lat: '-36.6959', lng: '174.7454' },
  { street: 'Zeta Street', house_number: '1', property_address: '1 Zeta Street', lat: '-36.7', lng: '174.75' },
];

function mockAuth() {
  vi.mocked(auth).mockResolvedValueOnce({
    user: { email: 'nzlouis.com@gmail.com' },
  } as any);
}

function baseUrl(startStreet?: string) {
  let url = 'http://localhost:3000/api/admin/outreach/street-clusters?suburb=Torbay&radius=500&budget=30&status=pending&sent_status=unsent';
  if (startStreet) url += `&start_street=${encodeURIComponent(startStreet)}`;
  return url;
}

describe('Outreach street-clusters GET - Start street ordering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValueOnce(undefined as any);
    const response = await GET(new Request(baseUrl('Zeta Street')));
    expect(response.status).toBe(401);
  });

  it('re-applies the requested start street to cached data so Run 1 starts there', async () => {
    mockAuth();
    vi.mocked(getStreetClustersFromCache).mockResolvedValueOnce(cachedAlphaOrder as any);

    const response = await GET(new Request(baseUrl('Zeta Street')));
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.startStreet).toBe('Zeta Street');
    expect(data.runs[0].groups[0].streets[0].street).toBe('Zeta Street');
    // No DB hit on a cache hit.
    expect(marieDB.query).not.toHaveBeenCalled();
    expect(setStreetClustersInCache).not.toHaveBeenCalled();
  });

  it('returns the cached order unchanged when no start street is requested', async () => {
    mockAuth();
    vi.mocked(getStreetClustersFromCache).mockResolvedValueOnce(cachedAlphaOrder as any);

    const response = await GET(new Request(baseUrl()));
    const data = await response.json();
    expect(data.startStreet).toBe('Alpha Street');
    expect(data.runs[0].groups[0].streets[0].street).toBe('Alpha Street');
  });

  it('respects manual ordering over start street on a cache hit', async () => {
    mockAuth();
    vi.mocked(getStreetClustersFromCache).mockResolvedValueOnce({
      ...cachedAlphaOrder,
      manualOrder: true,
      manualOrderCount: 2,
    } as any);

    const response = await GET(new Request(baseUrl('Zeta Street')));
    const data = await response.json();
    // Manual order wins: first street stays Alpha Street.
    expect(data.runs[0].groups[0].streets[0].street).toBe('Alpha Street');
  });

  it('counts returned quarter addresses with the canonical street and marks them unsent on the map', async () => {
    mockAuth();
    vi.mocked(getStreetClustersFromCache).mockResolvedValueOnce(null as any);
    vi.mocked(marieDB.query)
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'unreturned-id',
            street: 'East Coast Road',
            house_number: 1008,
            property_address: '1008A East Coast Road',
            lat: '-36.72',
            lng: '174.75',
            status: 'pending',
          },
          {
            id: 'returned-id-1',
            street: 'East Coast Road Fairview',
            house_number: 1010,
            property_address: '1010 East Coast Road',
            lat: '-36.721',
            lng: '174.751',
            status: 'pending',
            last_campaign: '2026_Q3_Fairview Heights',
          },
          {
            id: 'returned-id-2',
            street: 'East Coast Road Fairview',
            house_number: 1038,
            property_address: '1038 East Coast Road',
            lat: '-36.722',
            lng: '174.752',
            status: 'pending',
            last_campaign: '2026_Q3_Fairview Heights',
          },
        ],
      } as any)
      .mockResolvedValueOnce({
        rows: [
          { outreach_property_id: 'returned-id-1', status: 'pending' },
          { outreach_property_id: 'returned-id-2', status: 'pending' },
        ],
      } as any)
      // Stale log rows must not override explicit returned quarter statuses.
      .mockResolvedValueOnce({
        rows: [
          { outreach_property_id: 'returned-id-1' },
          { outreach_property_id: 'returned-id-2' },
        ],
      } as any)
      .mockResolvedValueOnce({ rows: [] } as any);

    const response = await GET(new Request(
      'http://localhost:3000/api/admin/outreach/street-clusters?suburb=Fairview%20Heights&budget=30&status=pending&sent_status=unsent&report_quarter=2026-Q3&address_coords=true'
    ));
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.allStreets).toEqual([{ street: 'East Coast Road', count: 3 }]);
    expect(body.groups[0].totalPending).toBe(3);
    expect(body.groups[0].streets).toHaveLength(1);
    expect(body.groups[0].streets[0].addressCoords).toHaveLength(3);
    expect(body.groups[0].streets[0].addressCoords.map((address: { status: string }) => address.status))
      .toEqual(['unsent', 'unsent', 'unsent']);

    const quarterStatusQuery = String(vi.mocked(marieDB.query).mock.calls[1][0]);
    expect(quarterStatusQuery).toContain('outreach_property_quarter_status');
    const sendLogsQuery = String(vi.mocked(marieDB.query).mock.calls[2][0]);
    expect(sendLogsQuery).toContain("returned.status = 'pending'");
  });

  it('orders Run 1 from the start street on a cache miss (DB path)', async () => {
    mockAuth();
    vi.mocked(getStreetClustersFromCache).mockResolvedValueOnce(null as any);
    vi.mocked(marieDB.query)
      .mockResolvedValueOnce({ rows: addressRows } as any)
      .mockResolvedValueOnce({ rows: [] } as any);

    const response = await GET(new Request(baseUrl('Zeta Street')));
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.runs[0].groups[0].streets[0].street).toBe('Zeta Street');
    expect(data.startStreet).toBe('Zeta Street');
    expect(setStreetClustersInCache).toHaveBeenCalled();
  });
});
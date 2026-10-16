import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../../../app/api/admin/analytics/scans/route';

vi.mock('../../../lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('../../../lib/permissions', () => ({
  isSuperAdmin: vi.fn(),
}));

vi.mock('../../../lib/db', () => ({
  marieDB: {
    query: vi.fn(),
  },
}));

vi.mock('../../../lib/campaign-tracker', () => ({
  ensureCampaignTablesExist: vi.fn().mockResolvedValue(undefined),
}));

import { auth } from '../../../lib/auth';
import { isSuperAdmin } from '../../../lib/permissions';
import { marieDB } from '../../../lib/db';

describe('GET /api/admin/analytics/scans', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 403 if user is not authenticated or not super admin', async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as any);

    const req = new Request('https://www.nzmarie.com/api/admin/analytics/scans');
    const res = await GET(req);

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe('Forbidden');
  });

  it('returns scan analytics summary and visit logs for super admin', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ user: { email: 'louis@example.com' } } as any);
    vi.mocked(isSuperAdmin).mockReturnValueOnce(true);

    const mockSummary = { rows: [{ total_pv: '42', total_uv: '30', total_new_devices: '15' }], rowCount: 1, command: '', oid: 0, fields: [] };
    const mockCampaigns = {
      rows: [{ campaign_key: 'oteha', campaign_name: 'Oteha Campaign', total_pv: 42, total_uv: 30, new_devices: 15, last_visited_at: '2026-07-23T10:00:00Z' }],
      rowCount: 1,
      command: '',
      oid: 0,
      fields: [],
    };
    const mockLogs = {
      rows: [
        {
          id: 'log-1',
          campaign_key: 'oteha',
          visitor_hash: 'abc123hash',
          ip_address: '127.0.0.1',
          user_agent: 'Safari',
          device_type: 'mobile',
          referrer: '',
          is_unique: true,
          is_new_device: true,
          created_at: '2026-07-23T10:00:00Z',
        },
      ],
      rowCount: 1,
      command: '',
      oid: 0,
      fields: [],
    };

    (marieDB.query as any)
      .mockResolvedValueOnce(mockSummary)
      .mockResolvedValueOnce(mockCampaigns)
      .mockResolvedValueOnce(mockLogs);

    const req = new Request('https://www.nzmarie.com/api/admin/analytics/scans');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.total_scans).toBe(42);
    expect(data.total_unique).toBe(30);
    expect(data.total_new_devices).toBe(15);
    expect(data.campaigns).toHaveLength(1);
    expect(data.campaigns[0].new_devices).toBe(15);
    expect(data.logs).toHaveLength(1);
  });

  it('filters by type=new_device and applies is_new_device = true condition', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ user: { email: 'louis@example.com' } } as any);
    vi.mocked(isSuperAdmin).mockReturnValueOnce(true);

    const mockSummary = { rows: [{ total_pv: '42', total_uv: '30', total_new_devices: '15' }], rowCount: 1, command: '', oid: 0, fields: [] };
    const mockCampaigns = { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
    const mockLogs = { rows: [{ id: 'log-1', is_new_device: true }], rowCount: 1, command: '', oid: 0, fields: [] };
    const mockCount = { rows: [{ total: 1 }], rowCount: 1, command: '', oid: 0, fields: [] };
    const mockNewDevCount = { rows: [{ cnt: 1 }], rowCount: 1, command: '', oid: 0, fields: [] };
    const mockRepeatCount = { rows: [{ cnt: 0 }], rowCount: 1, command: '', oid: 0, fields: [] };

    (marieDB.query as any)
      .mockResolvedValueOnce(mockSummary)
      .mockResolvedValueOnce(mockCampaigns)
      .mockResolvedValueOnce(mockNewDevCount)
      .mockResolvedValueOnce(mockRepeatCount)
      .mockResolvedValueOnce(mockLogs)
      .mockResolvedValueOnce(mockCount);

    const req = new Request('https://www.nzmarie.com/api/admin/analytics/scans?page=1&limit=20&type=new_device');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.logs).toHaveLength(1);

    const queries = vi.mocked(marieDB.query).mock.calls.map(call => String(call[0]));
    expect(queries.some(q => q.includes('is_new_device = true'))).toBe(true);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/admin/outreach/send/route';
import { GET } from '@/app/api/admin/outreach/[id]/history/route';
import { auth } from '@/lib/auth';
import { marieDB } from '@/lib/db';
import { invalidateDashboardStatsCache, invalidateStreetClustersForSuburb } from '@/lib/redis';

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

vi.mock('@/lib/redis', () => ({
  invalidateDashboardStatsCache: vi.fn().mockResolvedValue(undefined),
  invalidateStreetClustersForSuburb: vi.fn().mockResolvedValue(undefined),
}));

function mockSendQueries({
  properties,
  reports = [],
}: {
  properties: Array<{ id: string; suburb: string | null }>;
  reports?: Array<{ id: string; suburb: string }>;
}) {
  const mockQuery = vi.mocked(marieDB.query);
  mockQuery.mockImplementation(async (sql: string) => {
    if (sql.includes('FROM outreach_properties WHERE id = ANY')) {
      return { rows: properties } as any;
    }
    if (sql.includes('INSERT INTO outreach_send_logs')) {
      return {
        rows: properties.map((property, index) => ({
          id: `log-${index + 1}`,
          outreach_property_id: property.id,
        })),
      } as any;
    }
    if (sql.includes('UPDATE outreach_properties AS op')) {
      return { rows: [] } as any;
    }
    if (sql.includes('FROM suburb_reports')) {
      return { rows: reports } as any;
    }
    return { rows: [] } as any;
  });
  return mockQuery;
}

function sendRequest(body: Record<string, unknown>) {
  return new Request('http://localhost:3000/api/admin/outreach/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('Outreach Send and History API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({
      user: { email: 'nzlouis.com@gmail.com' },
    } as any);
  });

  describe('POST /api/admin/outreach/send', () => {
    it('returns 401 if unauthenticated', async () => {
      vi.mocked(auth).mockResolvedValueOnce(undefined as any);

      const response = await POST(sendRequest({ property_ids: ['prop-1'] }));
      expect(response.status).toBe(401);
    });

    it('bulk inserts send logs and updates property stats without changing lead status', async () => {
      const mockQuery = mockSendQueries({
        properties: [{ id: 'prop-1', suburb: 'Oteha' }],
      });

      const response = await POST(
        sendRequest({
          property_ids: ['prop-1'],
          report_title: 'Oteha 2026 Q2 Market Report',
          campaign_key: '2026_Q2_Oteha',
        })
      );
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.count).toBe(1);

      const logCall = mockQuery.mock.calls.find((call) =>
        String(call[0]).includes('INSERT INTO outreach_send_logs')
      );
      expect(logCall).toBeDefined();
      expect(logCall![0]).toContain('FROM unnest($1::uuid[], $6::text[], $7::text[])');
      expect(logCall![1]?.[0]).toEqual(['prop-1']);
      expect(logCall![1]?.[5]).toEqual(['2026_Q2_Oteha']);
      expect(logCall![1]?.[6]).toEqual(['Oteha']);

      const updateCall = mockQuery.mock.calls.find((call) =>
        String(call[0]).includes('UPDATE outreach_properties AS op')
      );
      expect(updateCall).toBeDefined();
      expect(updateCall![0]).toContain('FROM unnest($1::uuid[], $3::text[])');
      expect(updateCall![0]).toContain("status = CASE WHEN op.status = 'pending' THEN 'sent' ELSE op.status END");
      expect(updateCall![1]).toEqual([['prop-1'], 'nzlouis.com@gmail.com', ['2026_Q2_Oteha']]);
    });

    it('re-tags campaign keys per property suburb before the bulk insert', async () => {
      const mockQuery = mockSendQueries({
        properties: [
          { id: 'prop-torbay-1', suburb: 'Torbay' },
          { id: 'prop-oteha-1', suburb: 'Oteha' },
        ],
      });

      const response = await POST(
        sendRequest({
          property_ids: ['prop-torbay-1', 'prop-oteha-1'],
          campaign_key: '2026_Q2_Fairview Heights',
        })
      );
      expect(response.status).toBe(200);

      const logCall = mockQuery.mock.calls.find((call) =>
        String(call[0]).includes('INSERT INTO outreach_send_logs')
      );
      expect(logCall![1]?.[5]).toEqual(['2026_Q2_Torbay', '2026_Q2_Oteha']);

      const updateCall = mockQuery.mock.calls.find((call) =>
        String(call[0]).includes('UPDATE outreach_properties AS op')
      );
      expect(updateCall![1]?.[2]).toEqual(['2026_Q2_Torbay', '2026_Q2_Oteha']);
    });

    it('bulk upserts quarter status with an explicit report id', async () => {
      const mockQuery = mockSendQueries({
        properties: [{ id: 'prop-1', suburb: 'Oteha' }],
      });

      const response = await POST(
        sendRequest({
          property_ids: ['prop-1'],
          suburb_report_id: 'report-3',
          campaign_key: '2026_Q3_Oteha',
        })
      );
      expect(response.status).toBe(200);

      const reportLookup = mockQuery.mock.calls.find((call) =>
        String(call[0]).includes('FROM suburb_reports')
      );
      expect(reportLookup).toBeUndefined();

      const upsertCall = mockQuery.mock.calls.find((call) =>
        String(call[0]).includes('INSERT INTO outreach_property_quarter_status')
      );
      expect(upsertCall).toBeDefined();
      expect(upsertCall![0]).not.toContain('quarter_key,');
      expect(upsertCall![0]).toContain('EXCLUDED.campaign_keys[1]');
      expect(upsertCall![1]).toEqual([
        ['prop-1'],
        ['report-3'],
        'Q3',
        2026,
        ['Oteha'],
        ['2026_Q3_Oteha'],
      ]);
    });

    it('looks up active reports once when no report id is supplied', async () => {
      const mockQuery = mockSendQueries({
        properties: [{ id: 'prop-1', suburb: 'Oteha' }],
        reports: [{ id: 'report-3', suburb: 'Oteha' }],
      });

      const response = await POST(
        sendRequest({
          property_ids: ['prop-1'],
          campaign_key: '2026_Q3_Oteha',
        })
      );
      expect(response.status).toBe(200);

      const reportLookup = mockQuery.mock.calls.find((call) =>
        String(call[0]).includes('FROM suburb_reports')
      );
      expect(reportLookup).toBeDefined();
      expect(reportLookup![0]).toContain("status = 'active'");
      expect(reportLookup![1]).toEqual(['Q3', 2026, ['Oteha']]);

      const upsertCall = mockQuery.mock.calls.find((call) =>
        String(call[0]).includes('INSERT INTO outreach_property_quarter_status')
      );
      expect(upsertCall![1]).toEqual([
        ['prop-1'],
        ['report-3'],
        'Q3',
        2026,
        ['Oteha'],
        ['2026_Q3_Oteha'],
      ]);
    });

    it('skips quarter status when the campaign key has no quarter', async () => {
      const mockQuery = mockSendQueries({
        properties: [{ id: 'prop-1', suburb: 'Oteha' }],
      });

      const response = await POST(
        sendRequest({
          property_ids: ['prop-1'],
          campaign_key: 'autumn-drop',
        })
      );
      expect(response.status).toBe(200);

      const upsertCall = mockQuery.mock.calls.find((call) =>
        String(call[0]).includes('INSERT INTO outreach_property_quarter_status')
      );
      expect(upsertCall).toBeUndefined();
    });

    it('refreshes quarter materialized views directly without the incremental function', async () => {
      const mockQuery = mockSendQueries({
        properties: [{ id: 'prop-1', suburb: 'Oteha' }],
      });

      const response = await POST(
        sendRequest({
          property_ids: ['prop-1'],
          campaign_key: '2026_Q2_Oteha',
        })
      );
      expect(response.status).toBe(200);

      const statements = mockQuery.mock.calls.map((call) => String(call[0]));
      expect(statements).toContain('REFRESH MATERIALIZED VIEW mv_suburb_quarter_summary');
      expect(statements).toContain('REFRESH MATERIALIZED VIEW mv_quarter_overview');
      expect(statements).toContain('REFRESH MATERIALIZED VIEW mv_dispatch_timeline');
      expect(statements.some((statement) => statement.includes('refresh_quarter_mv_incremental'))).toBe(false);
      expect(invalidateDashboardStatsCache).toHaveBeenCalledOnce();
      expect(invalidateStreetClustersForSuburb).toHaveBeenCalledWith('Oteha');
      const lastRefreshCall = mockQuery.mock.calls.findIndex((call) =>
        String(call[0]).startsWith('REFRESH MATERIALIZED VIEW mv_dispatch_timeline')
      );
      expect(vi.mocked(invalidateDashboardStatsCache).mock.invocationCallOrder[0]).toBeGreaterThan(
        mockQuery.mock.invocationCallOrder[lastRefreshCall]
      );
    });
  });

  describe('GET /api/admin/outreach/[id]/history', () => {
    it('returns dispatch history for given property id', async () => {
      vi.mocked(marieDB.query).mockResolvedValueOnce({
        rows: [
          {
            log_id: 'log-1',
            outreach_property_id: 'prop-1',
            report_title: 'Oteha 2026 Q2 Market Report',
            campaign_key: '2026_Q2_Oteha',
            sent_at: '2026-06-15T00:00:00Z',
            scan_count: 2,
          },
        ],
      } as any);

      const response = await GET(new Request('http://localhost:3000/api/admin/outreach/prop-1/history'), {
        params: Promise.resolve({ id: 'prop-1' }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.history.length).toBe(1);
      expect(data.history[0].campaign_key).toBe('2026_Q2_Oteha');
    });
  });
});

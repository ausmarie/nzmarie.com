import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/admin/outreach/send/route';
import { GET } from '@/app/api/admin/outreach/[id]/history/route';
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

describe('Outreach Send and History API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/admin/outreach/send', () => {
    it('returns 401 if unauthenticated', async () => {
      vi.mocked(auth).mockResolvedValueOnce(undefined as any);

      const request = new Request('http://localhost:3000/api/admin/outreach/send', {
        method: 'POST',
        body: JSON.stringify({ property_ids: ['prop-1'] }),
      });

      const response = await POST(request);
      expect(response.status).toBe(401);
    });

    it('creates send log and updates property stats without changing lead status', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: { email: 'nzlouis.com@gmail.com' },
      } as any);

      vi.mocked(marieDB.query)
        .mockResolvedValueOnce({
          rows: [{ id: 'prop-1', suburb: 'Oteha' }],
        } as any)
        .mockResolvedValueOnce({
          rows: [{ id: 'log-1', outreach_property_id: 'prop-1', campaign_key: '2026_Q2_Oteha' }],
        } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any) // upsertQuarterStatus: SELECT suburb_report_id
        .mockResolvedValueOnce({ rows: [] } as any); // upsertQuarterStatus: UPSERT

      const request = new Request('http://localhost:3000/api/admin/outreach/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_ids: ['prop-1'],
          report_title: 'Oteha 2026 Q2 Market Report',
          campaign_key: '2026_Q2_Oteha',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.count).toBe(1);
    });

    it('re-tags the campaign key to the property suburb when the client sends a mismatched campaign', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: { email: 'nzlouis.com@gmail.com' },
      } as any);

      const mockQuery = vi.mocked(marieDB.query)
        .mockResolvedValueOnce({
          rows: [{ id: 'prop-torbay-1', suburb: 'Torbay' }],
        } as any)
        .mockResolvedValueOnce({
          rows: [{ id: 'log-1', outreach_property_id: 'prop-torbay-1', campaign_key: '2026_Q2_Torbay' }],
        } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any) // upsertQuarterStatus: SELECT
        .mockResolvedValueOnce({ rows: [] } as any); // upsertQuarterStatus: UPSERT

      const request = new Request('http://localhost:3000/api/admin/outreach/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_ids: ['prop-torbay-1'],
          campaign_key: '2026_Q2_Fairview Heights',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const insertCall = mockQuery.mock.calls[1];
      expect(insertCall[0]).toContain('INSERT INTO outreach_send_logs');
      expect(insertCall[1]?.[3]).toBe('2026_Q2_Torbay');

      const updateCall = mockQuery.mock.calls[2];
      expect(updateCall[0]).toContain('UPDATE outreach_properties');
      expect(updateCall[1]?.[0]).toBe('2026_Q2_Torbay');
    });

    it('upserts quarter status without writing the generated quarter_key column', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: { email: 'nzlouis.com@gmail.com' },
      } as any);

      const mockQuery = vi.mocked(marieDB.query)
        .mockResolvedValueOnce({
          rows: [{ id: 'prop-1', suburb: 'Oteha' }],
        } as any)
        .mockResolvedValueOnce({
          rows: [{ id: 'log-1', outreach_property_id: 'prop-1', campaign_key: '2026_Q3_Oteha' }],
        } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [{ id: 'report-3' }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const request = new Request('http://localhost:3000/api/admin/outreach/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_ids: ['prop-1'],
          campaign_key: '2026_Q3_Oteha',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const reportLookup = mockQuery.mock.calls[3];
      expect(reportLookup[0]).toContain('SELECT id FROM suburb_reports');
      expect(reportLookup[1]).toEqual(['Oteha', 'Q3', 2026]);

      const upsertCall = mockQuery.mock.calls[4];
      expect(upsertCall[0]).toContain('INSERT INTO outreach_property_quarter_status');
      expect(upsertCall[0]).not.toContain('quarter_key,');
      expect(upsertCall[0]).not.toContain('VALUES ($1, $2, $3, $4, $5, $6,');
      expect(upsertCall[1]).toEqual(['prop-1', 'report-3', 'Oteha', 'Q3', 2026, '2026_Q3_Oteha']);
    });

    it('refreshes quarter materialized views directly without the incremental function', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: { email: 'nzlouis.com@gmail.com' },
      } as any);

      const mockQuery = vi.mocked(marieDB.query)
        .mockResolvedValueOnce({
          rows: [{ id: 'prop-1', suburb: 'Oteha' }],
        } as any)
        .mockResolvedValueOnce({
          rows: [{ id: 'log-1', outreach_property_id: 'prop-1', campaign_key: '2026_Q2_Oteha' }],
        } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const request = new Request('http://localhost:3000/api/admin/outreach/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_ids: ['prop-1'],
          campaign_key: '2026_Q2_Oteha',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const statements = mockQuery.mock.calls.map(c => String(c[0]));
      expect(statements).toContain('REFRESH MATERIALIZED VIEW mv_suburb_quarter_summary');
      expect(statements).toContain('REFRESH MATERIALIZED VIEW mv_quarter_overview');
      expect(statements).toContain('REFRESH MATERIALIZED VIEW mv_dispatch_timeline');
      expect(statements.some(s => s.includes('refresh_quarter_mv_incremental'))).toBe(false);
    });
  });

  describe('GET /api/admin/outreach/[id]/history', () => {
    it('returns dispatch history for given property id', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: { email: 'nzlouis.com@gmail.com' },
      } as any);

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

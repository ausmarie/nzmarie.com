import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockQuery = vi.hoisted(() => vi.fn());
const mockAuth = vi.hoisted(() => vi.fn());
const mockIsAdmin = vi.hoisted(() => vi.fn());

vi.mock('@/lib/db', () => ({
  marieDB: { query: mockQuery },
}));

vi.mock('@/lib/auth', () => ({
  auth: mockAuth,
}));

vi.mock('@/lib/permissions', () => ({
  isAdmin: mockIsAdmin,
}));

import { GET } from '../../../app/api/admin/leads/[id]/send-history/route';

function sendHistoryRequest(id: string) {
  return new Request(`http://localhost/api/admin/leads/${id}/send-history`, {
    method: 'GET',
  });
}

describe('GET /api/admin/leads/[id]/send-history', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { email: 'admin@test.com' } });
    mockIsAdmin.mockReturnValue(true);
  });

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue({ user: null });
    const res = await GET(sendHistoryRequest('lead-1'), { params: Promise.resolve({ id: 'lead-1' }) });
    expect(res.status).toBe(401);
  });

  it('returns 401 when not admin', async () => {
    mockIsAdmin.mockReturnValue(false);
    const res = await GET(sendHistoryRequest('lead-1'), { params: Promise.resolve({ id: 'lead-1' }) });
    expect(res.status).toBe(401);
  });

  it('returns 404 when lead not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await GET(sendHistoryRequest('lead-1'), { params: Promise.resolve({ id: 'lead-1' }) });
    expect(res.status).toBe(404);
  });

  it('returns empty history when no matching outreach properties', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ property_address: '1 Main St', suburb: 'Torbay', source_outreach_id: null }] })
      .mockResolvedValueOnce({ rows: [] });
    const res = await GET(sendHistoryRequest('lead-1'), { params: Promise.resolve({ id: 'lead-1' }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.history).toEqual([]);
  });

  it('fetches send history via source_outreach_id', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ property_address: '1 Main St', suburb: 'Torbay', source_outreach_id: 'out-1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'out-1' }] })
      .mockResolvedValueOnce({
        rows: [
          {
            log_id: 'log-1',
            outreach_property_id: 'out-1',
            suburb_report_id: 'sr-1',
            report_title: 'Q2 Market Report – Torbay',
            campaign_key: '2026_Q2_Torbay',
            suburb: 'Torbay',
            sent_at: '2026-05-15T10:00:00Z',
            sent_by: 'admin@test.com',
            notes: null,
            pdf_file_url: 'https://example.com/report.pdf',
            pdf_file_name: 'report.pdf',
            scan_count: 5,
          },
        ],
      });

    const res = await GET(sendHistoryRequest('lead-1'), { params: Promise.resolve({ id: 'lead-1' }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.history).toHaveLength(1);
    expect(json.history[0].report_title).toBe('Q2 Market Report – Torbay');
    expect(json.history[0].scan_count).toBe(5);
  });

  it('fetches send history via address/suburb match when no source_outreach_id', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ property_address: '1 Main St', suburb: 'Torbay', source_outreach_id: null }] })
      .mockResolvedValueOnce({ rows: [{ id: 'out-1' }, { id: 'out-2' }] })
      .mockResolvedValueOnce({
        rows: [
          {
            log_id: 'log-2',
            outreach_property_id: 'out-2',
            suburb_report_id: 'sr-2',
            report_title: 'Q3 Market Report – Torbay',
            campaign_key: '2026_Q3_Torbay',
            suburb: 'Torbay',
            sent_at: '2026-08-15T10:00:00Z',
            sent_by: 'admin@test.com',
            notes: 'Follow up',
            pdf_file_url: null,
            pdf_file_name: null,
            scan_count: 0,
          },
          {
            log_id: 'log-1',
            outreach_property_id: 'out-1',
            suburb_report_id: 'sr-1',
            report_title: 'Q2 Market Report – Torbay',
            campaign_key: '2026_Q2_Torbay',
            suburb: 'Torbay',
            sent_at: '2026-05-15T10:00:00Z',
            sent_by: 'admin@test.com',
            notes: null,
            pdf_file_url: 'https://example.com/report.pdf',
            pdf_file_name: 'report.pdf',
            scan_count: 5,
          },
        ],
      });

    const res = await GET(sendHistoryRequest('lead-1'), { params: Promise.resolve({ id: 'lead-1' }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.history).toHaveLength(2);
    // Should be ordered by sent_at DESC (Q3 first, then Q2)
    expect(json.history[0].campaign_key).toBe('2026_Q3_Torbay');
    expect(json.history[1].campaign_key).toBe('2026_Q2_Torbay');
  });

  it('matches a full appraisal address to outreach by street and suburb', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{
          property_address: '4 Carnmore Place, Torbay, Auckland 0630',
          property_id: null,
          suburb: 'Torbay',
          source_outreach_id: null,
        }],
      })
      .mockResolvedValueOnce({ rows: [{ id: 'out-1' }] })
      .mockResolvedValueOnce({ rows: [{ log_id: 'log-1', report_title: 'Torbay 2026-Q3 Market Report' }] });

    const res = await GET(sendHistoryRequest('lead-1'), { params: Promise.resolve({ id: 'lead-1' }) });
    expect(res.status).toBe(200);

    const addressMatchCall = mockQuery.mock.calls.find(([sql]) =>
      String(sql).includes('FROM outreach_properties')
    );
    expect(addressMatchCall?.[1]).toEqual([
      null,
      null,
      '4 Carnmore Place, Torbay, Auckland 0630',
      'Torbay',
      null,
      null,
    ]);

    const json = await res.json();
    expect(json.history).toHaveLength(1);
    expect(json.history[0].report_title).toBe('Torbay 2026-Q3 Market Report');
  });

  it('uses the Properties record to bridge to outreach history', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{
          property_address: '4 Carnmore Pl., Torbay, Auckland 0630',
          property_id: 'property-uuid',
          suburb: 'Torbay',
          source_outreach_id: null,
          property_record_address: '4 Carnmore Place',
          property_record_suburb: 'Torbay',
        }],
      })
      .mockResolvedValueOnce({ rows: [{ id: 'out-1' }] })
      .mockResolvedValueOnce({ rows: [{ log_id: 'log-1', report_title: 'Torbay 2026-Q3 Market Report' }] });

    const res = await GET(sendHistoryRequest('lead-1'), { params: Promise.resolve({ id: 'lead-1' }) });
    expect(res.status).toBe(200);

    const matchCall = mockQuery.mock.calls.find(([sql]) =>
      String(sql).includes('FROM outreach_properties')
    );
    expect(String(matchCall?.[0])).toContain('FROM properties p');
    expect(String(matchCall?.[0])).toContain('property_matches');
    expect(String(matchCall?.[0])).toContain("'[^[:alnum:]/]'");
    expect(matchCall?.[1]).toEqual([
      null,
      'property-uuid',
      '4 Carnmore Pl., Torbay, Auckland 0630',
      'Torbay',
      '4 Carnmore Place',
      'Torbay',
    ]);

    const json = await res.json();
    expect(json.history).toHaveLength(1);
  });

  it('deduplicates outreach_property_ids from source_outreach_id and address match', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ property_address: '1 Main St', suburb: 'Torbay', source_outreach_id: 'out-1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'out-1' }] }) // same ID from address match
      .mockResolvedValueOnce({ rows: [] });

    const res = await GET(sendHistoryRequest('lead-1'), { params: Promise.resolve({ id: 'lead-1' }) });
    expect(res.status).toBe(200);
    // Should only query once for out-1 (deduplicated)
    const historyQueryCall = mockQuery.mock.calls.find(([sql]) => String(sql).includes('outreach_send_logs'));
    expect(historyQueryCall).toBeTruthy();
    if (!historyQueryCall) throw new Error('Expected send history query');
    expect(historyQueryCall[1]).toEqual(['out-1']);
  });
});
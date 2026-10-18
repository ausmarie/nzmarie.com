import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockQuery = vi.hoisted(() => vi.fn());

vi.mock('@/lib/db', () => ({
  query: mockQuery,
}));

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({ user: { email: 'admin@example.com' } }),
}));

vi.mock('@/lib/permissions', () => ({
  isAdmin: vi.fn(() => true),
}));

import { GET, POST } from '../../../app/api/admin/reports/documents/route';

describe('report documents — lead reports support', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  describe('GET with lead_id filter', () => {
    it('filters documents by lead_id when provided', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const request = new Request('http://localhost:3000/api/admin/reports/documents?lead_id=lead-123');
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(mockQuery).toHaveBeenCalledTimes(1);
      const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('rd.lead_id = $1');
      expect(params).toEqual(['lead-123']);
    });

    it('excludes lead-generated documents when lead_id is not provided', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const request = new Request('http://localhost:3000/api/admin/reports/documents');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const [sql] = mockQuery.mock.calls[0] as [string];
      expect(sql).toContain('rd.lead_id IS NULL');
      expect(sql).not.toContain('rd.lead_id = ');
    });

    it('combines lead_id with other filters', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const request = new Request('http://localhost:3000/api/admin/reports/documents?lead_id=lead-9&type=general');
      await GET(request);

      const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('rd.doc_type = $1');
      expect(sql).toContain('rd.lead_id = $2');
      expect(params).toEqual(['general', 'lead-9']);
    });

    it('still excludes lead documents when other filters are combined', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const request = new Request('http://localhost:3000/api/admin/reports/documents?type=general&quarter=2026-Q3');
      await GET(request);

      const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('rd.doc_type = $1');
      expect(sql).toContain('rd.quarter = $2');
      expect(sql).toContain('rd.lead_id IS NULL');
      expect(params).toEqual(['general', '2026-Q3']);
    });
  });

  describe('POST with lead_id', () => {
    it('inserts lead_id when provided', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 'user-1' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'doc-1' }] });

      const request = new Request('http://localhost:3000/api/admin/reports/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doc_type: 'general',
          title: 'Property Report — 249 Sunset Road',
          lead_id: 'lead-123',
        }),
      });
      const response = await POST(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.id).toBe('doc-1');

      const [insertSql, insertParams] = mockQuery.mock.calls[1] as [string, unknown[]];
      expect(insertSql).toContain('lead_id');
      expect(insertParams).toContain('lead-123');
    });

    it('inserts null lead_id when not provided', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 'user-1' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'doc-2' }] });

      const request = new Request('http://localhost:3000/api/admin/reports/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doc_type: 'general', title: 'Untitled suburb doc' }),
      });
      const response = await POST(request);

      expect(response.status).toBe(200);
      const [, insertParams] = mockQuery.mock.calls[1] as [string, unknown[]];
      expect(insertParams[7]).toBeNull();
    });
  });
});

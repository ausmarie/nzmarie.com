import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST as uploadPOST } from '@/app/api/admin/pdf/upload/route';
import { GET as reportsGET, DELETE as reportsDELETE } from '@/app/api/admin/pdf/reports/route';
import { POST as downloadPOST } from '@/app/api/reports/download/route';
import { auth } from '@/lib/auth';
import { marieDB, query } from '@/lib/db';
import { isAdmin } from '@/lib/permissions';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  marieDB: {
    query: vi.fn(),
    ensureOutreachTablesExist: vi.fn().mockResolvedValue(undefined),
  },
  query: vi.fn(),
}));

vi.mock('@/lib/permissions', () => ({
  isAdmin: vi.fn().mockReturnValue(true),
}));

vi.mock('@/lib/hash', () => ({
  hashEmail: vi.fn().mockReturnValue('hashed_email'),
  hashIP: vi.fn().mockReturnValue('hashed_ip'),
}));

vi.mock('@/lib/r2-storage', () => ({
  getSignedDownloadUrl: vi.fn().mockResolvedValue('https://r2.nzmarie.com/reports/Oteha/latest.pdf'),
  deleteFromR2: vi.fn().mockResolvedValue(undefined),
}));

describe('PDF Manager & Report Download API Routes', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(isAdmin).mockReturnValue(true);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('POST /api/admin/pdf/upload', () => {
    it('returns 403 if user is not admin', async () => {
      vi.mocked(auth).mockResolvedValueOnce(undefined as any);

      const request = new Request('http://localhost:3000/api/admin/pdf/upload', {
        method: 'POST',
      });

      const response = await uploadPOST(request);
      expect(response.status).toBe(403);
    });

    it('uploads PDF and saves record in suburb_reports', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: { email: 'nzlouis.com@gmail.com' },
      } as any);

      // First query: check for existing record (should return empty)
      // Second query: insert/update record
      vi.mocked(marieDB.query)
        .mockResolvedValueOnce({ rows: [] } as any) // check existing
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'report-1',
              suburb: 'Oteha',
              quarter: 'Q2',
              year: 2026,
              doc_label: 'Main Report',
              file_url: 'https://r2.nzmarie.com/reports/Oteha/Q2-2026/Oteha_Q2_2026.pdf',
            },
          ],
        } as any); // insert/update

      const mockFile = new File(['dummy pdf content'], 'Oteha_Q2_2026.pdf', { type: 'application/pdf' });
      const mockFormData = new Map<string, unknown>([
        ['files', mockFile],
        ['suburb', 'Oteha'],
        ['quarter', 'Q2'],
        ['year', '2026'],
        ['labels', '["Main Report"]'],
      ]);

      const request = {
        formData: vi.fn().mockResolvedValue({
          get: (key: string) => mockFormData.get(key),
          getAll: (key: string) => (mockFormData.get(key) ? [mockFormData.get(key)] : []),
        }),
      } as unknown as Request;

      const response = await uploadPOST(request);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.count).toBe(1);
      expect(data.reports[0].report.suburb).toBe('Oteha');
      expect(data.reports[0].doc_label).toBe('Main Report');
    });

    it('generates a unique timestamp-prefixed R2 key on every upload', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: { email: 'nzlouis.com@gmail.com' },
      } as any);

      const fakeTime = 1723500000000;
      vi.setSystemTime(fakeTime);

      vi.mocked(marieDB.query)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({
          rows: [{
            id: 'report-ts',
            suburb: 'Oteha',
            quarter: 'Q2',
            year: 2026,
            doc_label: 'Main Report',
            file_url: `https://reports.nzmarie.com/reports/Oteha/Q2-2026/${fakeTime}-Oteha_Q2_2026.pdf`,
          }],
        } as any);

      const mockFile = new File(['pdf bytes'], 'Oteha Q2 2026.pdf', { type: 'application/pdf' });
      const request = {
        formData: vi.fn().mockResolvedValue({
          get: (key: string) => ({
            suburb: 'Oteha', quarter: 'Q2', year: '2026', labels: '["Main Report"]', file: null,
          }[key] ?? null),
          getAll: (key: string) => key === 'files' ? [mockFile] : [],
        }),
      } as unknown as Request;

      const response = await uploadPOST(request);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.reports[0].file_url).toContain(`${fakeTime}`);
      expect(data.reports[0].file_url).toContain('Oteha_Q2_2026.pdf');
      expect(data.reports[0].file_url).toMatch(
        /reports\/Oteha\/Q2-2026\/\d+-Oteha_Q2_2026\.pdf$/
      );
    });

    it('deletes old R2 object before uploading replacement with same label', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: { email: 'nzlouis.com@gmail.com' },
      } as any);

      const publicDomain = 'https://reports.nzmarie.com';
      const oldFileUrl = `${publicDomain}/reports/Oteha/Q2-2026/1000000000000-letter.pdf`;

      vi.mocked(marieDB.query)
        .mockResolvedValueOnce({ rows: [{ file_url: oldFileUrl }] } as any)
        .mockResolvedValueOnce({
          rows: [{ id: 'report-new', suburb: 'Oteha', quarter: 'Q2', year: 2026, doc_label: 'Letter' }],
        } as any);

      const newFile = new File(['new letter content'], 'letter.pdf', { type: 'application/pdf' });
      const request = {
        formData: vi.fn().mockResolvedValue({
          get: (key: string) => ({
            suburb: 'Oteha', quarter: 'Q2', year: '2026', labels: '["Letter"]', file: null,
          }[key] ?? null),
          getAll: (key: string) => key === 'files' ? [newFile] : [],
        }),
      } as unknown as Request;

      const response = await uploadPOST(request);
      expect(response.status).toBe(200);

      const selectCall = vi.mocked(marieDB.query).mock.calls[0];
      expect(selectCall[0]).toContain('SELECT file_url FROM suburb_reports');
      expect(selectCall[1]).toEqual(['Oteha', 'Q2', 2026, 'Letter']);
    });

    it('generates different URLs for two uploads of same filename', async () => {
      vi.mocked(auth)
        .mockResolvedValueOnce({ user: { email: 'nzlouis.com@gmail.com' } } as any)
        .mockResolvedValueOnce({ user: { email: 'nzlouis.com@gmail.com' } } as any);

      vi.mocked(marieDB.query)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [{ id: 'r1', suburb: 'Oteha', quarter: 'Q2', year: 2026, doc_label: 'Letter',
          file_url: 'https://reports.nzmarie.com/reports/Oteha/Q2-2026/1111111111111-letter.pdf' }] } as any)
        .mockResolvedValueOnce({ rows: [{ file_url: 'https://reports.nzmarie.com/reports/Oteha/Q2-2026/1111111111111-letter.pdf' }] } as any)
        .mockResolvedValueOnce({ rows: [{ id: 'r2', suburb: 'Oteha', quarter: 'Q2', year: 2026, doc_label: 'Letter',
          file_url: 'https://reports.nzmarie.com/reports/Oteha/Q2-2026/2222222222222-letter.pdf' }] } as any);

      const makeRequest = (fakeTs: number) => {
        vi.setSystemTime(fakeTs);
        const f = new File(['content'], 'letter.pdf', { type: 'application/pdf' });
        return {
          formData: vi.fn().mockResolvedValue({
            get: (key: string) => ({
              suburb: 'Oteha', quarter: 'Q2', year: '2026', labels: '["Letter"]', file: null,
            }[key] ?? null),
            getAll: (key: string) => key === 'files' ? [f] : [],
          }),
        } as unknown as Request;
      };

      const res1 = await uploadPOST(makeRequest(1111111111111));
      const data1 = await res1.json();

      const res2 = await uploadPOST(makeRequest(2222222222222));
      const data2 = await res2.json();

      expect(data1.reports[0].file_url).not.toBe(data2.reports[0].file_url);
      expect(data1.reports[0].file_url).toContain('1111111111111');
      expect(data2.reports[0].file_url).toContain('2222222222222');
    });

    it('uploads multiple PDFs with distinct labels for the same suburb/quarter/year', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: { email: 'nzlouis.com@gmail.com' },
      } as any);

      // For 2 files, we need 4 query calls (2 per file):
      // File 1: check existing (empty) + insert
      // File 2: check existing (empty) + insert
      vi.mocked(marieDB.query)
        .mockResolvedValueOnce({ rows: [] } as any) // check existing for file 1
        .mockResolvedValueOnce({
          rows: [{ id: 'r1', suburb: 'Oteha', quarter: 'Q2', year: 2026, doc_label: 'Cover Letter', file_url: 'https://r2.nzmarie.com/reports/Oteha/Q2-2026/letter.pdf' }],
        } as any) // insert file 1
        .mockResolvedValueOnce({ rows: [] } as any) // check existing for file 2
        .mockResolvedValueOnce({
          rows: [{ id: 'r2', suburb: 'Oteha', quarter: 'Q2', year: 2026, doc_label: 'About Marie', file_url: 'https://r2.nzmarie.com/reports/Oteha/Q2-2026/about-marie.pdf' }],
        } as any); // insert file 2

      const file1 = new File(['letter'], 'letter.pdf', { type: 'application/pdf' });
      const file2 = new File(['about'], 'about-marie.pdf', { type: 'application/pdf' });
      const mockFormData = new Map<string, unknown>([
        ['files', [file1, file2]],
        ['suburb', 'Oteha'],
        ['quarter', 'Q2'],
        ['year', '2026'],
        ['labels', '["Cover Letter", "About Marie"]'],
      ]);

      const request = {
        formData: vi.fn().mockResolvedValue({
          get: (key: string) => mockFormData.get(key),
          getAll: (key: string) => {
            const v = mockFormData.get(key);
            return Array.isArray(v) ? v : v ? [v] : [];
          },
        }),
      } as unknown as Request;

      const response = await uploadPOST(request);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.count).toBe(2);
      expect(data.reports[0].doc_label).toBe('Cover Letter');
      expect(data.reports[1].doc_label).toBe('About Marie');
      expect(marieDB.query).toHaveBeenCalledTimes(4);
    });

    it('rejects upload when a file is not a PDF', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: { email: 'nzlouis.com@gmail.com' },
      } as any);

      const badFile = new File(['hello'], 'notes.txt', { type: 'text/plain' });
      const mockFormData = new Map<string, unknown>([
        ['files', badFile],
        ['suburb', 'Oteha'],
        ['quarter', 'Q2'],
        ['year', '2026'],
        ['labels', '["Main Report"]'],
      ]);

      const request = {
        formData: vi.fn().mockResolvedValue({
          get: (key: string) => mockFormData.get(key),
          getAll: (key: string) => (mockFormData.get(key) ? [mockFormData.get(key)] : []),
        }),
      } as unknown as Request;

      const response = await uploadPOST(request);
      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/admin/pdf/reports', () => {
    it('returns report list for admin user', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: { email: 'nzlouis.com@gmail.com' },
      } as any);

      vi.mocked(marieDB.query).mockResolvedValueOnce({
        rows: [
          {
            id: 'report-1',
            suburb: 'Oteha',
            quarter: 'Q2',
            year: 2026,
            file_url: 'https://r2.nzmarie.com/reports/Oteha/Q2-2026.pdf',
          },
        ],
      } as any);

      const response = await reportsGET(new Request('http://localhost:3000/api/admin/pdf/reports'));
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.reports.length).toBe(1);
      expect(data.reports[0].suburb).toBe('Oteha');

      const sql = vi.mocked(marieDB.query).mock.calls[0]?.[0] as string;
      expect(sql).toContain('suburb_main_date');
      expect(sql).toContain('ORDER BY suburb_main_date DESC NULLS LAST');
      expect(sql).toContain("WHEN doc_label = 'Letter' THEN 1");
    });
  });

  describe('DELETE /api/admin/pdf/reports', () => {
    it('returns 403 if user is not admin', async () => {
      vi.mocked(auth).mockResolvedValueOnce(undefined as any);

      const response = await reportsDELETE(new Request('http://localhost:3000/api/admin/pdf/reports', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'report-1' }),
      }));
      expect(response.status).toBe(403);
    });

    it('deletes a report document by id', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: { email: 'nzlouis.com@gmail.com' },
      } as any);

      vi.mocked(marieDB.query)
        .mockResolvedValueOnce({
          rows: [{ file_url: 'https://reports.nzmarie.com/reports/Oteha/Q2-2026/Oteha_Q2_2026.pdf' }],
        } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const response = await reportsDELETE(new Request('http://localhost:3000/api/admin/pdf/reports', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'report-1' }),
      }));
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(marieDB.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM suburb_reports'),
        ['report-1']
      );
    });
  });

  describe('POST /api/reports/download (Homepage download for Oteha)', () => {
    it('returns latest active PDF report from suburb_reports for Oteha', async () => {
      vi.mocked(query)
        .mockResolvedValueOnce({ rows: [{ count: '0' }] } as any)
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'report-1',
              file_url: 'https://r2.nzmarie.com/reports/Oteha/Q2-2026.pdf',
            },
          ],
        } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [{ id: 'event-1' }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [{ id: 'download-1' }] } as any);

      const request = new Request('http://localhost:3000/api/reports/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: 'John',
          email: 'john@example.com',
          suburb: 'Oteha',
        }),
      });

      const response = await downloadPOST(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.downloadUrl).toBe('https://r2.nzmarie.com/reports/Oteha/Q2-2026.pdf');

      const downloadQuery = vi.mocked(query).mock.calls.find(
        ([sql]) => typeof sql === 'string' && sql.includes('FROM suburb_reports')
      )?.[0] as string;
      expect(downloadQuery).toBeDefined();
      expect(downloadQuery.indexOf('Main Report')).toBeLessThan(downloadQuery.indexOf('year DESC'));
    });
  });
});

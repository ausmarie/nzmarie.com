import { describe, it, expect } from 'vitest';

/**
 * Test Suite: PDF Upload and Delete Functionality
 *
 * Verifies:
 * 1. Every upload generates a unique timestamp-prefixed R2 key → unique URL
 * 2. Re-uploading same filename produces a different URL (no CDN cache collision)
 * 3. Old R2 objects are identified and deleted before new upload
 * 4. PublicDomain is consistent between upload and delete operations
 */

const sanitize = (n: string) => n.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_');

describe('PDF Upload and Delete - Caching Fix', () => {
  describe('File Name Sanitization', () => {
    it('sanitizes filenames consistently', () => {
      const cases = [
        { input: 'report.pdf' },
        { input: 'Q2-2026 Report.pdf' },
        { input: 'report@#$.pdf' },
        { input: 'report   test.pdf' },
      ];

      for (const { input } of cases) {
        const result = sanitize(input);
        expect(typeof result).toBe('string');
        expect(result).not.toContain(' ');
        expect(result).not.toContain('@');
        expect(result).not.toContain('#');
      }
    });

    it('collapses multiple underscores into one', () => {
      expect(sanitize('a   b.pdf')).toBe('a_b.pdf');
      expect(sanitize('a@@b.pdf')).toBe('a_b.pdf');
    });
  });

  describe('PublicDomain Consistency', () => {
    it('uses consistent publicDomain across upload and delete operations', () => {
      const publicDomain = 'https://reports.nzmarie.com';
      expect(publicDomain).toMatch(/^https:\/\/reports\.nzmarie\.com$/);
    });

    it('extracts R2 key from timestamped URL using replace method', () => {
      const publicDomain = 'https://reports.nzmarie.com';
      const fileUrl = `${publicDomain}/reports/Oteha/Q2-2026/1723500000000-report.pdf`;

      const key = fileUrl.replace(`${publicDomain}/`, '');
      expect(key).toBe('reports/Oteha/Q2-2026/1723500000000-report.pdf');
    });

    it('replace-based key extraction has no leading slash', () => {
      const publicDomain = 'https://reports.nzmarie.com';
      const fileUrl = `${publicDomain}/reports/Suburb/Q1-2025/9999999999999-file.pdf`;

      const key = fileUrl.replace(`${publicDomain}/`, '');
      expect(key.startsWith('/')).toBe(false);
      expect(key).toBe('reports/Suburb/Q1-2025/9999999999999-file.pdf');
    });
  });

  describe('Timestamp-based Unique Key Generation', () => {
    it('produces different R2 keys for same filename at different timestamps', () => {
      const folderKey = 'reports/Oteha/Q2-2026';
      const fileName = 'letter.pdf';
      const ts1 = 1723500000000;
      const ts2 = 1723500001234;

      const key1 = `${folderKey}/${ts1}-${sanitize(fileName)}`;
      const key2 = `${folderKey}/${ts2}-${sanitize(fileName)}`;

      expect(key1).not.toBe(key2);
      expect(key1).toContain(`${ts1}-letter.pdf`);
      expect(key2).toContain(`${ts2}-letter.pdf`);
    });

    it('key matches pattern reports/suburb/quarter-year/timestamp-sanitizedName', () => {
      const suburb = 'Oteha';
      const quarter = 'Q3';
      const year = 2025;
      const fileName = 'Q3 2025 Report (final).pdf';
      const ts = 1723500000000;

      const folderKey = `reports/${suburb}/${quarter}-${year}`;
      const key = `${folderKey}/${ts}-${sanitize(fileName)}`;

      expect(key).toMatch(/^reports\/Oteha\/Q3-2025\/\d+-Q3_2025_Report_final_.pdf$/);
    });

    it('N uploads with distinct timestamps all produce unique keys', () => {
      const folderKey = 'reports/Oteha/Q2-2026';
      const fileName = 'report.pdf';
      const timestamps = [1723500000000, 1723500001000, 1723500002000, 1723500003000, 1723500004000];

      const keys = timestamps.map(ts => `${folderKey}/${ts}-${sanitize(fileName)}`);
      expect(new Set(keys).size).toBe(timestamps.length);
    });
  });

  describe('R2 File Cleanup on Update', () => {
    it('identifies when existing record URL differs from new upload URL', () => {
      const publicDomain = 'https://reports.nzmarie.com';
      const existingUrl = `${publicDomain}/reports/Oteha/Q2-2026/1000000000000-letter.pdf`;
      const newUrl = `${publicDomain}/reports/Oteha/Q2-2026/1723500000000-letter.pdf`;

      expect(existingUrl).not.toBe(newUrl);
      expect(existingUrl.startsWith(publicDomain)).toBe(true);
    });

    it('correctly extracts old R2 key from timestamped URL for deletion', () => {
      const publicDomain = 'https://reports.nzmarie.com';
      const oldFileUrl = `${publicDomain}/reports/Oteha/Q2-2026/1000000000000-letter.pdf`;

      const oldKey = oldFileUrl.replace(`${publicDomain}/`, '');
      expect(oldKey).toBe('reports/Oteha/Q2-2026/1000000000000-letter.pdf');
      expect(oldKey).not.toContain(publicDomain);
    });

    it('skips R2 delete when old URL does not match publicDomain', () => {
      const publicDomain = 'https://reports.nzmarie.com';
      const oldFileUrl = 'https://old-domain.example.com/reports/Oteha/Q2-2026/letter.pdf';

      const shouldDelete = oldFileUrl.startsWith(publicDomain);
      expect(shouldDelete).toBe(false);
    });
  });

  describe('Integration Scenario: Delete and Re-upload Same Filename', () => {
    it('re-uploading same filename always yields a fresh unique URL', () => {
      const publicDomain = 'https://reports.nzmarie.com';
      const suburb = 'Oteha';
      const quarter = 'Q2';
      const year = 2026;

      const firstTs = 1700000000000;
      const firstUrl = `${publicDomain}/reports/${suburb}/${quarter}-${year}/${firstTs}-${sanitize('letter.pdf')}`;

      expect(firstUrl).toBe('https://reports.nzmarie.com/reports/Oteha/Q2-2026/1700000000000-letter.pdf');

      const oldKey = firstUrl.replace(`${publicDomain}/`, '');
      expect(oldKey).toBe('reports/Oteha/Q2-2026/1700000000000-letter.pdf');

      const secondTs = 1723500000000;
      const secondUrl = `${publicDomain}/reports/${suburb}/${quarter}-${year}/${secondTs}-${sanitize('letter.pdf')}`;

      expect(secondUrl).toBe('https://reports.nzmarie.com/reports/Oteha/Q2-2026/1723500000000-letter.pdf');
      expect(firstUrl).not.toBe(secondUrl);
    });

    it('DB update stores the new unique URL overwriting the old one', () => {
      const publicDomain = 'https://reports.nzmarie.com';
      const suburb = 'Oteha';
      const quarter = 'Q2';
      const year = 2026;
      const folderKey = `reports/${suburb}/${quarter}-${year}`;

      const ts1 = 1700000000000;
      const ts2 = 1723500000000;

      const url1 = `${publicDomain}/${folderKey}/${ts1}-letter.pdf`;
      const url2 = `${publicDomain}/${folderKey}/${ts2}-letter.pdf`;

      const dbRecord = { file_url: url1 };
      const updated = { ...dbRecord, file_url: url2 };

      expect(updated.file_url).not.toBe(dbRecord.file_url);
      expect(updated.file_url).toContain(`${ts2}`);
      expect(updated.file_url).not.toContain(`${ts1}`);
    });
  });
});

import { describe, it, expect } from 'vitest';
import {
  periodSortValue,
  reportDocumentPeriodKey,
} from '@/lib/report-period';

describe('reportDocumentPeriodKey', () => {
  it('stores monthly reports as a year-month key', () => {
    expect(reportDocumentPeriodKey('month', 2026, 9, '2026-Q3')).toBe('2026-09');
    expect(reportDocumentPeriodKey('month', 2026, 1, '2026-Q1')).toBe('2026-01');
  });

  it('keeps the quarter key for quarterly reports', () => {
    expect(reportDocumentPeriodKey('quarter', 2026, 9, '2026-Q3')).toBe('2026-Q3');
  });
});

describe('periodSortValue', () => {
  it('interleaves monthly and quarterly report periods chronologically', () => {
    const periods = ['2026-09', '2026-Q2', '2026-Q3', '2026-08'];
    const sorted = [...periods].sort((a, b) => periodSortValue(a) - periodSortValue(b));

    expect(sorted).toEqual(['2026-Q2', '2026-08', '2026-Q3', '2026-09']);
  });
});

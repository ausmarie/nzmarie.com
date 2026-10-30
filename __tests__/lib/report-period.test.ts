import { describe, it, expect } from 'vitest';
import {
  campaignHasReportPeriod,
  campaignMatchesPeriod,
  latestPeriodKey,
  periodSortValue,
  reportDocumentPeriodKey,
} from '@/lib/report-period';

describe('campaignHasReportPeriod', () => {
  it('recognizes report campaign keys across quarters and months', () => {
    expect(campaignHasReportPeriod('2026_Q3_Torbay')).toBe(true);
    expect(campaignHasReportPeriod('2025-M09-Albany')).toBe(true);
    expect(campaignHasReportPeriod('2024_12_Browns Bay')).toBe(true);
  });

  it('rejects campaigns without a valid report period', () => {
    expect(campaignHasReportPeriod('favorites')).toBe(false);
    expect(campaignHasReportPeriod('2026_Q5_Torbay')).toBe(false);
    expect(campaignHasReportPeriod('2026_M13_Torbay')).toBe(false);
    expect(campaignHasReportPeriod(null)).toBe(false);
  });
});

describe('reportDocumentPeriodKey', () => {
  it('stores monthly reports as a year-month key', () => {
    expect(reportDocumentPeriodKey('month', 2026, 9, '2026-Q3')).toBe('2026-09');
    expect(reportDocumentPeriodKey('month', 2026, 1, '2026-Q1')).toBe('2026-01');
  });

  it('keeps the quarter key for quarterly reports', () => {
    expect(reportDocumentPeriodKey('quarter', 2026, 9, '2026-Q3')).toBe('2026-Q3');
  });
});

describe('campaignMatchesPeriod', () => {
  it('matches campaign keys that belong to the requested quarter', () => {
    expect(campaignMatchesPeriod('2026_Q3_Torbay', '2026-Q3')).toBe(true);
    expect(campaignMatchesPeriod('2026-Q3', '2026-Q3')).toBe(true);
    expect(campaignMatchesPeriod('2026_Q3_Report', '2026-Q3')).toBe(true);
  });

  it('rejects junk from other quarters or non-report campaigns', () => {
    expect(campaignMatchesPeriod('2026_Q2_Torbay', '2026-Q3')).toBe(false);
    expect(campaignMatchesPeriod('2025_Q3_Torbay', '2026-Q3')).toBe(false);
    expect(campaignMatchesPeriod('favorites', '2026-Q3')).toBe(false);
    expect(campaignMatchesPeriod('', '2026-Q3')).toBe(false);
  });

  it('handles monthly report periods', () => {
    expect(campaignMatchesPeriod('2026_M09_Torbay', '2026-09')).toBe(true);
    expect(campaignMatchesPeriod('2026-09', '2026-09')).toBe(true);
    expect(campaignMatchesPeriod('2026_M08_Torbay', '2026-09')).toBe(false);
  });
});

describe('periodSortValue', () => {
  it('interleaves monthly and quarterly report periods chronologically', () => {
    const periods = ['2026-09', '2026-Q2', '2026-Q3', '2026-08'];
    const sorted = [...periods].sort((a, b) => periodSortValue(a) - periodSortValue(b));

    expect(sorted).toEqual(['2026-Q2', '2026-08', '2026-Q3', '2026-09']);
  });
});

describe('latestPeriodKey', () => {
  it('picks the newest report period across quarters and years', () => {
    expect(latestPeriodKey(['2026-Q2', '2026-Q3', '2027-Q1', null, undefined])).toBe('2027-Q1');
    expect(latestPeriodKey(['2026-Q4', '2027-Q3', '2026-Q3'])).toBe('2027-Q3');
  });

  it('normalizes separators and ignores invalid values', () => {
    expect(latestPeriodKey(['2026_Q3', 'favorites', '', null])).toBe('2026-Q3');
    expect(latestPeriodKey(['favorites', null])).toBeNull();
  });
});

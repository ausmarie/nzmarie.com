import { describe, it, expect } from 'vitest';
import {
  ANALYTICS_RANGE_OPTIONS,
  DEFAULT_ANALYTICS_RANGE,
  analyticsRangeStartMonth,
  analyticsRangeStartYear,
  filterByAnalyticsRange,
  type AnalyticsRange,
} from '@/lib/analytics-range';

const now = new Date(2026, 9, 20);

describe('analytics range options', () => {
  it('exposes the expected labels and keeps 2 years as the default', () => {
    expect(ANALYTICS_RANGE_OPTIONS.map((option) => option.label)).toEqual([
      'This year',
      '2 years',
      '3 years',
      '5 years',
      '5 years+',
    ]);
    expect(DEFAULT_ANALYTICS_RANGE).toBe('2y');
  });
});

describe('analyticsRangeStartYear', () => {
  it('maps each range to the first calendar year it includes', () => {
    const expected: Record<AnalyticsRange, number> = {
      'this-year': 2026,
      '2y': 2025,
      '3y': 2024,
      '5y': 2022,
      '5y+': 1900,
    };
    for (const [range, year] of Object.entries(expected)) {
      expect(analyticsRangeStartYear(range as AnalyticsRange, now)).toBe(year);
    }
  });

  it('formats the start as a month key', () => {
    expect(analyticsRangeStartMonth('2y', now)).toBe('2025-01');
    expect(analyticsRangeStartMonth('5y+', now)).toBe('1900-01');
  });
});

describe('filterByAnalyticsRange', () => {
  const monthly = [
    { period: '2019-12' },
    { period: '2020-01' },
    { period: '2024-05' },
    { period: '2025-01' },
    { period: '2026-01' },
    { period: '2026-09' },
  ];

  it('filters monthly rows by calendar year', () => {
    expect(filterByAnalyticsRange(monthly, 'this-year', now).map((row) => row.period)).toEqual([
      '2026-01',
      '2026-09',
    ]);
    expect(filterByAnalyticsRange(monthly, '2y', now).map((row) => row.period)).toEqual([
      '2025-01',
      '2026-01',
      '2026-09',
    ]);
    expect(filterByAnalyticsRange(monthly, '3y', now).map((row) => row.period)).toEqual([
      '2024-05',
      '2025-01',
      '2026-01',
      '2026-09',
    ]);
    expect(filterByAnalyticsRange(monthly, '5y', now).map((row) => row.period)).toEqual([
      '2024-05',
      '2025-01',
      '2026-01',
      '2026-09',
    ]);
    expect(filterByAnalyticsRange(monthly, '5y+', now)).toHaveLength(6);
  });

  it('filters quarterly rows by calendar year', () => {
    const quarterly = [
      { period: '2019-Q4' },
      { period: '2024-Q1' },
      { period: '2025-Q1' },
      { period: '2026-Q3' },
    ];
    expect(filterByAnalyticsRange(quarterly, '2y', now).map((row) => row.period)).toEqual([
      '2025-Q1',
      '2026-Q3',
    ]);
    expect(filterByAnalyticsRange(quarterly, '5y+', now)).toHaveLength(4);
  });

  it('drops rows without a valid period year', () => {
    expect(filterByAnalyticsRange([{ period: 'unknown' }], '5y+', now)).toEqual([]);
  });
});

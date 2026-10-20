export type AnalyticsRange = 'this-year' | '2y' | '3y' | '5y' | '5y+';

export const ANALYTICS_RANGE_OPTIONS: { value: AnalyticsRange; label: string }[] = [
  { value: 'this-year', label: 'This year' },
  { value: '2y', label: '2 years' },
  { value: '3y', label: '3 years' },
  { value: '5y', label: '5 years' },
  { value: '5y+', label: '5 years+' },
];

export const DEFAULT_ANALYTICS_RANGE: AnalyticsRange = '2y';

export const ANALYTICS_ALL_DATA_FROM = '1900-01-01';
export const ANALYTICS_ALL_DATA_TO = '2999-12-31';

export function analyticsRangeStartYear(range: AnalyticsRange, now: Date = new Date()): number {
  const year = now.getFullYear();
  switch (range) {
    case 'this-year':
      return year;
    case '2y':
      return year - 1;
    case '3y':
      return year - 2;
    case '5y':
      return year - 4;
    case '5y+':
      return 1900;
  }
}

export function analyticsRangeStartMonth(range: AnalyticsRange, now: Date = new Date()): string {
  return `${analyticsRangeStartYear(range, now)}-01`;
}

export function filterByAnalyticsRange<T extends { period: string }>(
  data: T[],
  range: AnalyticsRange,
  now: Date = new Date()
): T[] {
  const startYear = analyticsRangeStartYear(range, now);
  return data.filter((item) => {
    const year = Number(item.period.slice(0, 4));
    return Number.isFinite(year) && year >= startYear;
  });
}

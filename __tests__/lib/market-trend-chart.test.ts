import { describe, it, expect } from 'vitest';
import {
  buildMarketTrendRows,
  marketTrendChartMinWidth,
  MIN_CHART_WIDTH,
  MONTHLY_POINT_WIDTH,
  QUARTERLY_POINT_WIDTH,
  districtSeriesKey,
  type TrendChartSourcePoint,
} from '@/lib/market-trend-chart';

function point(
  period: string,
  cityMedian: number | null,
  suburbs: Record<string, number | null> = {},
  districts?: Record<string, number | null>,
): TrendChartSourcePoint {
  const detail: TrendChartSourcePoint['suburbs'] = {};
  for (const [name, median] of Object.entries(suburbs)) {
    detail[name] = { median };
  }
  const districtDetails = districts && Object.fromEntries(
    Object.entries(districts).map(([name, median]) => [name, { median }]),
  );
  return { period, cityMedian, suburbs: detail, districts: districtDetails };
}

describe('buildMarketTrendRows', () => {
  it('adds the year to every January label in monthly mode', () => {
    const rows = buildMarketTrendRows(
      [
        point('2025-01', 1000000, { Torbay: 1100000 }),
        point('2025-02', 1000000, { Torbay: 1200000 }),
        point('2025-12', 1000000, { Torbay: 1150000 }),
        point('2026-01', 1050000, { Torbay: 1250000 }),
        point('2026-02', 1050000, { Torbay: 1300000 }),
      ],
      ['Torbay'],
      'monthly'
    );

    expect(rows.map((row) => row._label)).toEqual([
      '2025 Jan',
      'Feb',
      'Dec',
      '2026 Jan',
      'Feb',
    ]);
    expect(rows.map((row) => row._period)).toEqual([
      '2025 Jan',
      '2025 Feb',
      '2025 Dec',
      '2026 Jan',
      '2026 Feb',
    ]);
    expect(rows[0].Torbay).toBe(1100000);
    expect(rows[3].Torbay).toBe(1250000);
  });

  it('shows the year on the first available month when January is missing', () => {
    const rows = buildMarketTrendRows(
      [
        point('2025-03', 1000000),
        point('2025-04', 1000000),
        point('2026-02', 1050000),
      ],
      [],
      'monthly'
    );

    expect(rows.map((row) => row._label)).toEqual([
      '2025 Mar',
      'Apr',
      '2026 Feb',
    ]);
  });

  it('keeps quarterly labels as the period key', () => {
    const rows = buildMarketTrendRows(
      [
        point('2025-Q1', 1000000, { Torbay: 1100000 }),
        point('2025-Q2', 1000000, { Torbay: 1200000 }),
      ],
      ['Torbay'],
      'quarterly'
    );

    expect(rows.map((row) => row._label)).toEqual(['2025-Q1', '2025-Q2']);
    expect(rows.map((row) => row._period)).toEqual(['2025-Q1', '2025-Q2']);
    expect(rows[1].Torbay).toBe(1200000);
  });

  it('creates independent series for both regions and does not substitute the primary district', () => {
    const rows = buildMarketTrendRows(
      [
        point('2026-01', 1200000, {}, {
          'North Shore City': 1200000,
          'Auckland Region': 1500000,
        }),
        point('2026-02', 1510000, {}, {
          'Auckland Region': 1510000,
        }),
      ],
      [],
      'monthly',
      ['Auckland Region', 'North Shore City'],
    );

    expect(rows[0][districtSeriesKey('Auckland Region')]).toBe(1500000);
    expect(rows[0][districtSeriesKey('North Shore City')]).toBe(1200000);
    expect(rows[1][districtSeriesKey('Auckland Region')]).toBe(1510000);
    expect(rows[1][districtSeriesKey('North Shore City')]).toBeUndefined();
  });
});

describe('marketTrendChartMinWidth', () => {
  it('keeps a minimum width for short ranges', () => {
    expect(marketTrendChartMinWidth(2, 'monthly')).toBe(MIN_CHART_WIDTH);
    expect(marketTrendChartMinWidth(1, 'quarterly')).toBe(MIN_CHART_WIDTH);
  });

  it('grows with the number of monthly points so the chart can scroll', () => {
    expect(marketTrendChartMinWidth(24, 'monthly')).toBe(24 * MONTHLY_POINT_WIDTH);
    expect(marketTrendChartMinWidth(60, 'monthly')).toBe(60 * MONTHLY_POINT_WIDTH);
  });

  it('uses a wider step for quarterly points', () => {
    expect(marketTrendChartMinWidth(8, 'quarterly')).toBe(8 * QUARTERLY_POINT_WIDTH);
  });
});

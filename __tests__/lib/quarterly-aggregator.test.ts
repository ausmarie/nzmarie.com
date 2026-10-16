import { describe, it, expect } from 'vitest';
import { aggregateToQuarterly } from '../../lib/quarterly-aggregator';
import type { MonthlyDataPoint } from '../../lib/market-data-aggregator';

function makeMonthly(
  period: string,
  suburbMedians: Record<string, number | null>,
  suburbSales: Record<string, number>,
  suburbDays: Record<string, number | null>,
  cityMedian: number | null = null,
  citySales = 0,
  cityDays: number | null = null
): MonthlyDataPoint {
  const suburbs: MonthlyDataPoint['suburbs'] = {};
  for (const [name, median] of Object.entries(suburbMedians)) {
    suburbs[name] = {
      median,
      sales: suburbSales[name] ?? 0,
      days: suburbDays[name] ?? null,
    };
  }
  return {
    period,
    periodRaw: period + '-01',
    cityMedian,
    citySales,
    cityDays,
    cityDetail: null,
    suburbs,
  };
}

describe('aggregateToQuarterly', () => {
  it('groups monthly data into Q1, Q2', () => {
    const monthly = [
      makeMonthly('2025-01', { Oteha: 1000000 }, { Oteha: 10 }, { Oteha: 30 }, 900000, 50, 35),
      makeMonthly('2025-02', { Oteha: 1100000 }, { Oteha: 12 }, { Oteha: 28 }, 920000, 55, 33),
      makeMonthly('2025-03', { Oteha: 1050000 }, { Oteha: 8 }, { Oteha: 32 }, 910000, 45, 34),
      makeMonthly('2025-04', { Oteha: 1200000 }, { Oteha: 15 }, { Oteha: 25 }, 950000, 60, 30),
    ];

    const result = aggregateToQuarterly(monthly);

    expect(result).toHaveLength(2);
    expect(result[0].period).toBe('2025-Q1');
    expect(result[1].period).toBe('2025-Q2');
  });

  it('averages medians and days, sums sales across quarter', () => {
    const monthly = [
      makeMonthly('2025-01', { Oteha: 1000000 }, { Oteha: 10 }, { Oteha: 30 }, 900000, 50, 35),
      makeMonthly('2025-02', { Oteha: 1100000 }, { Oteha: 12 }, { Oteha: 28 }, 920000, 55, 33),
      makeMonthly('2025-03', { Oteha: 1050000 }, { Oteha: 8 }, { Oteha: 32 }, 910000, 45, 34),
    ];

    const result = aggregateToQuarterly(monthly);

    expect(result[0].suburbs['Oteha'].median).toBe(1050000);
    expect(result[0].suburbs['Oteha'].sales).toBe(30);
    expect(result[0].suburbs['Oteha'].days).toBe(30);
    expect(result[0].cityMedian).toBe(910000);
    expect(result[0].citySales).toBe(150);
    expect(result[0].cityDays).toBe(34);
  });

  it('handles null values (Low Vol.)', () => {
    const monthly = [
      makeMonthly('2025-01', { Oteha: null }, { Oteha: 5 }, { Oteha: null }, null, 20, null),
      makeMonthly('2025-02', { Oteha: 1000000 }, { Oteha: 10 }, { Oteha: 30 }, 900000, 30, 35),
      makeMonthly('2025-03', { Oteha: null }, { Oteha: 0 }, { Oteha: null }, null, 0, null),
    ];

    const result = aggregateToQuarterly(monthly);

    expect(result[0].suburbs['Oteha'].median).toBe(1000000);
    expect(result[0].suburbs['Oteha'].sales).toBe(15);
    expect(result[0].suburbs['Oteha'].days).toBe(30);
    expect(result[0].cityMedian).toBe(900000);
    expect(result[0].cityDays).toBe(35);
  });

  it('returns empty array for empty input', () => {
    const result = aggregateToQuarterly([]);
    expect(result).toEqual([]);
  });

  it('handles single month', () => {
    const monthly = [
      makeMonthly('2025-06', { Oteha: 1000000 }, { Oteha: 5 }, { Oteha: 30 }, 900000, 25, 32),
    ];

    const result = aggregateToQuarterly(monthly);

    expect(result).toHaveLength(1);
    expect(result[0].period).toBe('2025-Q2');
    expect(result[0].suburbs['Oteha'].median).toBe(1000000);
    expect(result[0].suburbs['Oteha'].sales).toBe(5);
  });

  it('aggregates multiple suburbs', () => {
    const monthly = [
      makeMonthly('2025-01', { Oteha: 1000000, Albany: 900000 }, { Oteha: 10, Albany: 8 }, { Oteha: 30, Albany: 28 }),
      makeMonthly('2025-02', { Oteha: 1100000, Albany: 950000 }, { Oteha: 12, Albany: 10 }, { Oteha: 28, Albany: 26 }),
    ];

    const result = aggregateToQuarterly(monthly);

    expect(result[0].suburbs['Oteha'].median).toBe(1050000);
    expect(result[0].suburbs['Albany'].median).toBe(925000);
    expect(result[0].suburbs['Albany'].sales).toBe(18);
  });

  it('sums total volume and computes QoQ from quarterly medians', () => {
    const monthly = [
      makeMonthly('2025-01', { Oteha: 1000000 }, { Oteha: 10 }, { Oteha: 30 }, 900000, 50, 35),
      makeMonthly('2025-02', { Oteha: 1100000 }, { Oteha: 12 }, { Oteha: 28 }, 920000, 55, 33),
      makeMonthly('2025-04', { Oteha: 1200000 }, { Oteha: 15 }, { Oteha: 25 }, 950000, 60, 30),
    ];
    monthly[0].suburbs['Oteha'].totalVolume = 2000000;
    monthly[0].cityDetail = { median: 900000, sales: 50, days: 35 };
    monthly[2].suburbs['Oteha'].totalVolume = 3000000;
    monthly[2].cityDetail = { median: 950000, sales: 60, days: 30 };

    const result = aggregateToQuarterly(monthly);

    const q1 = result.find(r => r.period === '2025-Q1')!;
    const q2 = result.find(r => r.period === '2025-Q2')!;
    // Q1 2025 has no previous quarter in range → QoQ is null (no misleading average).
    expect(q1.suburbs['Oteha'].priceDiffMomPct).toBeNull();
    // Q2 vs Q1: (1200000 - 1050000) / 1050000 = +14.29%
    expect(q1.suburbs['Oteha'].median).toBe(1050000);
    expect(q2.suburbs['Oteha'].priceDiffMomPct).toBe(14.29);
    expect(q2.suburbs['Oteha'].totalVolume).toBe(3000000);
    // District detail follows the same QoQ rule: (950000 - 900000) / 900000 = +5.56%
    expect(q2.cityDetail?.priceDiffMomPct).toBe(5.56);
  });

  it('computes YoY from quarterly medians across years', () => {
    const monthly = [
      makeMonthly('2025-04', { Oteha: 1000000 }, { Oteha: 10 }, { Oteha: 30 }),
      makeMonthly('2026-04', { Oteha: 1100000 }, { Oteha: 12 }, { Oteha: 28 }),
    ];
    monthly[0].suburbs['Oteha'].priceDiff1yrPct = 5.0;

    const result = aggregateToQuarterly(monthly);

    const q2025 = result.find(r => r.period === '2025-Q2')!;
    const q2026 = result.find(r => r.period === '2026-Q2')!;
    // No prior-year quarter in range → falls back to the monthly-average value.
    expect(q2025.suburbs['Oteha'].priceDiff1yrPct).toBe(5.0);
    // (1100000 - 1000000) / 1000000 = +10%
    expect(q2026.suburbs['Oteha'].priceDiff1yrPct).toBe(10);
  });

  it('crosses years for QoQ when Q1 follows Q4', () => {
    const monthly = [
      makeMonthly('2025-10', { Oteha: 1000000 }, { Oteha: 10 }, { Oteha: 30 }),
      makeMonthly('2026-01', { Oteha: 1010000 }, { Oteha: 10 }, { Oteha: 30 }),
    ];

    const result = aggregateToQuarterly(monthly);

    const q1 = result.find(r => r.period === '2026-Q1')!;
    // (1010000 - 1000000) / 1000000 = +1%
    expect(q1.suburbs['Oteha'].priceDiffMomPct).toBe(1);
  });

  it('sorts quarters chronologically', () => {
    const monthly = [
      makeMonthly('2025-04', { Oteha: 1000000 }, { Oteha: 5 }, { Oteha: 30 }),
      makeMonthly('2025-01', { Oteha: 900000 }, { Oteha: 10 }, { Oteha: 35 }),
    ];

    const result = aggregateToQuarterly(monthly);

    expect(result[0].period).toBe('2025-Q1');
    expect(result[1].period).toBe('2025-Q2');
  });
});

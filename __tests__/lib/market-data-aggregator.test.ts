import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/db', () => ({
  query: vi.fn(),
}));

import { query } from '../../lib/db';
import { getQuarterlyComparison, getMonthlyData } from '../../lib/market-data-aggregator';

const SUBURBS = ['Northcross', 'Torbay'];
const DISTRICT = 'North Shore City';
const FROM = '2025-01-01';
const TO = '2026-12-31';

describe('getQuarterlyComparison', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads Auckland Region quarterly rows with the legacy-name fallback', async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        { region_name: 'Auckland', year: '2025', quarter: '3', median: '1300000', sales: '90', days: '48' },
        { region_name: 'Auckland Region', year: '2025', quarter: '3', median: '1500000', sales: '100', days: '45' },
      ],
    } as any);

    const result = await getQuarterlyComparison([], 'Auckland Region', FROM, TO);

    expect(result[0]).toMatchObject({ cityMedian: 1500000, citySales: 100, cityDays: 45 });
    expect(vi.mocked(query).mock.calls[0][1]).toEqual([
      [],
      ['North Shore City', 'Auckland Region', 'Auckland'],
      FROM,
      TO,
    ]);
  });

  it('returns quarterly data when SQL aggregation succeeds with string year/quarter from CockroachDB', async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        { region_name: 'Northcross', year: '2025', quarter: '3', median: '1092750', sales: '12', days: '50' },
        { region_name: 'Torbay', year: '2025', quarter: '3', median: '1144667', sales: '73', days: '50' },
        { region_name: 'Northcross', year: '2025', quarter: '4', median: '1405000', sales: '7', days: '31' },
        { region_name: 'Torbay', year: '2025', quarter: '4', median: '1150667', sales: '78', days: '36' },
      ],
    } as any);

    const result = await getQuarterlyComparison(SUBURBS, DISTRICT, FROM, TO);

    expect(result).toHaveLength(2);
    expect(result[0].period).toBe('2025-Q3');
    expect(result[1].period).toBe('2025-Q4');
    expect(result[0].suburbs['Northcross']?.median).toBe(1092750);
    expect(result[0].suburbs['Torbay']?.median).toBe(1144667);
    expect(result[1].suburbs['Northcross']?.median).toBe(1405000);
    expect(result[1].suburbs['Torbay']?.median).toBe(1150667);
  });

  it('includes district data when district rows are present', async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        { region_name: 'Torbay', year: '2025', quarter: '3', median: '1150000', sales: '23', days: '31' },
        { region_name: 'North Shore City', year: '2025', quarter: '3', median: '1200000', sales: '96', days: '35' },
      ],
    } as any);

    const result = await getQuarterlyComparison(['Torbay'], DISTRICT, FROM, TO);

    expect(result).toHaveLength(1);
    expect(result[0].cityMedian).toBe(1200000);
    expect(result[0].citySales).toBe(96);
    expect(result[0].cityDays).toBe(35);
    expect(result[0].suburbs['Torbay']?.median).toBe(1150000);
  });

  it('returns both district series for direct comparison', async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        { region_name: 'North Shore City', year: '2025', quarter: '3', median: '1200000', sales: '96', days: '35' },
        { region_name: 'Auckland Region', year: '2025', quarter: '3', median: '1500000', sales: '150', days: '42' },
      ],
    } as any);

    const result = await getQuarterlyComparison([], DISTRICT, FROM, TO);

    expect(result[0].districts).toEqual({
      'North Shore City': { median: 1200000, sales: 96, days: 35 },
      'Auckland Region': { median: 1500000, sales: 150, days: 42 },
    });
    expect(result[0]).toMatchObject({ cityMedian: 1200000, citySales: 96, cityDays: 35 });
  });

  it('returns suburbs even without district data', async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        { region_name: 'Northcross', year: '2025', quarter: '3', median: '950000', sales: '8', days: '40' },
      ],
    } as any);

    const result = await getQuarterlyComparison(['Northcross'], DISTRICT, FROM, TO);

    expect(result).toHaveLength(1);
    expect(result[0].cityMedian).toBeNull();
    expect(result[0].suburbs['Northcross']?.median).toBe(950000);
  });

  it('falls back to JS aggregation when SQL fails', async () => {
    vi.mocked(query)
      .mockRejectedValueOnce(new Error('SQL error'))
      .mockResolvedValueOnce({
        rows: [
          { region_name: 'Northcross', period_month: '2025-07-01', median_price: 1100000, sales_count: 4, days_to_sell: 45 },
          { region_name: 'Northcross', period_month: '2025-08-01', median_price: 1050000, sales_count: 5, days_to_sell: 55 },
          { region_name: 'Northcross', period_month: '2025-09-01', median_price: 1120000, sales_count: 3, days_to_sell: 50 },
        ],
      } as any);

    const result = await getQuarterlyComparison(['Northcross'], DISTRICT, FROM, TO);

    expect(result).toHaveLength(1);
    expect(result[0].period).toBe('2025-Q3');
    expect(result[0].suburbs['Northcross']?.median).toBe(1090000);
    expect(result[0].suburbs['Northcross']?.sales).toBe(12);
    expect(result[0].suburbs['Northcross']?.days).toBe(50);
  });

  it('returns empty array when both paths fail', async () => {
    vi.mocked(query)
      .mockRejectedValueOnce(new Error('SQL error'))
      .mockRejectedValueOnce(new Error('JS fallback error'));

    const result = await getQuarterlyComparison(SUBURBS, DISTRICT, FROM, TO);

    expect(result).toEqual([]);
  });

  it('handles null median and days in SQL results', async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        { region_name: 'Northcross', year: '2025', quarter: '3', median: null, sales: '0', days: null },
      ],
    } as any);

    const result = await getQuarterlyComparison(['Northcross'], DISTRICT, FROM, TO);

    expect(result).toHaveLength(1);
    expect(result[0].suburbs['Northcross']?.median).toBeNull();
    expect(result[0].suburbs['Northcross']?.sales).toBe(0);
    expect(result[0].suburbs['Northcross']?.days).toBeNull();
  });
});

describe('getMonthlyData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns merged monthly data for multiple suburbs', async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        { region_name: 'Northcross', period_month: '2025-07-01', median_price: 1100000, sales_count: 4, days_to_sell: 45 },
        { region_name: 'Torbay', period_month: '2025-07-01', median_price: 1150000, sales_count: 8, days_to_sell: 30 },
        { region_name: 'Northcross', period_month: '2025-08-01', median_price: 1050000, sales_count: 5, days_to_sell: 55 },
      ],
    } as any);

    const result = await getMonthlyData(['Northcross', 'Torbay'], DISTRICT, FROM, TO);

    expect(result).toHaveLength(2);
    expect(result[0].period).toBe('2025-07');
    expect(result[0].suburbs['Northcross']?.median).toBe(1100000);
    expect(result[0].suburbs['Torbay']?.median).toBe(1150000);
    expect(result[1].suburbs['Northcross']?.median).toBe(1050000);
    expect(result[1].suburbs['Torbay']).toBeUndefined();
  });

  it('includes district data in monthly results', async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        { region_name: 'Torbay', period_month: '2025-07-01', median_price: 1150000, sales_count: 8, days_to_sell: 30 },
        { region_name: 'North Shore City', period_month: '2025-07-01', median_price: 1200000, sales_count: 100, days_to_sell: 35 },
      ],
    } as any);

    const result = await getMonthlyData(['Torbay'], DISTRICT, FROM, TO);

    expect(result).toHaveLength(1);
    expect(result[0].cityMedian).toBe(1200000);
    expect(result[0].citySales).toBe(100);
    expect(result[0].cityDays).toBe(35);
  });

  it('uses Auckland Region data and prefers it over legacy Auckland rows', async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        { region_name: 'Auckland', period_month: '2025-07-01', median_price: 1300000, sales_count: 90, days_to_sell: 48 },
        { region_name: 'Auckland Region', period_month: '2025-07-01', median_price: 1500000, sales_count: 100, days_to_sell: 45 },
      ],
    } as any);

    const result = await getMonthlyData([], 'Auckland Region', FROM, TO);

    expect(result[0]).toMatchObject({ cityMedian: 1500000, citySales: 100, cityDays: 45 });
    expect(vi.mocked(query).mock.calls[0][1]).toEqual([
      [],
      ['North Shore City', 'Auckland Region', 'Auckland'],
      FROM,
      TO,
    ]);
  });

  it('returns both district series while preserving the requested primary district fields', async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        { region_name: 'North Shore City', period_month: '2025-07-01', median_price: 1200000, sales_count: 100, days_to_sell: 35 },
        { region_name: 'Auckland Region', period_month: '2025-07-01', median_price: 1500000, sales_count: 150, days_to_sell: 42 },
      ],
    } as any);

    const result = await getMonthlyData([], 'Auckland Region', FROM, TO);

    expect(result[0].cityMedian).toBe(1500000);
    expect(result[0].districts).toMatchObject({
      'North Shore City': { median: 1200000, sales: 100, days: 35 },
      'Auckland Region': { median: 1500000, sales: 150, days: 42 },
    });
  });

  it('returns empty array when no data found', async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [] } as any);

    const result = await getMonthlyData(SUBURBS, DISTRICT, FROM, TO);

    expect(result).toEqual([]);
  });

  it('returns empty array on database error', async () => {
    vi.mocked(query).mockRejectedValueOnce(new Error('DB error'));

    const result = await getMonthlyData(SUBURBS, DISTRICT, FROM, TO);

    expect(result).toEqual([]);
  });

  it('sorts results by period ascending', async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        { region_name: 'Northcross', period_month: '2025-09-01', median_price: 1120000, sales_count: 3, days_to_sell: 50 },
        { region_name: 'Northcross', period_month: '2025-07-01', median_price: 1100000, sales_count: 4, days_to_sell: 45 },
        { region_name: 'Northcross', period_month: '2025-08-01', median_price: 1050000, sales_count: 5, days_to_sell: 55 },
      ],
    } as any);

    const result = await getMonthlyData(['Northcross'], DISTRICT, FROM, TO);

    expect(result).toHaveLength(3);
    expect(result[0].period).toBe('2025-07');
    expect(result[1].period).toBe('2025-08');
    expect(result[2].period).toBe('2025-09');
  });
});

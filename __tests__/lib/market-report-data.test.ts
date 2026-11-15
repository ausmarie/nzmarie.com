import { describe, expect, it } from 'vitest';
import {
  buildMarketReportSnapshot,
  getDefaultMarketReportDataRange,
  getMarketReportComparisonLabel,
  getMarketReportWindow,
  isValidMarketReportPeriod,
  type MarketReportSourceRow,
} from '@/lib/market-report-data';

const rows: MarketReportSourceRow[] = [
  { period_month: '2025-11-01', median_price: '1000000', sales_count: '20', days_to_sell: '40' },
  { period_month: '2025-12-01', median_price: '1100000', sales_count: '30', days_to_sell: '50' },
  { period_month: '2026-01-01', median_price: null, sales_count: '10', days_to_sell: null },
];

describe('market report data', () => {
  it('builds monthly KPI cards and twelve-point charts with explicit gaps', () => {
    const snapshot = buildMarketReportSnapshot('monthly', '2026-01', rows, '2026-02-01T00:00:00.000Z');

    expect(snapshot.periodLabel).toBe('January 2026');
    expect(snapshot.metrics).toEqual({ medianPrice: null, salesCount: 10, daysToSell: null });
    expect(snapshot.charts.medianPrice).toHaveLength(12);
    expect(snapshot.charts.medianPrice.at(-1)).toMatchObject({ period: '2026-01', medianPrice: null });
    expect(snapshot.charts.salesCount.at(-1)).toMatchObject({ period: '2026-01', salesCount: 10 });
  });

  it('sums quarterly sales and averages available monthly median/days values', () => {
    const snapshot = buildMarketReportSnapshot('quarterly', '2025-Q4', rows);

    expect(snapshot.periodLabel).toBe('Q4 2025');
    expect(snapshot.metrics).toEqual({ medianPrice: 1050000, salesCount: 50, daysToSell: 45 });
    expect(snapshot.charts.salesCount).toHaveLength(8);
    expect(snapshot.dataNotes).toContain('average available monthly median prices');
  });

  it('builds Auckland Region KPI card values for the same quarterly period', () => {
    const snapshot = buildMarketReportSnapshot('quarterly', '2025-Q4', [
      { region_name: 'North Shore City', period_month: '2025-10-01', median_price: '1000000', sales_count: '20', days_to_sell: '40' },
      { region_name: 'North Shore City', period_month: '2025-11-01', median_price: '1100000', sales_count: '30', days_to_sell: '50' },
      { region_name: 'Auckland Region', period_month: '2025-10-01', median_price: '1500000', sales_count: '100', days_to_sell: '45' },
      { region_name: 'Auckland Region', period_month: '2025-11-01', median_price: '1600000', sales_count: '120', days_to_sell: '43' },
    ]);

    expect(snapshot.metrics).toEqual({ medianPrice: 1050000, salesCount: 50, daysToSell: 45 });
    expect(snapshot.districtMetrics).toEqual({
      medianPrice: 1550000,
      salesCount: 220,
      daysToSell: 44,
    });
  });

  it('builds date windows spanning year boundaries', () => {
    expect(getMarketReportWindow('monthly', '2026-01')).toEqual({
      from: '2025-02-01',
      to: '2026-02-01',
      startPeriodKey: '2025-02',
      endPeriodKey: '2026-01',
    });
    expect(getMarketReportWindow('quarterly', '2026-Q1')).toEqual({
      from: '2024-04-01',
      to: '2026-04-01',
      startPeriodKey: '2024-Q2',
      endPeriodKey: '2026-Q1',
    });
  });

  it('uses the selected data range for chart points and source query windows', () => {
    const dataRange = { startPeriodKey: '2025-Q4', endPeriodKey: '2026-Q1' };
    const snapshot = buildMarketReportSnapshot('quarterly', '2026-Q1', rows, '2026-02-01T00:00:00.000Z', {
      chartPeriodType: 'quarterly',
      dataRange,
    });

    expect(getDefaultMarketReportDataRange('quarterly', '2026-Q1')).toEqual({
      startPeriodKey: '2024-Q2',
      endPeriodKey: '2026-Q1',
    });
    expect(getMarketReportWindow('quarterly', '2026-Q1', 'quarterly', dataRange)).toMatchObject({
      from: '2025-10-01',
      to: '2026-04-01',
    });
    expect(snapshot.dataRange).toEqual(dataRange);
    expect(snapshot.charts.salesCount.map((point) => point.period)).toEqual(['2025-Q4', '2026-Q1']);
  });

  it('keeps KPI and line-chart periods independent while querying both ranges', () => {
    const snapshot = buildMarketReportSnapshot('quarterly', '2026-Q1', rows, undefined, {
      chartPeriodType: 'monthly',
      dataRange: { startPeriodKey: '2025-12', endPeriodKey: '2026-01' },
    });

    expect(snapshot.periodType).toBe('quarterly');
    expect(snapshot.chartPeriodType).toBe('monthly');
    expect(snapshot.metrics).toEqual({ medianPrice: null, salesCount: 10, daysToSell: null });
    expect(snapshot.charts.salesCount.map((point) => point.period)).toEqual(['2025-12', '2026-01']);
    expect(getMarketReportWindow(
      'quarterly',
      '2026-Q1',
      'monthly',
      { startPeriodKey: '2025-12', endPeriodKey: '2026-01' },
    )).toMatchObject({ from: '2025-10-01', to: '2026-04-01' });
  });

  it('includes the previous month for KPI comparisons even when charts start at the report month', () => {
    const octoberRows: MarketReportSourceRow[] = [
      { period_month: '2026-09-01', median_price: '1000000', sales_count: '285', days_to_sell: '50' },
      { period_month: '2026-10-01', median_price: '1130000', sales_count: '260', days_to_sell: '43' },
    ];
    const snapshot = buildMarketReportSnapshot('monthly', '2026-10', octoberRows, undefined, {
      chartPeriodType: 'monthly',
      dataRange: { startPeriodKey: '2026-10', endPeriodKey: '2026-10' },
    });

    expect(getMarketReportWindow(
      'monthly',
      '2026-10',
      'monthly',
      { startPeriodKey: '2026-10', endPeriodKey: '2026-10' },
    )).toMatchObject({ from: '2026-09-01', to: '2026-11-01' });
    expect(snapshot.comparison).toEqual({
      label: 'Compared to Previous Month (September)',
      medianPriceChange: '+13.0%',
      salesCountChange: '-8.8%',
      daysToSellChange: '-7',
    });
  });

  it('labels monthly and quarterly comparisons with the previous period and year when needed', () => {
    expect(getMarketReportComparisonLabel('monthly', '2026-10'))
      .toBe('Compared to Previous Month (September)');
    expect(getMarketReportComparisonLabel('monthly', '2026-01'))
      .toBe('Compared to Previous Month (December 2025)');
    expect(getMarketReportComparisonLabel('quarterly', '2026-Q2'))
      .toBe('Compared to Previous Quarter (Q1)');
    expect(getMarketReportComparisonLabel('quarterly', '2026-Q1'))
      .toBe('Compared to Previous Quarter (Q4 2025)');
  });

  it('keeps North Shore cards and adds Auckland Region chart comparison data', () => {
    const snapshot = buildMarketReportSnapshot('monthly', '2026-10', [
      { region_name: 'North Shore City', period_month: '2026-09-01', median_price: '1000000', sales_count: '20', days_to_sell: '40' },
      { region_name: 'North Shore City', period_month: '2026-10-01', median_price: '1100000', sales_count: '22', days_to_sell: '38' },
      { region_name: 'Auckland Region', period_month: '2026-09-01', median_price: '1500000', sales_count: '100', days_to_sell: '45' },
      { region_name: 'Auckland', period_month: '2026-09-01', median_price: '1400000', sales_count: '90', days_to_sell: '48' },
      { region_name: 'Auckland Region', period_month: '2026-10-01', median_price: '1600000', sales_count: '110', days_to_sell: '43' },
    ], undefined, {
      chartPeriodType: 'monthly',
      dataRange: { startPeriodKey: '2026-09', endPeriodKey: '2026-10' },
    });

    expect(snapshot.metrics).toEqual({ medianPrice: 1100000, salesCount: 22, daysToSell: 38 });
    expect(snapshot.districtMetrics).toEqual({
      medianPrice: 1600000,
      salesCount: 110,
      daysToSell: 43,
    });
    expect(snapshot.charts.medianPrice).toMatchObject([
      { period: '2026-09', medianPrice: 1000000, districtMedianPrice: 1500000 },
      { period: '2026-10', medianPrice: 1100000, districtMedianPrice: 1600000 },
    ]);
    expect(snapshot.charts.salesCount[0]).toMatchObject({ salesCount: 20, districtSalesCount: 100 });
    expect(snapshot.charts.daysToSell[0]).toMatchObject({ daysToSell: 40, districtDaysToSell: 45 });
  });

  it('rejects invalid period keys, reversed chart ranges, and missing selected-period data', () => {
    expect(isValidMarketReportPeriod('monthly', '2026-13')).toBe(false);
    expect(isValidMarketReportPeriod('quarterly', '2026-Q5')).toBe(false);
    expect(() => buildMarketReportSnapshot('monthly', '2026-02', rows)).toThrow(/No North Shore house market data/);
    expect(() => getMarketReportWindow('quarterly', '2026-Q1', 'quarterly', {
      startPeriodKey: '2026-Q4',
      endPeriodKey: '2026-Q2',
    })).toThrow(/must start before it ends/);
  });
});

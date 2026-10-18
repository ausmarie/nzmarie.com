import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  buildPeriodKeys,
  aggregateMetricSeries,
  renderMetricChartSvg,
  generateMetricChartImageUrl,
  type MetricRow,
} from '@/lib/report-charts';
import { query as marieQuery } from '@/lib/db';
import { uploadToR2 } from '@/lib/r2-storage';

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
}));

vi.mock('@/lib/r2-storage', () => ({
  isR2Mock: false,
  uploadToR2: vi.fn().mockResolvedValue('ok'),
}));

function row(region: string, period: string, opts: Partial<MetricRow> = {}): MetricRow {
  return {
    region_name: region,
    period_month: period,
    median_price: null,
    sales_count: null,
    days_to_sell: null,
    ...opts,
  };
}

describe('buildPeriodKeys', () => {
  it('builds continuous month keys for an inclusive month range', () => {
    expect(buildPeriodKeys('2025-07-01', '2026-07-01', 'month')).toEqual([
      '2025-07', '2025-08', '2025-09', '2025-10', '2025-11', '2025-12',
      '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06',
    ]);
  });

  it('collapses month ranges into unique quarter keys', () => {
    expect(buildPeriodKeys('2025-07-01', '2026-01-01', 'quarter')).toEqual([
      '2025-Q3', '2025-Q4',
    ]);
  });

  it('supports a single month range', () => {
    expect(buildPeriodKeys('2026-08-01', '2026-09-01', 'month')).toEqual(['2026-08']);
  });
});

describe('aggregateMetricSeries', () => {
  const rows: MetricRow[] = [
    row('Totara Vale', '2025-07-01', { sales_count: 5, median_price: 1000000, days_to_sell: 40 }),
    row('Totara Vale', '2025-08-01', { sales_count: 3, median_price: null, days_to_sell: 45 }),
    row('North Shore City', '2025-07-01', { sales_count: 300, median_price: 1200000, days_to_sell: 55 }),
    row('North Shore City', '2025-08-01', { sales_count: 280, median_price: 1180000, days_to_sell: 57 }),
  ];

  it('aggregates sales per month with suburb and district split', () => {
    const series = aggregateMetricSeries(rows, 'sales', 'month', 'Totara Vale', '2025-07-01', '2025-09-01');
    expect(series).toEqual([
      { period: '2025-07', sub: 5, dist: 300 },
      { period: '2025-08', sub: 3, dist: 280 },
    ]);
  });

  it('keeps null gaps when the suburb month has no metric value', () => {
    const series = aggregateMetricSeries(rows, 'median_price', 'month', 'Totara Vale', '2025-07-01', '2025-09-01');
    expect(series).toEqual([
      { period: '2025-07', sub: 1000000, dist: 1200000 },
      { period: '2025-08', sub: null, dist: 1180000 },
    ]);
  });

  it('sums sales and averages medians across months in a quarter', () => {
    const series = aggregateMetricSeries(rows, 'sales', 'quarter', 'Totara Vale', '2025-07-01', '2025-10-01');
    expect(series).toEqual([
      { period: '2025-Q3', sub: 8, dist: 580 },
    ]);

    const price = aggregateMetricSeries(rows, 'median_price', 'quarter', 'Totara Vale', '2025-07-01', '2025-10-01');
    expect(price).toEqual([
      { period: '2025-Q3', sub: 1000000, dist: 1190000 },
    ]);
  });

  it('treats district rows as the main series for a district suburb', () => {
    const series = aggregateMetricSeries(rows, 'sales', 'month', 'North Shore City', '2025-07-01', '2025-09-01');
    expect(series).toEqual([
      { period: '2025-07', sub: 300, dist: null },
      { period: '2025-08', sub: 280, dist: null },
    ]);
  });

  it('fills periods that have no rows at all with null points', () => {
    const series = aggregateMetricSeries(rows, 'sales', 'month', 'Totara Vale', '2025-06-01', '2025-09-01');
    expect(series).toEqual([
      { period: '2025-06', sub: null, dist: null },
      { period: '2025-07', sub: 5, dist: 300 },
      { period: '2025-08', sub: 3, dist: 280 },
    ]);
  });
});

describe('renderMetricChartSvg', () => {
  function labelValues(svg: string, anchor: 'end' | 'start'): number[] {
    const re = new RegExp(`text-anchor="${anchor}"[^>]*>([^<]+)<`, 'g');
    return [...svg.matchAll(re)].map((m) => Number(String(m[1]).replace(/[^0-9.]/g, '')));
  }

  function seriesDotYs(svg: string, radius: number): number[] {
    const re = new RegExp(`<circle cx="[\\d.]+" cy="([\\d.]+)" r="${radius}"`, 'g');
    return [...svg.matchAll(re)].map((m) => Number(m[1])).filter((y) => y <= 340);
  }

  const points = [
    { period: '2025-07', sub: 5, dist: 300 },
    { period: '2025-08', sub: 3, dist: 280 },
    { period: '2025-09', sub: 7, dist: 310 },
  ];

  it('titles the monthly sales chart like the reference chart', () => {
    const svg = renderMetricChartSvg('Totara Vale', 'sales', 'month', points);
    expect(svg).toContain('Number of Sales/Month in Totara Vale and North Shore City');
    expect(svg).toContain('>Totara Vale</text>');
    expect(svg).toContain('>North Shore</text>');
    expect(svg).toContain('Jul 25');
    expect(svg).toContain('Sep 25');
    expect(svg).not.toContain('Source: REINZ');
    expect(svg).toContain('Number of Sales');
  });

  it('labels the quarterly sales chart by quarter', () => {
    const svg = renderMetricChartSvg('Totara Vale', 'sales', 'quarter', [
      { period: '2025-Q3', sub: 8, dist: 580 },
      { period: '2025-Q4', sub: 6, dist: 540 },
    ]);
    expect(svg).toContain('Number of Sales/Quarter in Totara Vale and North Shore City');
    expect(svg).toContain('2025 Q3');
    expect(svg).toContain('2025 Q4');
  });

  it('titles the median price and days to sell charts', () => {
    const price = renderMetricChartSvg('Totara Vale', 'median_price', 'month', [
      { period: '2025-07', sub: 1000000, dist: 1200000 },
      { period: '2025-08', sub: 1100000, dist: 1180000 },
    ]);
    expect(price).toContain('Median Sale Price in Totara Vale and North Shore City');
    expect(price).toContain('Median Price (NZD)');

    const days = renderMetricChartSvg('Totara Vale', 'days_to_sell', 'month', [
      { period: '2025-07', sub: 40, dist: 55 },
      { period: '2025-08', sub: 45, dist: 57 },
    ]);
    expect(days).toContain('Median Days to Sell in Totara Vale and North Shore City');
    expect(days).toContain('Days to Sell');
  });

  it('plots median price on one shared axis so the real suburb/district gap is visible', () => {
    const svg = renderMetricChartSvg('Totara Vale', 'median_price', 'quarter', [
      { period: '2025-Q1', sub: 951000, dist: 1248000 },
      { period: '2025-Q2', sub: 898000, dist: 1163000 },
      { period: '2025-Q3', sub: 1003000, dist: 1165000 },
      { period: '2025-Q4', sub: 889000, dist: 1247000 },
    ]);

    expect(svg).not.toContain('text-anchor="start"');
    const ticks = labelValues(svg, 'end');
    expect(Math.min(...ticks)).toBeLessThanOrEqual(0.889);
    expect(Math.max(...ticks)).toBeGreaterThanOrEqual(1.248);

    const subYs = seriesDotYs(svg, 4.5);
    const distYs = seriesDotYs(svg, 3.5);
    expect(subYs).toHaveLength(4);
    expect(distYs).toHaveLength(4);
    distYs.forEach((y, i) => expect(y).toBeLessThan(subYs[i]));
  });

  it('plots days to sell on one shared axis', () => {
    const svg = renderMetricChartSvg('Totara Vale', 'days_to_sell', 'quarter', [
      { period: '2025-Q1', sub: 40, dist: 55 },
      { period: '2025-Q2', sub: 45, dist: 57 },
    ]);

    expect(svg).not.toContain('text-anchor="start"');
    const ticks = labelValues(svg, 'end');
    expect(Math.min(...ticks)).toBeLessThanOrEqual(40);
    expect(Math.max(...ticks)).toBeGreaterThanOrEqual(57);
  });

  it('keeps separate axes for sales where district volume dwarfs the suburb', () => {
    const svg = renderMetricChartSvg('Totara Vale', 'sales', 'quarter', [
      { period: '2025-Q3', sub: 8, dist: 580 },
      { period: '2025-Q4', sub: 6, dist: 540 },
    ]);

    expect(svg).toContain('text-anchor="start"');
    const subTicks = labelValues(svg, 'end');
    const distTicks = labelValues(svg, 'start');
    expect(subTicks.length).toBeGreaterThan(0);
    expect(distTicks.length).toBeGreaterThan(0);
    expect(Math.max(...subTicks)).toBeLessThan(Math.min(...distTicks));
  });

  it('drops the comparison suffix for a district chart', () => {
    const svg = renderMetricChartSvg('North Shore City', 'sales', 'month', [
      { period: '2025-07', sub: 300, dist: null },
      { period: '2025-08', sub: 280, dist: null },
    ]);
    expect(svg).toContain('Number of Sales/Month in North Shore');
    expect(svg).not.toContain('and North Shore City');
  });

  it('renders no district axis when the district has no values', () => {
    const svg = renderMetricChartSvg('Totara Vale', 'sales', 'month', [
      { period: '2025-07', sub: 5, dist: null },
      { period: '2025-08', sub: 3, dist: null },
    ]);
    expect(svg).not.toContain('North Shore</text>');
  });

  it('returns an empty string when there is no data at all', () => {
    expect(renderMetricChartSvg('Totara Vale', 'sales', 'month', [])).toBe('');
    expect(renderMetricChartSvg('Totara Vale', 'sales', 'month', [
      { period: '2025-07', sub: null, dist: null },
    ])).toBe('');
  });
});

describe('generateMetricChartImageUrl', () => {
  const originalDomain = process.env.R2_PUBLIC_DOMAIN;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.R2_PUBLIC_DOMAIN = 'https://cdn.test';
  });

  afterEach(() => {
    if (originalDomain === undefined) {
      delete process.env.R2_PUBLIC_DOMAIN;
    } else {
      process.env.R2_PUBLIC_DOMAIN = originalDomain;
    }
  });

  it('uploads the rendered chart and returns its public URL', async () => {
    vi.mocked(marieQuery).mockResolvedValue({
      rows: [
        row('Totara Vale', '2025-07-01', { sales_count: 5 }),
        row('Totara Vale', '2025-08-01', { sales_count: 3 }),
        row('North Shore City', '2025-07-01', { sales_count: 300 }),
        row('North Shore City', '2025-08-01', { sales_count: 280 }),
      ],
    } as any);

    const url = await generateMetricChartImageUrl('Totara Vale', 'sales', 'month', '2025-07-01', '2025-09-01');

    expect(marieQuery).toHaveBeenCalledTimes(1);
    const [sql, params] = vi.mocked(marieQuery).mock.calls[0];
    expect(sql).toContain('market_monthly_snapshots');
    expect(params).toEqual(['Totara Vale', '2025-07-01', '2025-09-01']);

    expect(uploadToR2).toHaveBeenCalledTimes(1);
    const [key, body, contentType] = vi.mocked(uploadToR2).mock.calls[0];
    expect(key).toBe('charts/totara-vale-sales-month-2025-07-01-to-2025-09-01.svg');
    expect(contentType).toBe('image/svg+xml');
    expect(String(body)).toContain('Number of Sales/Month in Totara Vale and North Shore City');

    expect(url).toContain('https://cdn.test/charts/totara-vale-sales-month-2025-07-01-to-2025-09-01.svg');
  });

  it('skips the query for an empty or inverted date range', async () => {
    expect(await generateMetricChartImageUrl('Totara Vale', 'sales', 'month', '', '2025-09-01')).toBeNull();
    expect(await generateMetricChartImageUrl('Totara Vale', 'sales', 'month', '2025-09-01', '2025-09-01')).toBeNull();
    expect(marieQuery).not.toHaveBeenCalled();
    expect(uploadToR2).not.toHaveBeenCalled();
  });

  it('returns null when the range has no renderable data', async () => {
    vi.mocked(marieQuery).mockResolvedValue({ rows: [] } as any);
    expect(await generateMetricChartImageUrl('Totara Vale', 'sales', 'month', '2025-07-01', '2025-09-01')).toBeNull();
    expect(uploadToR2).not.toHaveBeenCalled();
  });
});

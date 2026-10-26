import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/admin/reports/templates/generate/route';
import { auth } from '@/lib/auth';
import { query as marieQuery } from '@/lib/db';
import { getMonthlyData } from '@/lib/market-data-aggregator';
import { generateChartImageUrl, generateMetricChartImageUrl } from '@/lib/report-charts';
import { ensureLeadIntroduction } from '@/lib/lead-introduction-server';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/permissions', () => ({
  isAdmin: vi.fn().mockReturnValue(true),
}));

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
}));

vi.mock('@/lib/market-data-aggregator', () => ({
  getMonthlyData: vi.fn(),
}));

vi.mock('@/lib/report-charts', () => ({
  generateChartImageUrl: vi.fn(),
  generateMetricChartImageUrl: vi.fn(),
}));

vi.mock('@/lib/lead-introduction-server', () => ({
  ensureLeadIntroduction: vi.fn().mockResolvedValue('intro-1'),
}));

function mockDbForSuburb(suburbName: string, suburbId: string, introContent: unknown[] | null = null) {
  vi.mocked(marieQuery).mockImplementation(async (sql: string) => {
    if (sql.includes('INSERT INTO report_documents')) {
      return { rows: [{ id: 'report-1' }] } as any;
    }
    if (sql.includes('report_suburbs')) {
      return { rows: [{ id: suburbId, name: suburbName }] } as any;
    }
    if (sql.includes('admin_users')) {
      return { rows: [{ id: 'admin-1' }] } as any;
    }
    if (sql.includes('suburb_intro')) {
      return introContent ? { rows: [{ content: introContent }] } : { rows: [] };
    }
    if (sql.includes('market_monthly_snapshots')) {
      return { rows: [] } as any;
    }
    if (sql.includes('real_estate')) {
      return {
        rows: [{ total: 0, no_data: 0, bucket_0_3: 0, bucket_3_5: 0, bucket_5_10: 0, bucket_10_15: 0, bucket_15_plus: 0 }],
      } as any;
    }
    if (sql.includes('direct_mail')) {
      return { rows: [{ mailed: 0, downloads: 0, appraisals: 0, conversions: 0 }] } as any;
    }
    if (sql.includes('report_documents')) {
      return { rows: [] } as any;
    }
    return { rows: [] } as any;
  });
}

function mockDbWithTrends(suburbName: string, suburbId: string, trendRows: unknown[]) {
  vi.mocked(marieQuery).mockImplementation(async (sql: string) => {
    if (sql.includes('INSERT INTO report_documents')) {
      return { rows: [{ id: 'report-1' }] } as any;
    }
    if (sql.includes('report_suburbs')) {
      return { rows: [{ id: suburbId, name: suburbName }] } as any;
    }
    if (sql.includes('admin_users')) {
      return { rows: [{ id: 'admin-1' }] } as any;
    }
    if (sql.includes('market_monthly_snapshots')) {
      return { rows: trendRows } as any;
    }
    if (sql.includes('real_estate')) {
      return {
        rows: [{ total: 0, no_data: 0, bucket_0_3: 0, bucket_3_5: 0, bucket_5_10: 0, bucket_10_15: 0, bucket_15_plus: 0 }],
      } as any;
    }
    if (sql.includes('direct_mail')) {
      return { rows: [{ mailed: 0, downloads: 0, appraisals: 0, conversions: 0 }] } as any;
    }
    return { rows: [] } as any;
  });
}

function trendRow(region: string, regionType: string, period: string, sales: number, median: number | null, days: number | null) {
  return {
    region_name: region,
    region_type: regionType,
    period_month: period,
    median_price: median,
    sales_count: sales,
    days_to_sell: days,
    median_price_1yr_prior: null,
    price_diff_1yr_pct: null,
    median_valuation: null,
    median_list_price: null,
    total_volume: null,
  };
}

function getInsertedContent(): string {
  const insertCall = vi.mocked(marieQuery).mock.calls.find(([sql]) => (sql as string).includes('INSERT INTO report_documents'));
  expect(insertCall).toBeTruthy();
  return insertCall![1]![4] as string;
}

function getInsertedParams(): unknown[] {
  const insertCall = vi.mocked(marieQuery).mock.calls.find(([sql]) => (sql as string).includes('INSERT INTO report_documents'));
  expect(insertCall).toBeTruthy();
  return insertCall![1] as unknown[];
}

function generateRequest(body: Record<string, unknown>): Promise<Response> {
  return POST(
    new Request('http://localhost:3000/api/admin/reports/templates/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  );
}

function detail(median: number | null, sales: number, days: number | null) {
  return { median, sales, days };
}

function monthlyPoint(period: string, suburb: ReturnType<typeof detail> | null, district: ReturnType<typeof detail> | null) {
  const suburbs: Record<string, unknown> = {};
  if (suburb) suburbs.Torbay = suburb;
  return {
    period,
    periodRaw: `${period}-01`,
    cityMedian: district?.median ?? null,
    citySales: district?.sales ?? 0,
    cityDays: district?.days ?? null,
    cityDetail: district,
    suburbs,
  };
}

describe('report generate API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ user: { email: 'admin@test.com' } } as any);
    vi.mocked(getMonthlyData).mockResolvedValue([] as any);
    vi.mocked(generateChartImageUrl).mockResolvedValue('https://r2.example.com/chart.svg');
    vi.mocked(generateMetricChartImageUrl).mockResolvedValue('https://r2.example.com/metric.svg');
  });

  it('titles the North Shore district report with North Shore while querying data as North Shore City', async () => {
    mockDbForSuburb('North Shore', 'ns-1');

    const response = await generateRequest({ suburb_id: 'ns-1', quarter: '2026-Q2' });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);

    const params = getInsertedParams();
    expect(params[3]).toBe('North Shore 2026 Market Report');

    const content = params[4] as string;
    expect(content).toContain('North Shore 2026 Market Report');
    expect(content).toContain('"type":"delta"');
    expect(content).not.toContain('2026 Q2 Market Report');
    expect(content).not.toContain('North Shore City');

    expect(getMonthlyData).toHaveBeenCalledWith(
      ['North Shore City'],
      'North Shore City',
      '2026-05-01',
      '2026-06-01'
    );

    expect(generateChartImageUrl).toHaveBeenCalledWith('North Shore City', '2026-Q2', '2026-Q2', '2026-Q2');

    const trendCall = vi.mocked(marieQuery).mock.calls.find(([sql]) => (sql as string).includes('market_monthly_snapshots'));
    expect(trendCall).toBeTruthy();
    const trendParams = trendCall![1] as unknown[];
    expect(trendParams[0]).toBe('North Shore City');
  });

  it('uses North Shore as the district label for a regular suburb report', async () => {
    mockDbForSuburb('Torbay', 'tor-1');

    const response = await generateRequest({ suburb_id: 'tor-1', quarter: '2026-Q2' });

    expect(response.status).toBe(200);

    const params = getInsertedParams();
    expect(params[3]).toBe('Torbay 2026 Market Report');

    const content = params[4] as string;
    expect(content).toContain('Torbay');
    expect(content).toContain('North Shore');
    expect(content).not.toContain('North Shore City');

    expect(getMonthlyData).toHaveBeenCalledWith(
      ['Torbay'],
      'North Shore City',
      '2026-05-01',
      '2026-06-01'
    );

    expect(generateChartImageUrl).toHaveBeenCalledWith('Torbay', '2026-Q2', '2026-Q2', '2026-Q2');
  });

  it('shows a placeholder when the selected month has no data', async () => {
    mockDbForSuburb('Torbay', 'tor-1');

    const response = await generateRequest({ suburb_id: 'tor-1', quarter: '2026-Q3' });

    expect(response.status).toBe(200);
    const content = getInsertedContent();

    expect(content).toContain('Torbay Market Pulse (September 2026)');
    expect(content).not.toContain('"type":"marketPulse"');
    expect(content).toContain('Monthly data is not yet available for September 2026.');
    expect(content).toContain('REINZ Market Trends');
    expect(content).toContain('Market trend data is not yet available for this suburb.');
  });

  it('builds the Market Pulse card from monthly data with explicit year and month', async () => {
    mockDbForSuburb('Torbay', 'tor-1');
    vi.mocked(getMonthlyData).mockResolvedValue([
      monthlyPoint('2026-08', detail(1250000, 4, 47), detail(1150000, 299, 58)),
      monthlyPoint('2026-09', detail(1150000, 6, 42), detail(1165000, 262, 53)),
    ] as any);

    const response = await generateRequest({
      suburb_id: 'tor-1',
      quarter: '2026-Q3',
      report_year: 2026,
      report_month: 9,
    });

    expect(response.status).toBe(200);
    const content = getInsertedContent();

    expect(content).toContain('Torbay Market Pulse (September 2026)');
    expect(content).toContain('"type":"marketPulse"');
    expect(content).toContain('"medianPrice":"$1.15M"');
    expect(content).toContain('"salesCount":"6"');
    expect(content).toContain('"daysToSell":"42 Days"');
    expect(content).toContain('"comparePrice":"-8.0%"');
    expect(content).toContain('"compareSales":"+50.0%"');
    expect(content).toContain('"compareDays":"-5"');
    expect(content).toContain('"compareLabel":"Compared to Previous Month (August)"');
    expect(content).toContain('"salesLabel":"Local Properties Sold"');
    expect(content).toContain('"districtLine":"North Shore Avg: 53 Days"');
    expect(content).toContain('"priceNote":"North Shore Price: $1.17M"');
    expect(content).toContain('The average Days to Sell of 42 days during September 2026');
    expect(content).not.toContain('Source: REINZ');

    const params = getInsertedParams();
    expect(params[2]).toBe('2026-09');

    expect(getMonthlyData).toHaveBeenCalledWith(
      ['Torbay'],
      'North Shore City',
      '2026-08-01',
      '2026-09-01'
    );
  });

  it('builds a quarterly Market Pulse when period_type is quarter', async () => {
    mockDbForSuburb('Torbay', 'tor-1');
    vi.mocked(getMonthlyData).mockResolvedValue([
      monthlyPoint('2026-04', detail(1000000, 10, 60), detail(1100000, 200, 65)),
      monthlyPoint('2026-05', detail(1100000, 12, 55), detail(1150000, 210, 60)),
      monthlyPoint('2026-06', detail(1200000, 14, 50), detail(1200000, 220, 55)),
      monthlyPoint('2026-07', detail(1000000, 3, 40), detail(1100000, 250, 55)),
      monthlyPoint('2026-08', detail(1200000, 4, 50), detail(1150000, 260, 52)),
      monthlyPoint('2026-09', detail(1400000, 5, 60), detail(1200000, 270, 50)),
    ] as any);

    const response = await generateRequest({
      suburb_id: 'tor-1',
      quarter: '2026-Q3',
      period_type: 'quarter',
      start_quarter: '2026-Q2',
      end_quarter: '2026-Q3',
    });

    expect(response.status).toBe(200);
    const content = getInsertedContent();

    expect(content).toContain('Torbay Market Pulse (Q3 2026)');
    expect(content).toContain('"type":"marketPulse"');
    expect(content).toContain('"medianPrice":"$1.2M"');
    expect(content).toContain('"salesCount":"12"');
    expect(content).toContain('"daysToSell":"50 Days"');
    expect(content).toContain('"compareLabel":"Compared to Previous Quarter (Q2)"');
    expect(content).toContain('"comparePrice":"+9.1%"');
    expect(content).toContain('The average Days to Sell of 50 days during Q3 2026 reflects current market liquidity.');
    expect(content).not.toContain('Market Pulse (September 2026)');
    expect(content).not.toContain('Monthly data is not yet available');

    expect(getMonthlyData).toHaveBeenCalledWith(
      ['Torbay'],
      'North Shore City',
      '2026-04-01',
      '2026-09-01'
    );
  });

  it('includes all quarterly comparison charts and falls back to the latest available quarter for a lead report', async () => {
    mockDbWithTrends('Torbay', 'tor-1', [
      trendRow('Torbay', 'suburb', '2026-07-01', 3, 1000000, 40),
      trendRow('North Shore City', 'district', '2026-07-01', 250, 1100000, 55),
    ]);
    vi.mocked(getMonthlyData).mockResolvedValue([
      monthlyPoint('2026-04', detail(1000000, 10, 60), detail(1100000, 200, 65)),
      monthlyPoint('2026-05', detail(1100000, 12, 55), detail(1150000, 210, 60)),
      monthlyPoint('2026-06', detail(1200000, 14, 50), detail(1200000, 220, 55)),
      monthlyPoint('2026-07', detail(1000000, 3, 40), detail(1100000, 250, 55)),
      monthlyPoint('2026-08', detail(1200000, 4, 50), detail(1150000, 260, 52)),
      monthlyPoint('2026-09', detail(1400000, 5, 60), detail(1200000, 270, 50)),
    ] as any);

    const response = await generateRequest({
      suburb_id: 'tor-1',
      quarter: '2026-Q4',
      period_type: 'quarter',
      start_quarter: '2026-Q1',
      end_quarter: '2026-Q4',
      lead_id: 'lead-9',
    });

    expect(response.status).toBe(200);
    expect(generateMetricChartImageUrl).toHaveBeenCalledTimes(3);
    expect(generateMetricChartImageUrl).toHaveBeenCalledWith('Torbay', 'sales', 'quarter', '2026-01-01', '2027-01-01');
    expect(generateMetricChartImageUrl).toHaveBeenCalledWith('Torbay', 'median_price', 'quarter', '2026-01-01', '2027-01-01');
    expect(generateMetricChartImageUrl).toHaveBeenCalledWith('Torbay', 'days_to_sell', 'quarter', '2026-01-01', '2027-01-01');

    const content = getInsertedContent();
    expect(content).toContain('Chart: Number of Sales/Quarter — Torbay vs North Shore.');
    expect(content).toContain('Chart: Median Sale Price — Torbay vs North Shore.');
    expect(content).toContain('Chart: Median Days to Sell — Torbay vs North Shore.');
    expect(content).toContain('Torbay Market Pulse (Q3 2026)');
    expect(content).toContain('"medianPrice":"$1.2M"');
    expect(content).toContain('"salesCount":"12"');
    expect(content).toContain('"daysToSell":"50 Days"');
    expect(content).toContain('"compareLabel":"Compared to Previous Quarter (Q2)"');
    expect(content).not.toContain('Quarterly data is not yet available for Q4 2026.');
    expect(content.split('https://r2.example.com/metric.svg')).toHaveLength(4);
  });

  it('shows a quarterly placeholder when the report quarter has no data', async () => {
    mockDbForSuburb('Torbay', 'tor-1');

    const response = await generateRequest({ suburb_id: 'tor-1', quarter: '2026-Q3', period_type: 'quarter' });

    expect(response.status).toBe(200);
    const content = getInsertedContent();

    expect(content).toContain('Torbay Market Pulse (Q3 2026)');
    expect(content).not.toContain('"type":"marketPulse"');
    expect(content).toContain('Quarterly data is not yet available for Q3 2026.');
    expect(content).not.toContain('Monthly data is not yet available');
  });

  it('rewrites the intro featuring date to the quarter label', async () => {
    mockDbForSuburb('Torbay', 'tor-1', [
      { type: 'heading', props: { level: 3 }, content: [{ type: 'text', text: 'Spring Market Update', styles: {} }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Featuring Latest October 2026 Data', styles: {} }] },
    ]);

    const response = await generateRequest({ suburb_id: 'tor-1', quarter: '2026-Q3', period_type: 'quarter' });

    expect(response.status).toBe(200);
    const content = getInsertedContent();

    expect(content).toContain('Featuring Latest Q3 2026 Data');
    expect(content).not.toContain('Featuring Latest October 2026 Data');
  });

  it('rewrites the days-to-sell insight month to the quarter label', async () => {
    mockDbForSuburb('Torbay', 'tor-1', [
      { type: 'heading', props: { level: 4 }, content: [{ type: 'text', text: 'Days to Sell', styles: {} }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'The average Days to Sell of 30 days during October 2026 reflects current market liquidity.', styles: {} }] },
    ]);
    vi.mocked(getMonthlyData).mockResolvedValue([
      monthlyPoint('2026-09', detail(1150000, 6, 42), detail(1165000, 262, 53)),
    ] as any);

    const response = await generateRequest({ suburb_id: 'tor-1', quarter: '2026-Q3', period_type: 'quarter' });

    expect(response.status).toBe(200);
    const content = getInsertedContent();

    expect(content).toContain('The average Days to Sell of 42 days during Q3 2026 reflects current market liquidity.');
    expect(content).not.toContain('during October 2026');
  });

  it('falls back to North Shore district data with relabelled cards when the suburb month is missing', async () => {
    mockDbForSuburb('Torbay', 'tor-1');
    vi.mocked(getMonthlyData).mockResolvedValue([
      monthlyPoint('2026-08', null, detail(1250000, 200, 60)),
      monthlyPoint('2026-09', null, detail(1150000, 300, 53)),
    ] as any);

    const response = await generateRequest({
      suburb_id: 'tor-1',
      quarter: '2026-Q3',
      report_year: 2026,
      report_month: 9,
    });

    expect(response.status).toBe(200);
    const content = getInsertedContent();

    expect(content).toContain('"type":"marketPulse"');
    expect(content).toContain('"salesLabel":"North Shore Properties Sold"');
    expect(content).toContain('"daysLabel":"North Shore Avg Days to Sell"');
    expect(content).toContain('"districtLine":""');
    expect(content).toContain('"priceNote":""');
    expect(content).toContain('"medianPrice":"$1.15M"');
    expect(content).toContain('"compareSales":"+50.0%"');
    expect(content).toContain('"compareDays":"-7"');
    expect(content).not.toContain('North Shore City');
  });

  it('rewrites the intro featuring date to the selected month', async () => {
    mockDbForSuburb('Torbay', 'tor-1', [
      { type: 'heading', props: { level: 3 }, content: [{ type: 'text', text: 'Spring Market Update', styles: {} }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Featuring Latest October 2026 Data', styles: {} }] },
    ]);

    const response = await generateRequest({
      suburb_id: 'tor-1',
      quarter: '2026-Q3',
      report_year: 2026,
      report_month: 9,
    });

    expect(response.status).toBe(200);
    const content = getInsertedContent();

    expect(content).toContain('Featuring Latest September 2026 Data');
    expect(content).toContain('Spring Market Update');
    expect(content).not.toContain('Featuring Latest October 2026 Data');
  });

  it('labels a January report with the December comparison year', async () => {
    mockDbForSuburb('Torbay', 'tor-1');
    vi.mocked(getMonthlyData).mockResolvedValue([
      monthlyPoint('2025-12', detail(1000000, 5, 50), detail(1100000, 250, 55)),
      monthlyPoint('2026-01', detail(1100000, 8, 45), detail(1150000, 260, 53)),
    ] as any);

    const response = await generateRequest({
      suburb_id: 'tor-1',
      quarter: '2026-Q4',
      report_year: 2026,
      report_month: 1,
    });

    expect(response.status).toBe(200);
    const content = getInsertedContent();

    expect(content).toContain('Torbay 2026 Market Report');
    expect(content).toContain('Torbay Market Pulse (January 2026)');
    expect(content).toContain('"compareLabel":"Compared to Previous Month (December 2025)"');
    expect(content).toContain('"comparePrice":"+10.0%"');
    expect(getMonthlyData).toHaveBeenCalledWith(
      ['Torbay'],
      'North Shore City',
      '2025-12-01',
      '2026-01-01'
    );
  });

  it('keeps the REINZ Market Trends section driven by the report quarter', async () => {
    mockDbForSuburb('Torbay', 'tor-1');
    vi.mocked(getMonthlyData).mockResolvedValue([
      monthlyPoint('2026-08', detail(1250000, 4, 47), detail(1150000, 299, 58)),
      monthlyPoint('2026-09', detail(1150000, 6, 42), detail(1165000, 262, 53)),
    ] as any);

    vi.mocked(marieQuery).mockImplementation(async (sql: string) => {
      if (sql.includes('INSERT INTO report_documents')) {
        return { rows: [{ id: 'report-1' }] } as any;
      }
      if (sql.includes('report_suburbs')) {
        return { rows: [{ id: 'tor-1', name: 'Torbay' }] } as any;
      }
      if (sql.includes('admin_users')) {
        return { rows: [{ id: 'admin-1' }] } as any;
      }
      if (sql.includes('market_monthly_snapshots')) {
        return {
          rows: [
            {
              region_name: 'Torbay', region_type: 'suburb', period_month: '2026-07-01',
              median_price: 1100000, sales_count: 20, days_to_sell: 41,
              median_price_1yr_prior: 1000000, price_diff_1yr_pct: 10.0,
              median_valuation: null, median_list_price: null, total_volume: 22000000,
            },
            {
              region_name: 'Torbay', region_type: 'suburb', period_month: '2026-08-01',
              median_price: 1250000, sales_count: 4, days_to_sell: 47,
              median_price_1yr_prior: 1050000, price_diff_1yr_pct: 19.0,
              median_valuation: null, median_list_price: null, total_volume: 5000000,
            },
            {
              region_name: 'North Shore City', region_type: 'district', period_month: '2026-07-01',
              median_price: 1150000, sales_count: 300, days_to_sell: 55,
              median_price_1yr_prior: 1100000, price_diff_1yr_pct: 4.5,
              median_valuation: null, median_list_price: null, total_volume: 345000000,
            },
          ],
        } as any;
      }
      if (sql.includes('real_estate')) {
        return {
          rows: [{ total: 0, no_data: 0, bucket_0_3: 0, bucket_3_5: 0, bucket_5_10: 0, bucket_10_15: 0, bucket_15_plus: 0 }],
        } as any;
      }
      if (sql.includes('direct_mail')) {
        return { rows: [{ mailed: 0, downloads: 0, appraisals: 0, conversions: 0 }] } as any;
      }
      return { rows: [] } as any;
    });

    const response = await generateRequest({
      suburb_id: 'tor-1',
      quarter: '2026-Q3',
      report_year: 2026,
      report_month: 9,
    });

    expect(response.status).toBe(200);
    const content = getInsertedContent();

    expect(content).toContain('REINZ Market Trends');
    expect(content).toContain('Quarterly Summary');
    expect(content).toContain('Monthly Breakdown');
    expect(content).toContain('https://r2.example.com/chart.svg');
    expect(content).toContain('compared with North Shore.');

    const trendCall = vi.mocked(marieQuery).mock.calls.find(([sql]) => (sql as string).includes('market_monthly_snapshots'));
    expect(trendCall).toBeTruthy();
    const trendParams = trendCall![1] as unknown[];
    expect(trendParams).toEqual(['Torbay', '2026-07-01', '2026-10-01']);
  });

  it('rejects the request when suburb_id or quarter is missing', async () => {
    const response = await generateRequest({ quarter: '2026-Q3' });
    expect(response.status).toBe(400);
  });
});

describe('report generate API — period_type flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ user: { email: 'admin@test.com' } } as any);
    vi.mocked(getMonthlyData).mockResolvedValue([] as any);
    vi.mocked(generateChartImageUrl).mockResolvedValue('https://r2.example.com/chart.svg');
    vi.mocked(generateMetricChartImageUrl).mockResolvedValue('https://r2.example.com/metric.svg');
  });

  it('generates the monthly chart set over the selected month range and attaches the report to the lead', async () => {
    mockDbWithTrends('Torbay', 'tor-1', [
      trendRow('Torbay', 'suburb', '2025-07-01', 5, 1000000, 40),
      trendRow('North Shore City', 'district', '2025-07-01', 300, 1200000, 55),
    ]);

    const response = await generateRequest({
      suburb_id: 'tor-1',
      quarter: '2026-Q2',
      period_type: 'month',
      start_month: '2025-07',
      end_month: '2026-06',
      report_year: 2026,
      report_month: 6,
      lead_id: 'lead-9',
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);

    const trendCall = vi.mocked(marieQuery).mock.calls.find(([sql]) => (sql as string).includes('market_monthly_snapshots'));
    expect(trendCall).toBeTruthy();
    expect(trendCall![1]).toEqual(['Torbay', '2025-07-01', '2026-07-01']);

    expect(generateMetricChartImageUrl).toHaveBeenCalledTimes(3);
    expect(generateMetricChartImageUrl).toHaveBeenCalledWith('Torbay', 'sales', 'month', '2025-07-01', '2026-07-01');
    expect(generateMetricChartImageUrl).toHaveBeenCalledWith('Torbay', 'median_price', 'month', '2025-07-01', '2026-07-01');
    expect(generateMetricChartImageUrl).toHaveBeenCalledWith('Torbay', 'days_to_sell', 'month', '2025-07-01', '2026-07-01');
    expect(generateChartImageUrl).not.toHaveBeenCalled();

    const params = getInsertedParams();
    expect(params[2]).toBe('2026-06');
    expect(params[5]).toBe('lead-9');
    expect(ensureLeadIntroduction).toHaveBeenCalledWith('lead-9', 'admin-1');

    const content = params[4] as string;
    expect(content.split('https://r2.example.com/metric.svg')).toHaveLength(4);
    expect(content).toContain('Chart: Number of Sales/Month — Torbay vs North Shore.');
    expect(content).toContain('Chart: Median Sale Price — Torbay vs North Shore.');
    expect(content).toContain('Chart: Median Days to Sell — Torbay vs North Shore.');
    expect(content).toContain('Number of Listings per month will be added');
    expect(content.split('Source: REINZ')).toHaveLength(2);
    expect(content).toContain('Period Summary');
    expect(content).toContain('Monthly market data for Torbay compared with North Shore.');
  });

  it('aggregates the quarter chart set over the full selected quarter range', async () => {
    mockDbWithTrends('Torbay', 'tor-1', [
      trendRow('Torbay', 'suburb', '2025-07-01', 5, 1000000, 40),
    ]);

    const response = await generateRequest({
      suburb_id: 'tor-1',
      quarter: '2025-Q4',
      period_type: 'quarter',
      start_quarter: '2025-Q1',
      end_quarter: '2025-Q4',
      report_year: 2025,
      report_month: 12,
      lead_id: 'lead-9',
    });

    expect(response.status).toBe(200);

    const trendCall = vi.mocked(marieQuery).mock.calls.find(([sql]) => (sql as string).includes('market_monthly_snapshots'));
    expect(trendCall).toBeTruthy();
    expect(trendCall![1]).toEqual(['Torbay', '2025-01-01', '2026-01-01']);

    expect(generateMetricChartImageUrl).toHaveBeenCalledTimes(3);
    expect(generateMetricChartImageUrl).toHaveBeenCalledWith('Torbay', 'sales', 'quarter', '2025-01-01', '2026-01-01');
    expect(generateMetricChartImageUrl).toHaveBeenCalledWith('Torbay', 'median_price', 'quarter', '2025-01-01', '2026-01-01');
    expect(generateMetricChartImageUrl).toHaveBeenCalledWith('Torbay', 'days_to_sell', 'quarter', '2025-01-01', '2026-01-01');
    expect(generateChartImageUrl).not.toHaveBeenCalled();

    const params = getInsertedParams();
    expect(params[3]).toBe('Torbay 2025 Market Report');
    expect(params[5]).toBe('lead-9');

    const content = params[4] as string;
    expect(content).toContain('Quarterly Summary');
    expect(content).toContain('Quarterly market data for Torbay compared with North Shore.');
    expect(content).toContain('Chart: Number of Sales/Quarter — Torbay vs North Shore.');
    expect(content).toContain('Number of Listings per month will be added');
    expect(content.split('Source: REINZ')).toHaveLength(2);
  });

  it('derives the quarter column and report date from the end month when year and month are omitted', async () => {
    mockDbWithTrends('Torbay', 'tor-1', []);

    const response = await generateRequest({
      suburb_id: 'tor-1',
      period_type: 'month',
      start_month: '2026-06',
      end_month: '2026-08',
    });

    expect(response.status).toBe(200);
    const params = getInsertedParams();
    expect(params[2]).toBe('2026-08');
    expect(params[3]).toBe('Torbay 2026 Market Report');

    const content = params[4] as string;
    expect(content).toContain('Torbay Market Pulse (August 2026)');
  });

  it('rejects a month period with missing or inverted month bounds', async () => {
    const missing = await generateRequest({ suburb_id: 'tor-1', period_type: 'month', quarter: '2026-Q2' });
    expect(missing.status).toBe(400);

    const badFormat = await generateRequest({ suburb_id: 'tor-1', period_type: 'month', start_month: 'June 2025', end_month: '2026-06' });
    expect(badFormat.status).toBe(400);

    const inverted = await generateRequest({ suburb_id: 'tor-1', period_type: 'month', start_month: '2026-01', end_month: '2025-01' });
    expect(inverted.status).toBe(400);
  });

  it('uses report_name as the document title when provided', async () => {
    mockDbForSuburb('Torbay', 'tor-1');

    const response = await generateRequest({
      suburb_id: 'tor-1',
      quarter: '2026-Q3',
      period_type: 'quarter',
      start_quarter: '2026-Q1',
      end_quarter: '2026-Q3',
      report_name: 'Q3 2026 Torbay Street',
    });

    expect(response.status).toBe(200);
    const params = getInsertedParams();
    expect(params[3]).toBe('Q3 2026 Torbay Street');

    const content = params[4] as string;
    expect(content).toContain('Q3 2026 Torbay Street');
    expect(content).not.toContain('Torbay 2026 Market Report');
  });

  it('falls back to the default title when report_name is blank', async () => {
    mockDbForSuburb('Torbay', 'tor-1');

    const response = await generateRequest({
      suburb_id: 'tor-1',
      quarter: '2026-Q3',
      period_type: 'quarter',
      start_quarter: '2026-Q1',
      end_quarter: '2026-Q3',
      report_name: '   ',
    });

    expect(response.status).toBe(200);
    const params = getInsertedParams();
    expect(params[3]).toBe('Torbay 2026 Market Report');
  });

  it('generates a single quarterly median price chart for reports not tied to a lead', async () => {
    mockDbWithTrends('Torbay', 'tor-1', [
      trendRow('Torbay', 'suburb', '2026-07-01', 5, 1000000, 40),
      trendRow('North Shore City', 'district', '2026-07-01', 300, 1200000, 55),
    ]);

    const response = await generateRequest({
      suburb_id: 'tor-1',
      quarter: '2026-Q3',
      period_type: 'quarter',
      start_quarter: '2025-Q3',
      end_quarter: '2026-Q3',
    });

    expect(response.status).toBe(200);

    const trendCall = vi.mocked(marieQuery).mock.calls.find(([sql]) => (sql as string).includes('market_monthly_snapshots'));
    expect(trendCall).toBeTruthy();
    expect(trendCall![1]).toEqual(['Torbay', '2025-07-01', '2026-10-01']);

    expect(generateMetricChartImageUrl).not.toHaveBeenCalled();
    expect(generateChartImageUrl).toHaveBeenCalledTimes(1);
    expect(generateChartImageUrl).toHaveBeenCalledWith('Torbay', '2026-Q3', '2025-Q3', '2026-Q3');

    const params = getInsertedParams();
    expect(params[5]).toBeNull();
    const content = params[4] as string;
    expect(content.split('https://r2.example.com/chart.svg')).toHaveLength(2);
    expect(content).toContain('Median price trend chart');
    expect(content).toContain('Chart: Median price trend — quarterly comparison.');
    expect(content).toContain('Quarterly market data for Torbay compared with North Shore.');
    expect(content).not.toContain('Number of sales chart');
    expect(content).not.toContain('Source: REINZ');
    expect(content).toContain('Quarterly Summary');
  });

  it('derives the quarterly chart bounds from the month range for reports not tied to a lead', async () => {
    mockDbWithTrends('Torbay', 'tor-1', [
      trendRow('Torbay', 'suburb', '2026-06-01', 5, 1000000, 40),
    ]);

    const response = await generateRequest({
      suburb_id: 'tor-1',
      period_type: 'month',
      start_month: '2025-07',
      end_month: '2026-06',
      report_year: 2026,
      report_month: 6,
    });

    expect(response.status).toBe(200);

    const trendCall = vi.mocked(marieQuery).mock.calls.find(([sql]) => (sql as string).includes('market_monthly_snapshots'));
    expect(trendCall).toBeTruthy();
    expect(trendCall![1]).toEqual(['Torbay', '2025-07-01', '2026-07-01']);

    expect(generateMetricChartImageUrl).not.toHaveBeenCalled();
    expect(generateChartImageUrl).toHaveBeenCalledTimes(1);
    expect(generateChartImageUrl).toHaveBeenCalledWith('Torbay', '2026-Q2', '2025-Q3', '2026-Q2');

    const content = getInsertedParams()[4] as string;
    expect(content).toContain('Torbay Market Pulse (June 2026)');
    expect(content).toContain('Chart: Median price trend — quarterly comparison.');
    expect(content).toContain('Quarterly Summary');
    expect(content).not.toContain('Number of sales chart');
    expect(content).not.toContain('Period Summary');
  });
});

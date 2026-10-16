import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/admin/reports/templates/generate/route';
import { auth } from '@/lib/auth';
import { query as marieQuery } from '@/lib/db';
import { getMonthlyData } from '@/lib/market-data-aggregator';
import { generateChartImageUrl } from '@/lib/report-charts';

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

    expect(getMonthlyData).toHaveBeenCalledWith(
      ['Torbay'],
      'North Shore City',
      '2026-08-01',
      '2026-09-01'
    );
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

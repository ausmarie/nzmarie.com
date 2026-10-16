import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockQuery = vi.hoisted(() => vi.fn());
const mockParse = vi.hoisted(() => vi.fn());
const mockValidate = vi.hoisted(() => vi.fn());

vi.mock('pg', () => ({
  Pool: vi.fn(() => ({ query: mockQuery })),
}));

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({ user: { email: 'admin@example.com' } }),
}));

vi.mock('@/lib/permissions', () => ({
  isAdmin: vi.fn(() => true),
}));

vi.mock('@/lib/excel-parser', () => ({
  parseREINZExcel: mockParse,
  validateREINZData: mockValidate,
}));

import { POST } from '../../../app/api/admin/analytics/upload-excel/route';

function makeRequest(formData: FormData): Request {
  const req = new Request('http://localhost/api/admin/analytics/upload-excel', {
    method: 'POST',
  });
  (req as any).formData = async () => formData;
  return req;
}

function makeFileBuffer(contents: string): ArrayBuffer {
  return new TextEncoder().encode(contents).buffer;
}

describe('POST /api/admin/analytics/upload-excel', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockParse.mockReset();
    mockValidate.mockReset();
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('SELECT DISTINCT period_month')) {
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes('INSERT INTO market_monthly_snapshots')) {
        return Promise.resolve({ rowCount: 1 });
      }
      if (sql.includes('CREATE TABLE') || sql.includes('ALTER TABLE') || sql.includes('CREATE INDEX')) {
        return Promise.resolve({});
      }
      return Promise.resolve({ rows: [] });
    });
    mockValidate.mockReturnValue(true);
  });

  it('returns 401 when not authenticated', async () => {
    const { auth } = await import('@/lib/auth');
    (vi.mocked(auth) as any).mockResolvedValueOnce(null);

    const form = new FormData();
    form.append('file', new File([''], 'test.csv', { type: 'text/csv' }));
    const res = await POST(makeRequest(form));
    expect(res.status).toBe(401);
  });

  it('returns 400 when no file provided', async () => {
    const form = new FormData();
    const res = await POST(makeRequest(form));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('No file');
  });

  it('inserts new rows and reports correct counts', async () => {
    mockParse.mockReturnValue({
      rows: [
        { location: 'Torbay, Auckland', region_name: 'Torbay', city: 'Auckland', period_month: '2026-06-01', median_price: 1200000, sales_count: 10, days_to_sell: 30, median_price_1yr_prior: null, price_diff_1yr_pct: null, median_price_3yrs_prior: null, price_diff_3yrs_pct: null, median_valuation: null, median_list_price: null, sale_to_valuation_pct: null, list_to_valuation_pct: null, total_volume: null, pct_of_national_sales: null, house_price_index: null, price_diff_mom_pct: null },
        { location: 'Torbay, Auckland', region_name: 'Torbay', city: 'Auckland', period_month: '2026-07-01', median_price: 1250000, sales_count: 12, days_to_sell: 28, median_price_1yr_prior: null, price_diff_1yr_pct: null, median_price_3yrs_prior: null, price_diff_3yrs_pct: null, median_valuation: null, median_list_price: null, sale_to_valuation_pct: null, list_to_valuation_pct: null, total_volume: null, pct_of_national_sales: null, house_price_index: null, price_diff_mom_pct: null },
      ],
      suburb_name: 'Torbay',
      city: 'Auckland',
      region_type: 'suburb',
      period_start: '2026-06-01',
      period_end: '2026-07-01',
      count: 2,
    });

    const form = new FormData();
    form.append('file', new File([makeFileBuffer('dummy')], 'test.csv', { type: 'text/csv' }));
    const res = await POST(makeRequest(form));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.inserted_count).toBe(2);
    expect(body.already_existed).toBe(0);
    expect(body.validation_skipped).toBe(0);
    expect(body.total_rows).toBe(2);
    expect(body.suburb).toBe('Torbay');
  });

  it('inserts district data (North Shore City) with region_type=district', async () => {
    mockParse.mockReturnValue({
      rows: [
        { location: 'North Shore City', region_name: 'North Shore City', city: 'Auckland', period_month: '2025-01-01', median_price: 1250000, sales_count: 132, days_to_sell: 65, median_price_1yr_prior: null, price_diff_1yr_pct: null, median_price_3yrs_prior: null, price_diff_3yrs_pct: null, median_valuation: null, median_list_price: null, sale_to_valuation_pct: null, list_to_valuation_pct: null, total_volume: null, pct_of_national_sales: null, house_price_index: null, price_diff_mom_pct: null },
        { location: 'North Shore City', region_name: 'North Shore City', city: 'Auckland', period_month: '2025-02-01', median_price: 1275000, sales_count: 302, days_to_sell: 62, median_price_1yr_prior: null, price_diff_1yr_pct: null, median_price_3yrs_prior: null, price_diff_3yrs_pct: null, median_valuation: null, median_list_price: null, sale_to_valuation_pct: null, list_to_valuation_pct: null, total_volume: null, pct_of_national_sales: null, house_price_index: null, price_diff_mom_pct: null },
      ],
      suburb_name: 'North Shore City',
      city: 'Auckland',
      region_type: 'district',
      period_start: '2025-01-01',
      period_end: '2025-02-01',
      count: 2,
    });

    const form = new FormData();
    form.append('file', new File([makeFileBuffer('dummy')], 'test.csv', { type: 'text/csv' }));
    const res = await POST(makeRequest(form));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.inserted_count).toBe(2);

    const insertCalls = mockQuery.mock.calls.filter(
      (c: unknown[]) => (c[0] as string).includes('INSERT INTO market_monthly_snapshots')
    );
    for (const call of insertCalls) {
      expect(call[1][0]).toBe('district');
    }
  });

  it('skips months that already exist in the DB', async () => {
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('SELECT DISTINCT period_month')) {
        return Promise.resolve({ rows: [{ period_month: '2026-06-01' }] });
      }
      if (sql.includes('INSERT INTO market_monthly_snapshots')) {
        return Promise.resolve({ rowCount: 1 });
      }
      if (sql.includes('CREATE TABLE') || sql.includes('ALTER TABLE') || sql.includes('CREATE INDEX')) {
        return Promise.resolve({});
      }
      return Promise.resolve({ rows: [] });
    });

    mockParse.mockReturnValue({
      rows: [
        { location: 'Torbay, Auckland', region_name: 'Torbay', city: 'Auckland', period_month: '2026-06-01', median_price: 1200000, sales_count: 10, days_to_sell: 30, median_price_1yr_prior: null, price_diff_1yr_pct: null, median_price_3yrs_prior: null, price_diff_3yrs_pct: null, median_valuation: null, median_list_price: null, sale_to_valuation_pct: null, list_to_valuation_pct: null, total_volume: null, pct_of_national_sales: null, house_price_index: null, price_diff_mom_pct: null },
        { location: 'Torbay, Auckland', region_name: 'Torbay', city: 'Auckland', period_month: '2026-07-01', median_price: 1250000, sales_count: 12, days_to_sell: 28, median_price_1yr_prior: null, price_diff_1yr_pct: null, median_price_3yrs_prior: null, price_diff_3yrs_pct: null, median_valuation: null, median_list_price: null, sale_to_valuation_pct: null, list_to_valuation_pct: null, total_volume: null, pct_of_national_sales: null, house_price_index: null, price_diff_mom_pct: null },
      ],
      suburb_name: 'Torbay',
      city: 'Auckland',
      region_type: 'suburb',
      period_start: '2026-06-01',
      period_end: '2026-07-01',
      count: 2,
    });

    const form = new FormData();
    form.append('file', new File([makeFileBuffer('dummy')], 'test.csv', { type: 'text/csv' }));
    const res = await POST(makeRequest(form));

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.inserted_count).toBe(1);
    expect(body.already_existed).toBe(1);
    expect(body.total_rows).toBe(2);
  });

  it('skips rows that fail validation', async () => {
    mockValidate.mockImplementation((row: { period_month: string }) => row.period_month !== '2026-06-01');

    mockParse.mockReturnValue({
      rows: [
        { location: 'Torbay, Auckland', region_name: 'Torbay', city: 'Auckland', period_month: '2026-06-01', median_price: 0, sales_count: 0, days_to_sell: null, median_price_1yr_prior: null, price_diff_1yr_pct: null, median_price_3yrs_prior: null, price_diff_3yrs_pct: null, median_valuation: null, median_list_price: null, sale_to_valuation_pct: null, list_to_valuation_pct: null, total_volume: null, pct_of_national_sales: null, house_price_index: null, price_diff_mom_pct: null },
        { location: 'Torbay, Auckland', region_name: 'Torbay', city: 'Auckland', period_month: '2026-07-01', median_price: 1250000, sales_count: 12, days_to_sell: 28, median_price_1yr_prior: null, price_diff_1yr_pct: null, median_price_3yrs_prior: null, price_diff_3yrs_pct: null, median_valuation: null, median_list_price: null, sale_to_valuation_pct: null, list_to_valuation_pct: null, total_volume: null, pct_of_national_sales: null, house_price_index: null, price_diff_mom_pct: null },
      ],
      suburb_name: 'Torbay',
      city: 'Auckland',
      region_type: 'suburb',
      period_start: '2026-06-01',
      period_end: '2026-07-01',
      count: 2,
    });

    const form = new FormData();
    form.append('file', new File([makeFileBuffer('dummy')], 'test.csv', { type: 'text/csv' }));
    const res = await POST(makeRequest(form));

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.inserted_count).toBe(1);
    expect(body.validation_skipped).toBe(1);
    expect(body.already_existed).toBe(0);
    expect(body.total_rows).toBe(2);
  });

  it('handles all-three scenarios: some exist, some invalid, some new', async () => {
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('SELECT DISTINCT period_month')) {
        return Promise.resolve({ rows: [{ period_month: '2026-06-01' }, { period_month: '2026-07-01' }] });
      }
      if (sql.includes('INSERT')) {
        return Promise.resolve({ rowCount: 1 });
      }
      if (sql.includes('CREATE') || sql.includes('ALTER')) {
        return Promise.resolve({});
      }
      return Promise.resolve({ rows: [] });
    });

    mockValidate.mockImplementation((row: { median_price: number }) => row.median_price > 0);

    mockParse.mockReturnValue({
      rows: [
        { location: 'Torbay, Auckland', region_name: 'Torbay', city: 'Auckland', period_month: '2026-06-01', median_price: 0, sales_count: 0, days_to_sell: null, median_price_1yr_prior: null, price_diff_1yr_pct: null, median_price_3yrs_prior: null, price_diff_3yrs_pct: null, median_valuation: null, median_list_price: null, sale_to_valuation_pct: null, list_to_valuation_pct: null, total_volume: null, pct_of_national_sales: null, house_price_index: null, price_diff_mom_pct: null },
        { location: 'Torbay, Auckland', region_name: 'Torbay', city: 'Auckland', period_month: '2026-07-01', median_price: 1250000, sales_count: 12, days_to_sell: 28, median_price_1yr_prior: null, price_diff_1yr_pct: null, median_price_3yrs_prior: null, price_diff_3yrs_pct: null, median_valuation: null, median_list_price: null, sale_to_valuation_pct: null, list_to_valuation_pct: null, total_volume: null, pct_of_national_sales: null, house_price_index: null, price_diff_mom_pct: null },
        { location: 'Torbay, Auckland', region_name: 'Torbay', city: 'Auckland', period_month: '2026-08-01', median_price: 1300000, sales_count: 15, days_to_sell: 25, median_price_1yr_prior: null, price_diff_1yr_pct: null, median_price_3yrs_prior: null, price_diff_3yrs_pct: null, median_valuation: null, median_list_price: null, sale_to_valuation_pct: null, list_to_valuation_pct: null, total_volume: null, pct_of_national_sales: null, house_price_index: null, price_diff_mom_pct: null },
      ],
      suburb_name: 'Torbay',
      city: 'Auckland',
      region_type: 'suburb',
      period_start: '2026-06-01',
      period_end: '2026-08-01',
      count: 3,
    });

    const form = new FormData();
    form.append('file', new File([makeFileBuffer('dummy')], 'test.csv', { type: 'text/csv' }));
    const res = await POST(makeRequest(form));

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.validation_skipped).toBe(1);
    expect(body.already_existed).toBe(1);
    expect(body.inserted_count).toBe(1);
    expect(body.total_rows).toBe(3);
  });
});

import * as XLSX from 'xlsx';

export interface REINZRow {
  location: string;
  region_name: string;
  city: string;
  period_month: string;
  median_price: number | null;
  median_price_1yr_prior: number | null;
  price_diff_1yr_pct: number | null;
  median_price_3yrs_prior: number | null;
  price_diff_3yrs_pct: number | null;
  median_valuation: number | null;
  median_list_price: number | null;
  sale_to_valuation_pct: number | null;
  list_to_valuation_pct: number | null;
  sales_count: number;
  days_to_sell: number | null;
  price_diff_mom_pct: number | null;
  total_volume: number | null;
  pct_of_national_sales: number | null;
  house_price_index: number | null;
}

export interface ParseResult {
  rows: REINZRow[];
  suburb_name: string;
  city: string;
  region_type: 'suburb' | 'district';
  period_start: string;
  period_end: string;
  count: number;
}

function parseLocation(location: string): { region_name: string; city: string; region_type: 'suburb' | 'district' } {
  const parts = location.split(',').map(s => s.trim());
  if (parts.length > 1) {
    return {
      region_name: parts[0],
      city: parts[1],
      region_type: 'suburb',
    };
  }
  return {
    region_name: parts[0] || location,
    city: 'Auckland',
    region_type: 'district',
  };
}

function parseDate(isoString: string): string {
  return isoString.split('T')[0];
}

function parseNumber(val: unknown): number | null {
  if (val === undefined || val === null) return null;
  if (typeof val === 'number') return val;
  const str = String(val).replace(/[$,]/g, '').trim();
  if (str === '' || str === 'Low Vol.' || str === 'N/A' || str === '-') return null;
  const n = Number(str);
  return isNaN(n) ? null : n;
}

export function parseREINZExcel(buffer: ArrayBuffer): ParseResult {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error('Excel file has no sheets');
  const sheet = workbook.Sheets[sheetName];
  const rawData: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet);

  if (rawData.length === 0) throw new Error('Excel file is empty');

  const rows: REINZRow[] = [];
  let suburb_name = '';
  let city = '';
  let region_type: 'suburb' | 'district' = 'suburb';

  for (const raw of rawData) {
    const location = String(raw['Location'] || '');
    const { region_name, city: parsedCity, region_type: parsedType } = parseLocation(location);
    if (!suburb_name) {
      suburb_name = region_name;
      region_type = parsedType;
    }
    if (!city) city = parsedCity;

    const periodRaw = raw['Period'];
    const period_month = periodRaw ? parseDate(String(periodRaw)) : '';

    rows.push({
      location,
      region_name,
      city: parsedCity,
      period_month,
      median_price: parseNumber(raw['Median Sale Price']),
      median_price_1yr_prior: parseNumber(raw['Median Sale Price 1yr Prior']),
      price_diff_1yr_pct: parseNumber(raw['% Sale Price Diff from 1yr Prior']),
      median_price_3yrs_prior: parseNumber(raw['Median Sale Price 3yrs Prior']),
      price_diff_3yrs_pct: parseNumber(raw['% Sale Price Diff from 3yrs Prior']),
      median_valuation: parseNumber(raw['Median Valuation']),
      median_list_price: parseNumber(raw['Median List Price']),
      sale_to_valuation_pct: parseNumber(raw['% Sale to Valuation Diff']),
      list_to_valuation_pct: parseNumber(raw['% List Price to Valuation Diff']),
      sales_count: parseNumber(raw['No of Sales']) ?? 0,
      days_to_sell: parseNumber(raw['Median Days to Sell']),
      price_diff_mom_pct: parseNumber(raw['% Sale Price Diff from Last Period']),
      total_volume: parseNumber(raw['Total Sales Volume']),
      pct_of_national_sales: parseNumber(raw['% of National Sales']),
      house_price_index: parseNumber(raw['House Price Index']),
    });
  }

  const dates = rows.filter(r => r.period_month).map(r => r.period_month).sort();
  const period_start = dates[0] || '';
  const period_end = dates[dates.length - 1] || '';

  return { rows, suburb_name, city, region_type, period_start, period_end, count: rows.length };
}

export function validateREINZData(row: REINZRow): boolean {
  const hasDate = Boolean(row.period_month);
  const hasMeaningfulMetric =
    row.sales_count > 0 ||
    row.total_volume != null ||
    row.median_price != null ||
    row.days_to_sell != null ||
    row.price_diff_1yr_pct != null ||
    row.median_valuation != null ||
    row.median_list_price != null ||
    row.house_price_index != null ||
    row.pct_of_national_sales != null;

  return hasDate && hasMeaningfulMetric;
}

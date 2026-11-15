import { query } from './db';
import {
  ANALYTICS_DISTRICTS,
  getAnalyticsCanonicalDistrictName,
  getAnalyticsDistrictDataNames,
} from './analytics-districts';

export interface SuburbDetail {
  median: number | null;
  sales: number;
  days: number | null;
  priceDiffMomPct?: number | null;
  priceDiff1yrPct?: number | null;
  medianListPrice?: number | null;
  saleToValuationPct?: number | null;
  listToValuationPct?: number | null;
  totalVolume?: number | null;
  medianPrice1yrPrior?: number | null;
  medianPrice3yrsPrior?: number | null;
  priceDiff3yrsPct?: number | null;
  housePriceIndex?: number | null;
}

export interface MonthlyDataPoint {
  period: string;
  periodRaw: string;
  cityMedian: number | null;
  citySales: number;
  cityDays: number | null;
  cityDetail: SuburbDetail | null;
  districts?: Record<string, SuburbDetail>;
  suburbs: Record<string, SuburbDetail>;
}

interface RawMonthly {
  region_name: string;
  period_month: string;
  median_price: number | null;
  sales_count: number;
  days_to_sell: number | null;
  price_diff_mom_pct?: number | null;
  price_diff_1yr_pct?: number | null;
  median_list_price?: number | null;
  sale_to_valuation_pct?: number | null;
  list_to_valuation_pct?: number | null;
  total_volume?: number | null;
  median_price_1yr_prior?: number | null;
  median_price_3yrs_prior?: number | null;
  price_diff_3yrs_pct?: number | null;
  house_price_index?: number | null;
}

function quarterFromMonth(m: number): number {
  return Math.ceil(m / 3);
}

function findPreferredDistrictRow<T extends { region_name: string }>(
  rows: T[],
  districtNames: string[],
  matches: (row: T) => boolean,
): T | undefined {
  for (const name of districtNames) {
    const row = rows.find((item) => item.region_name === name && matches(item));
    if (row) return row;
  }
  return undefined;
}

function getAllDistrictDataNames(primaryDistrictNames: string[]): string[] {
  return [...new Set([
    ...ANALYTICS_DISTRICTS.flatMap((district) => getAnalyticsDistrictDataNames(district.name)),
    ...primaryDistrictNames,
  ])];
}

function getDistrictDetails<T extends { region_name: string }>(
  rows: T[],
  matches: (row: T) => boolean,
  toDetail: (row: T) => SuburbDetail,
): Record<string, SuburbDetail> {
  const details: Record<string, SuburbDetail> = {};
  for (const district of ANALYTICS_DISTRICTS) {
    const row = findPreferredDistrictRow(
      rows,
      getAnalyticsDistrictDataNames(district.name),
      matches,
    );
    if (row) details[district.name] = toDetail(row);
  }
  return details;
}

export async function getMonthlyData(
  suburbNames: string[],
  districtName: string,
  startDate: string,
  endDate: string
): Promise<MonthlyDataPoint[]> {
  try {
    const primaryDistrictNames = getAnalyticsDistrictDataNames(districtName);
    const districtNames = getAllDistrictDataNames(primaryDistrictNames);
    const params = [suburbNames, districtNames, startDate, endDate];
    const result = await query<RawMonthly>(
      `SELECT region_name, period_month::text,
              median_price, sales_count, days_to_sell,
              price_diff_mom_pct, price_diff_1yr_pct,
              median_list_price, sale_to_valuation_pct, list_to_valuation_pct,
              total_volume, median_price_1yr_prior, median_price_3yrs_prior,
              price_diff_3yrs_pct, house_price_index
       FROM market_monthly_snapshots
       WHERE (region_name = ANY($1::text[]) OR region_name = ANY($2::text[]))
         AND period_month BETWEEN $3::date AND $4::date
       ORDER BY period_month, region_name`,
      params
    );

    const rows = result.rows;
    if (rows.length === 0) return [];

    const n = (v: unknown): number | null => v != null ? Number(v) : null;

    function toDetail(r: RawMonthly): SuburbDetail {
      return {
        median: n(r.median_price),
        sales: n(r.sales_count) ?? 0,
        days: n(r.days_to_sell),
        priceDiffMomPct: n(r.price_diff_mom_pct),
        priceDiff1yrPct: n(r.price_diff_1yr_pct),
        medianListPrice: n(r.median_list_price),
        saleToValuationPct: n(r.sale_to_valuation_pct),
        listToValuationPct: n(r.list_to_valuation_pct),
        totalVolume: n(r.total_volume),
        medianPrice1yrPrior: n(r.median_price_1yr_prior),
        medianPrice3yrsPrior: n(r.median_price_3yrs_prior),
        priceDiff3yrsPct: n(r.price_diff_3yrs_pct),
        housePriceIndex: n(r.house_price_index),
      };
    }

    const districtRows = rows.filter(r => districtNames.includes(r.region_name));

    const keys = new Set<string>();
    for (const r of rows) {
      keys.add(r.period_month.slice(0, 7));
    }

    const merged: MonthlyDataPoint[] = [];
    for (const key of keys) {
      const matchesPeriod = (row: RawMonthly) => row.period_month.startsWith(key);
      const d = findPreferredDistrictRow(districtRows, primaryDistrictNames, matchesPeriod);
      const districts = getDistrictDetails(districtRows, matchesPeriod, toDetail);
      const suburbs: MonthlyDataPoint['suburbs'] = {};
      for (const sn of suburbNames) {
        const sr = rows.find(r => r.region_name === sn && r.period_month.startsWith(key));
        if (sr) suburbs[sn] = toDetail(sr);
      }
      merged.push({
        period: key,
        periodRaw: d?.period_month ?? key + '-01',
        cityMedian: d?.median_price ?? null,
        citySales: d?.sales_count ?? 0,
        cityDays: d?.days_to_sell ?? null,
        cityDetail: d ? toDetail(d) : null,
        districts,
        suburbs,
      });
    }

    return merged.sort((a, b) => a.period.localeCompare(b.period));
  } catch (err) {
    console.error('Error fetching monthly data:', err);
    return [];
  }
}

export async function getQuarterlyComparison(
  suburbNames: string[],
  districtName: string,
  startDate: string,
  endDate: string
): Promise<MonthlyDataPoint[]> {
  const primaryDistrictNames = getAnalyticsDistrictDataNames(districtName);
  const districtNames = getAllDistrictDataNames(primaryDistrictNames);
  try {
    const result = await query<{
      region_name: string;
      year: number;
      quarter: number;
      median: number | null;
      sales: number;
      days: number | null;
    }>(
      `SELECT
        region_name,
        EXTRACT(YEAR FROM period_month)::int AS year,
        CEIL(EXTRACT(MONTH FROM period_month) / 3.0)::int AS quarter,
        ROUND(AVG(median_price)) AS median,
        SUM(sales_count) AS sales,
        ROUND(AVG(days_to_sell)) AS days
      FROM market_monthly_snapshots
      WHERE (region_name = ANY($1::text[]) OR region_name = ANY($2::text[]))
        AND period_month BETWEEN $3::date AND $4::date
      GROUP BY region_name, 2, 3
      ORDER BY year, quarter, region_name`,
      [suburbNames, districtNames, startDate, endDate]
    );

    const rows = result.rows.map(r => ({
      region_name: r.region_name,
      year: Number(r.year),
      quarter: Number(r.quarter),
      median: r.median !== null ? Number(r.median) : null,
      sales: Number(r.sales),
      days: r.days !== null ? Number(r.days) : null,
    }));
    if (rows.length > 0) {
      return aggregateQuarterlyRows(rows, suburbNames, districtNames, primaryDistrictNames);
    }
  } catch (sqlErr) {
    console.warn('SQL quarterly aggregation failed, falling back to JS aggregation:', sqlErr);
  }

  try {
    const raw = await query<RawMonthly>(
      `SELECT region_name, period_month::text, median_price, sales_count, days_to_sell
       FROM market_monthly_snapshots
       WHERE (region_name = ANY($1::text[]) OR region_name = ANY($2::text[]))
         AND period_month BETWEEN $3::date AND $4::date
       ORDER BY period_month`,
      [suburbNames, districtNames, startDate, endDate]
    );
    if (raw.rows.length > 0) {
      return aggregateRawToQuarterly(raw.rows, suburbNames, districtNames, primaryDistrictNames);
    }
  } catch (fallbackErr) {
    console.error('JS fallback aggregation also failed:', fallbackErr);
  }

  return [];
}

function aggregateQuarterlyRows(
  rows: { region_name: string; year: number; quarter: number; median: number | null; sales: number; days: number | null }[],
  suburbNames: string[],
  districtNames: string[],
  primaryDistrictNames: string[],
): MonthlyDataPoint[] {
  const districtData = rows.filter(r => districtNames.includes(r.region_name));

  const allKeys = new Set<string>();
  for (const r of rows) {
    allKeys.add(`${r.year}-Q${r.quarter}`);
  }

  const result: MonthlyDataPoint[] = [];
  for (const key of allKeys) {
    const [y, q] = key.split('-Q').map(Number);
    const matchesPeriod = (row: typeof districtData[number]) => row.year === y && row.quarter === q;
    const d = findPreferredDistrictRow(districtData, primaryDistrictNames, matchesPeriod);
    const districts = getDistrictDetails(districtData, matchesPeriod, (row) => ({
      median: row.median,
      sales: row.sales,
      days: row.days,
    }));
    const suburbs: MonthlyDataPoint['suburbs'] = {};
    for (const sn of suburbNames) {
      const sr = rows.find(r => r.region_name === sn && r.year === y && r.quarter === q);
      if (sr) {
        suburbs[sn] = { median: sr.median, sales: sr.sales, days: sr.days };
      }
    }
    if (Object.keys(suburbs).length > 0 || d || Object.keys(districts).length > 0) {
      result.push({
        period: key,
        periodRaw: key,
        cityMedian: d?.median ?? null,
        citySales: d?.sales ?? 0,
        cityDays: d?.days ?? null,
        cityDetail: null,
        districts,
        suburbs,
      });
    }
  }

  return result.sort((a, b) => a.period.localeCompare(b.period));
}

function aggregateRawToQuarterly(
  rows: RawMonthly[],
  suburbNames: string[],
  districtNames: string[],
  primaryDistrictNames: string[],
): MonthlyDataPoint[] {
  const map = new Map<string, { districts: Map<string, RawMonthly[]>; suburbs: Map<string, RawMonthly[]> }>();
  for (const r of rows) {
    const d = new Date(r.period_month);
    const key = `${d.getFullYear()}-Q${quarterFromMonth(d.getMonth() + 1)}`;
    if (!map.has(key)) map.set(key, { districts: new Map(), suburbs: new Map() });
    const entry = map.get(key)!;
    if (districtNames.includes(r.region_name)) {
      const canonicalName = getAnalyticsCanonicalDistrictName(r.region_name);
      if (!entry.districts.has(canonicalName)) entry.districts.set(canonicalName, []);
      const districtRows = entry.districts.get(canonicalName)!;
      const existingIndex = districtRows.findIndex((row) => row.period_month.slice(0, 7) === r.period_month.slice(0, 7));
      if (existingIndex === -1) districtRows.push(r);
      else if (r.region_name === canonicalName && districtRows[existingIndex].region_name !== canonicalName) {
        districtRows[existingIndex] = r;
      }
    } else if (suburbNames.includes(r.region_name)) {
      if (!entry.suburbs.has(r.region_name)) entry.suburbs.set(r.region_name, []);
      entry.suburbs.get(r.region_name)!.push(r);
    }
  }

  const toNum = (v: unknown): number => Number(v);
  const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + toNum(b), 0) / arr.length) : null;
  const sum = (arr: number[]) => arr.reduce((a, b) => a + toNum(b), 0);

  const result: MonthlyDataPoint[] = [];
  for (const [key, groups] of map) {
    const suburbs: MonthlyDataPoint['suburbs'] = {};
    for (const [sn, sRows] of groups.suburbs) {
      suburbs[sn] = {
        median: avg(sRows.map(r => r.median_price).filter((v): v is number => v !== null)),
        sales: sum(sRows.map(r => r.sales_count)),
        days: avg(sRows.map(r => r.days_to_sell).filter((v): v is number => v !== null)),
      };
    }
    const districts: NonNullable<MonthlyDataPoint['districts']> = {};
    for (const district of ANALYTICS_DISTRICTS) {
      const districtRows = groups.districts.get(district.name) ?? [];
      if (districtRows.length > 0) {
        const medians = districtRows.map((r) => r.median_price).filter((v): v is number => v !== null);
        const days = districtRows.map((r) => r.days_to_sell).filter((v): v is number => v !== null);
        districts[district.name] = {
          median: avg(medians),
          sales: sum(districtRows.map((r) => r.sales_count)),
          days: avg(days),
        };
      }
    }
    const primaryDistrict = getAnalyticsCanonicalDistrictName(primaryDistrictNames[0]);
    const primaryDetails = districts[primaryDistrict];
    result.push({
      period: key,
      periodRaw: key,
      cityMedian: primaryDetails?.median ?? null,
      citySales: primaryDetails?.sales ?? 0,
      cityDays: primaryDetails?.days ?? null,
      cityDetail: null,
      districts,
      suburbs,
    });
  }

  return result.sort((a, b) => a.period.localeCompare(b.period));
}

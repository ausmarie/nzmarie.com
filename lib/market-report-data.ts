export type MarketReportPeriodType = 'monthly' | 'quarterly';

export interface MarketReportSourceRow {
  region_name?: string;
  period_month: string;
  median_price: number | string | null;
  sales_count: number | string | null;
  days_to_sell: number | string | null;
}

export interface MarketReportPoint {
  period: string;
  label: string;
  medianPrice: number | null;
  salesCount: number | null;
  daysToSell: number | null;
  districtMedianPrice?: number | null;
  districtSalesCount?: number | null;
  districtDaysToSell?: number | null;
}

export const MARKET_REPORT_NORTH_SHORE_REGION = 'North Shore City';
export const MARKET_REPORT_AUCKLAND_REGION = 'Auckland Region';
export const LEGACY_AUCKLAND_REGION_NAME = 'Auckland';

export interface MarketReportSnapshot {
  periodType: MarketReportPeriodType;
  periodKey: string;
  chartPeriodType?: MarketReportPeriodType;
  dataRange?: MarketReportDataRange;
  periodLabel: string;
  generatedAt: string;
  source: string;
  propertyType: string;
  metrics: {
    medianPrice: number | null;
    salesCount: number;
    daysToSell: number | null;
  };
  districtMetrics?: {
    medianPrice: number | null;
    salesCount: number | null;
    daysToSell: number | null;
  };
  comparison?: {
    label: string;
    medianPriceChange: string;
    salesCountChange: string;
    daysToSellChange: string;
  };
  charts: {
    medianPrice: MarketReportPoint[];
    salesCount: MarketReportPoint[];
    daysToSell: MarketReportPoint[];
  };
  dataNotes: string;
}

export interface MarketReportWindow {
  from: string;
  to: string;
  startPeriodKey: string;
  endPeriodKey: string;
}

export interface MarketReportDataRange {
  startPeriodKey: string;
  endPeriodKey: string;
}

interface PeriodGroup {
  period: string;
  rows: MarketReportSourceRow[];
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function parseMonthKey(value: string): { year: number; month: number } {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) throw new Error('Monthly period must use YYYY-MM format.');
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (year < 1990 || month < 1 || month > 12) throw new Error('Invalid monthly period.');
  return { year, month };
}

function parseQuarterKey(value: string): { year: number; quarter: number } {
  const match = /^(\d{4})-Q([1-4])$/.exec(value);
  if (!match) throw new Error('Quarterly period must use YYYY-Qn format.');
  const year = Number(match[1]);
  if (year < 1990) throw new Error('Invalid quarterly period.');
  return { year, quarter: Number(match[2]) };
}

function monthString(year: number, month: number): string {
  return `${monthKey(year, month)}-01`;
}

function addMonths(year: number, month: number, offset: number): { year: number; month: number } {
  const date = new Date(Date.UTC(year, month - 1 + offset, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

function periodIndex(periodType: MarketReportPeriodType, periodKey: string): number {
  if (periodType === 'monthly') {
    const { year, month } = parseMonthKey(periodKey);
    return year * 12 + month - 1;
  }
  const { year, quarter } = parseQuarterKey(periodKey);
  return year * 4 + quarter - 1;
}

function periodKeyFromIndex(periodType: MarketReportPeriodType, index: number): string {
  if (periodType === 'monthly') {
    const year = Math.floor(index / 12);
    const month = index % 12 + 1;
    return monthKey(year, month);
  }
  const year = Math.floor(index / 4);
  const quarter = index % 4 + 1;
  return `${year}-Q${quarter}`;
}

function getChartPeriodKey(
  reportType: MarketReportPeriodType,
  reportKey: string,
  chartType: MarketReportPeriodType,
): string {
  if (reportType === chartType) return reportKey;
  if (chartType === 'quarterly') {
    const { year, month } = parseMonthKey(reportKey);
    return `${year}-Q${Math.ceil(month / 3)}`;
  }
  const { year, quarter } = parseQuarterKey(reportKey);
  return monthKey(year, quarter * 3);
}

export function getDefaultMarketReportDataRange(
  periodType: MarketReportPeriodType,
  periodKey: string,
): MarketReportDataRange {
  const selectedIndex = periodIndex(periodType, periodKey);
  const lookback = periodType === 'monthly' ? 11 : 7;
  return {
    startPeriodKey: periodKeyFromIndex(periodType, Math.max((periodType === 'monthly' ? 1990 * 12 : 1990 * 4), selectedIndex - lookback)),
    endPeriodKey: periodKey,
  };
}

export function getMarketReportWindow(
  periodType: MarketReportPeriodType,
  periodKey: string,
  chartPeriodType: MarketReportPeriodType = periodType,
  dataRange?: MarketReportDataRange,
): MarketReportWindow {
  const chartAnchorKey = getChartPeriodKey(periodType, periodKey, chartPeriodType);
  const range = dataRange ?? getDefaultMarketReportDataRange(chartPeriodType, chartAnchorKey);
  const startIndex = periodIndex(chartPeriodType, range.startPeriodKey);
  const endIndex = periodIndex(chartPeriodType, range.endPeriodKey);
  if (startIndex > endIndex) {
    throw new Error('The chart data range must start before it ends.');
  }
  if (endIndex - startIndex + 1 > 60) {
    throw new Error('The chart data range cannot exceed 60 periods.');
  }

  const reportWindow = getSinglePeriodWindow(periodType, periodKey);
  const previousPeriodKey = periodKeyFromIndex(periodType, periodIndex(periodType, periodKey) - 1);
  const previousReportWindow = getSinglePeriodWindow(periodType, previousPeriodKey);
  const chartWindow = getSinglePeriodWindow(chartPeriodType, range.startPeriodKey, range.endPeriodKey);
  const from = [reportWindow.from, previousReportWindow.from, chartWindow.from].sort()[0];
  const to = [reportWindow.to, previousReportWindow.to, chartWindow.to].sort().at(-1)!;
  return {
    from,
    to,
    startPeriodKey: range.startPeriodKey,
    endPeriodKey: range.endPeriodKey,
  };
}

function getSinglePeriodWindow(
  type: MarketReportPeriodType,
  startKey: string,
  endKey = startKey,
): { from: string; to: string } {
  if (type === 'monthly') {
    const start = parseMonthKey(startKey);
    const endPeriod = parseMonthKey(endKey);
    const end = addMonths(endPeriod.year, endPeriod.month, 1);
    return { from: monthString(start.year, start.month), to: monthString(end.year, end.month) };
  }
  const start = parseQuarterKey(startKey);
  const end = parseQuarterKey(endKey);
  const from = { year: start.year, month: (start.quarter - 1) * 3 + 1 };
  const to = addMonths(end.year, (end.quarter - 1) * 3 + 1, 3);
  return { from: monthString(from.year, from.month), to: monthString(to.year, to.month) };
}

function periodLabel(periodType: MarketReportPeriodType, periodKey: string): string {
  if (periodType === 'monthly') {
    const { year, month } = parseMonthKey(periodKey);
    return `${MONTH_NAMES[month - 1]} ${year}`;
  }
  const { year, quarter } = parseQuarterKey(periodKey);
  return `Q${quarter} ${year}`;
}

function rowMonth(row: MarketReportSourceRow): string {
  const value = String(row.period_month);
  const match = /^(\d{4}-\d{2})/.exec(value);
  if (!match) throw new Error(`Invalid market data period: ${value}`);
  return match[1];
}

function toNullableNumber(value: number | string | null): number | null {
  if (value === null || value === '') return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function roundAverage(values: Array<number | null>): number | null {
  const present = values.filter((value): value is number => value !== null);
  if (present.length === 0) return null;
  return Math.round(present.reduce((sum, value) => sum + value, 0) / present.length);
}

function buildGroups(rows: MarketReportSourceRow[], periodType: MarketReportPeriodType): Map<string, PeriodGroup> {
  const groups = new Map<string, PeriodGroup>();
  for (const row of rows) {
    const month = rowMonth(row);
    const key = periodType === 'monthly'
      ? month
      : `${month.slice(0, 4)}-Q${Math.ceil(Number(month.slice(5, 7)) / 3)}`;
    const group = groups.get(key) ?? { period: key, rows: [] };
    group.rows.push(row);
    groups.set(key, group);
  }
  return groups;
}

function selectRegionRows(
  rows: MarketReportSourceRow[],
  acceptedNames: string[],
  preferredName: string,
  includeUnlabelled = false,
): MarketReportSourceRow[] {
  const rowsByMonth = new Map<string, MarketReportSourceRow>();
  for (const row of rows) {
    const isUnlabelled = row.region_name === undefined;
    if (!acceptedNames.includes(row.region_name ?? '') && !(includeUnlabelled && isUnlabelled)) continue;
    const month = rowMonth(row);
    const current = rowsByMonth.get(month);
    if (
      !current ||
      (row.region_name === preferredName && current.region_name !== preferredName)
    ) {
      rowsByMonth.set(month, row);
    }
  }
  return [...rowsByMonth.values()];
}

function aggregateGroup(group: PeriodGroup | undefined, label: string): MarketReportPoint {
  const rows = group?.rows ?? [];
  return {
    period: group?.period ?? '',
    label,
    medianPrice: roundAverage(rows.map((row) => toNullableNumber(row.median_price))),
    salesCount: rows.length > 0
      ? rows.reduce((total, row) => total + (toNullableNumber(row.sales_count) ?? 0), 0)
      : null,
    daysToSell: roundAverage(rows.map((row) => toNullableNumber(row.days_to_sell))),
  };
}

function periodKeys(
  periodType: MarketReportPeriodType,
  startPeriodKey: string,
  endPeriodKey: string,
): string[] {
  const start = periodIndex(periodType, startPeriodKey);
  const end = periodIndex(periodType, endPeriodKey);
  return Array.from({ length: end - start + 1 }, (_, index) => periodKeyFromIndex(periodType, start + index));
}

function chartLabel(periodType: MarketReportPeriodType, key: string): string {
  return periodLabel(periodType, key);
}

function percentageChange(current: number | null, previous: number | null): string {
  if (current === null || previous === null || previous === 0) return '—';
  const change = Math.round(((current - previous) / previous) * 1000) / 10;
  return `${change > 0 ? '+' : ''}${change.toFixed(1)}%`;
}

function comparisonLabel(periodType: MarketReportPeriodType, periodKey: string): string {
  const previousKey = periodKeyFromIndex(periodType, periodIndex(periodType, periodKey) - 1);
  const previousLabel = periodLabel(periodType, previousKey);
  const isSameYear = periodKey.slice(0, 4) === previousKey.slice(0, 4);
  const shortLabel = periodType === 'monthly'
    ? MONTH_NAMES[Number(previousKey.slice(5, 7)) - 1]
    : `Q${previousKey.slice(-1)}`;
  if (periodType === 'monthly') {
    return `Compared to ${isSameYear ? shortLabel : previousLabel}`;
  }
  return `Compared to Previous Quarter (${isSameYear ? shortLabel : previousLabel})`;
}

export interface MarketReportBuildOptions {
  chartPeriodType?: MarketReportPeriodType;
  dataRange?: MarketReportDataRange;
}

export function buildMarketReportSnapshot(
  periodType: MarketReportPeriodType,
  periodKey: string,
  rows: MarketReportSourceRow[],
  generatedAt = new Date().toISOString(),
  options: MarketReportBuildOptions = {},
): MarketReportSnapshot {
  const chartPeriodType = options.chartPeriodType ?? periodType;
  const chartAnchorKey = getChartPeriodKey(periodType, periodKey, chartPeriodType);
  const dataRange = options.dataRange ?? getDefaultMarketReportDataRange(chartPeriodType, chartAnchorKey);
  getMarketReportWindow(periodType, periodKey, chartPeriodType, dataRange);
  const expectedPeriod = periodLabel(periodType, periodKey);
  const northShoreRows = selectRegionRows(rows, [MARKET_REPORT_NORTH_SHORE_REGION], MARKET_REPORT_NORTH_SHORE_REGION, true);
  const aucklandRows = selectRegionRows(
    rows,
    [MARKET_REPORT_AUCKLAND_REGION, LEGACY_AUCKLAND_REGION_NAME],
    MARKET_REPORT_AUCKLAND_REGION,
  );
  const reportGroups = buildGroups(northShoreRows, periodType);
  const selected = reportGroups.get(periodKey);
  if (!selected) {
    throw new Error(`No North Shore house market data is available for ${expectedPeriod}.`);
  }

  const selectedPoint = aggregateGroup(selected, expectedPeriod);
  const selectedDistrictPoint = aggregateGroup(
    buildGroups(aucklandRows, periodType).get(periodKey),
    expectedPeriod,
  );
  const previousKey = periodKeyFromIndex(periodType, periodIndex(periodType, periodKey) - 1);
  const previousPoint = aggregateGroup(reportGroups.get(previousKey), periodLabel(periodType, previousKey));
  const chartGroups = buildGroups(northShoreRows, chartPeriodType);
  const districtChartGroups = buildGroups(aucklandRows, chartPeriodType);
  const points = periodKeys(chartPeriodType, dataRange.startPeriodKey, dataRange.endPeriodKey).map((key) => {
    const label = chartLabel(chartPeriodType, key);
    const group = chartGroups.get(key);
    const point = aggregateGroup(group, label);
    const districtPoint = aggregateGroup(districtChartGroups.get(key), label);
    return {
      ...point,
      period: key,
      districtMedianPrice: districtPoint.medianPrice,
      districtSalesCount: districtPoint.salesCount,
      districtDaysToSell: districtPoint.daysToSell,
    };
  });
  const metrics = {
    medianPrice: selectedPoint.medianPrice,
    salesCount: selectedPoint.salesCount ?? 0,
    daysToSell: selectedPoint.daysToSell,
  };
  const comparison = {
    label: comparisonLabel(periodType, periodKey),
    medianPriceChange: percentageChange(metrics.medianPrice, previousPoint.medianPrice),
    salesCountChange: percentageChange(metrics.salesCount, previousPoint.salesCount),
    daysToSellChange: metrics.daysToSell === null || previousPoint.daysToSell === null
      ? '—'
      : `${metrics.daysToSell - previousPoint.daysToSell > 0 ? '+' : ''}${metrics.daysToSell - previousPoint.daysToSell}`,
  };

  return {
    periodType,
    periodKey,
    chartPeriodType,
    periodLabel: expectedPeriod,
    dataRange: {
      startPeriodKey: dataRange.startPeriodKey,
      endPeriodKey: dataRange.endPeriodKey,
    },
    generatedAt,
    source: 'REINZ market_monthly_snapshots',
    propertyType: 'House',
    metrics,
    districtMetrics: {
      medianPrice: selectedDistrictPoint.medianPrice,
      salesCount: selectedDistrictPoint.salesCount,
      daysToSell: selectedDistrictPoint.daysToSell,
    },
    comparison,
    charts: {
      medianPrice: points.map(({ period, label, medianPrice, districtMedianPrice }) => ({
        period, label, medianPrice, salesCount: null, daysToSell: null, districtMedianPrice,
      })),
      salesCount: points.map(({ period, label, salesCount, districtSalesCount }) => ({
        period, label, medianPrice: null, salesCount, daysToSell: null, districtSalesCount,
      })),
      daysToSell: points.map(({ period, label, daysToSell, districtDaysToSell }) => ({
        period, label, medianPrice: null, salesCount: null, daysToSell, districtDaysToSell,
      })),
    },
    dataNotes: [
      periodType === 'quarterly'
        ? 'Quarterly card values average available monthly median prices and days to sell; sales count is summed.'
        : 'Card values reflect the selected month.',
      chartPeriodType === 'quarterly'
        ? 'Line charts aggregate the monthly source data by quarter.'
        : 'Line charts show monthly source data.',
      'Auckland Region is shown as a grey dashed comparison line where data is available.',
      'Blank chart points indicate that no snapshot was available for that period.',
    ].join(' '),
  };
}

export function isMarketReportPeriodType(value: unknown): value is MarketReportPeriodType {
  return value === 'monthly' || value === 'quarterly';
}

export function isValidMarketReportPeriod(periodType: MarketReportPeriodType, periodKey: string): boolean {
  try {
    if (periodType === 'monthly') parseMonthKey(periodKey);
    else parseQuarterKey(periodKey);
    return true;
  } catch {
    return false;
  }
}

import type { MonthlyDataPoint, SuburbDetail } from './market-data-aggregator';

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function monthLabel(year: number, month: number): string {
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

export function monthName(month: number): string {
  return MONTH_NAMES[month - 1];
}

export function shiftMonth(year: number, month: number, delta = -1): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export function formatMillions(value: number | null | undefined, fallback = '\u2014'): string {
  if (value == null || Number.isNaN(Number(value))) return fallback;
  const millions = (Number(value) / 1_000_000).toFixed(2).replace(/\.?0+$/, '');
  return `$${millions}M`;
}

export function pctChange(current: number | null | undefined, base: number | null | undefined): number | null {
  if (current == null || base == null || base === 0) return null;
  return Math.round(((current - base) / base) * 10000) / 100;
}

export function formatPct(value: number | null): string {
  if (value == null || Number.isNaN(value)) return '\u2014';
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

export function formatDaysDiff(value: number | null): string {
  if (value == null || Number.isNaN(value)) return '\u2014';
  return `${value > 0 ? '+' : ''}${value}`;
}

export function statDirection(value: string): 'up' | 'down' | 'none' {
  const text = (value || '').trim();
  if (text.startsWith('+')) return 'up';
  if (text.startsWith('-')) return 'down';
  return 'none';
}

export interface MarketPulseProps {
  medianPrice: string;
  salesCount: string;
  daysToSell: string;
  medianLabel: string;
  salesLabel: string;
  daysLabel: string;
  card2Note: string;
  districtLine: string;
  priceNote: string;
  compareLabel: string;
  comparePrice: string;
  compareSales: string;
  compareDays: string;
  statPriceLabel: string;
  statSalesLabel: string;
  statDaysLabel: string;
}

export interface MarketPulseResult {
  hasData: boolean;
  usedDistrict: boolean;
  anchor: { year: number; month: number };
  previous: { year: number; month: number };
  days: number | null;
  props: MarketPulseProps;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function previousLabel(year: number, month: number, anchorYear: number): string {
  return year === anchorYear ? monthName(month) : monthLabel(year, month);
}

export function computeMarketPulse(
  monthly: MonthlyDataPoint[],
  suburbName: string,
  year: number,
  month: number
): MarketPulseResult {
  const previous = shiftMonth(year, month, -1);
  const anchorYM = `${year}-${pad(month)}`;
  const previousYM = `${previous.year}-${pad(previous.month)}`;

  const anchorPoint = monthly.find((m) => m.period === anchorYM) ?? null;
  const previousPoint = monthly.find((m) => m.period === previousYM) ?? null;

  const localAnchor: SuburbDetail | null = anchorPoint?.suburbs[suburbName] ?? null;
  const districtAnchor: SuburbDetail | null = anchorPoint?.cityDetail ?? null;

  const usedDistrict = !localAnchor && !!districtAnchor;
  const hasData = !!localAnchor || !!districtAnchor;

  const current: SuburbDetail | null = usedDistrict ? districtAnchor : localAnchor;
  const previousRow: SuburbDetail | null = usedDistrict
    ? previousPoint?.cityDetail ?? null
    : previousPoint?.suburbs[suburbName] ?? null;

  const median = current?.median ?? null;
  const sales = current ? current.sales : null;
  const days = current?.days ?? null;

  const previousMedian = previousRow?.median ?? null;
  const previousSales = previousRow ? previousRow.sales : null;
  const previousDays = previousRow?.days ?? null;

  const pricePct = pctChange(median, previousMedian);
  const salesPct = pctChange(sales, previousSales);
  const daysDiff = days != null && previousDays != null ? days - previousDays : null;

  const isDistrictReport = suburbName === 'North Shore City';
  const showDistrictNotes = !isDistrictReport && !usedDistrict;

  const props: MarketPulseProps = {
    medianPrice: formatMillions(median),
    salesCount: sales != null ? String(sales) : '\u2014',
    daysToSell: days != null ? `${days} Days` : '\u2014',
    medianLabel: 'Median Sale Price',
    salesLabel: usedDistrict ? 'North Shore Properties Sold' : 'Local Properties Sold',
    daysLabel: usedDistrict ? 'North Shore Avg Days to Sell' : 'Local Avg Days to Sell',
    card2Note: 'Boutique market absorption',
    districtLine:
      showDistrictNotes && districtAnchor?.days != null ? `North Shore Avg: ${districtAnchor.days} Days` : '',
    priceNote:
      showDistrictNotes && districtAnchor?.median != null
        ? `North Shore Price: ${formatMillions(districtAnchor.median)}`
        : '',
    compareLabel: `Compared to Previous Month (${previousLabel(previous.year, previous.month, year)})`,
    comparePrice: formatPct(pricePct),
    compareSales: formatPct(salesPct),
    compareDays: formatDaysDiff(daysDiff),
    statPriceLabel: 'Median Price',
    statSalesLabel: 'Sales Count',
    statDaysLabel: 'Days to Sell',
  };

  return {
    hasData,
    usedDistrict,
    anchor: { year, month },
    previous,
    days,
    props,
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const EDITABLE_STYLE = 'border-radius:3px;padding:0 2px;margin:0 -2px;outline:none;cursor:text;';

export function buildMarketPulseHTML(props: MarketPulseProps): string {
  const value = (prop: keyof MarketPulseProps): string => escapeHtml(String(props[prop] ?? ''));
  const edit = (prop: keyof MarketPulseProps): string =>
    `<span data-prop="${prop}" contenteditable="true" spellcheck="false" style="${EDITABLE_STYLE}">${value(prop)}</span>`;

  const kpiCard = (
    labelProp: keyof MarketPulseProps,
    valueProp: keyof MarketPulseProps,
    noteProp: keyof MarketPulseProps
  ): string => {
    const note = String(props[noteProp] ?? '');
    const noteHtml = note
      ? `<span style="font-size:11px;color:#64748b;display:block;margin-top:6px;line-height:1.4;text-align:center;">${edit(noteProp)}</span>`
      : '';
    return `
        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px 24px;flex:1;min-width:0;box-shadow:0 1px 3px rgba(0,0,0,.06);">
          <span style="font-size:11px;font-weight:600;color:#94a3b8;letter-spacing:.05em;display:block;margin-bottom:8px;text-align:center;">${edit(labelProp)}</span>
          <span style="font-size:26px;font-weight:800;color:#0f172a;display:block;text-align:center;">${edit(valueProp)}</span>
          ${noteHtml}
        </div>`;
  };

  const statCol = (
    labelProp: keyof MarketPulseProps,
    valueProp: keyof MarketPulseProps,
    invertSemantic = false
  ): string => {
    const dir = statDirection(String(props[valueProp] ?? ''));
    const arrow = dir === 'up' ? '\u25B2' : dir === 'down' ? '\u25BC' : '';
    const color = invertSemantic
      ? dir === 'up'
        ? '#dc2626'
        : dir === 'down'
          ? '#16a34a'
          : '#0f172a'
      : dir === 'up'
        ? '#16a34a'
        : dir === 'down'
          ? '#dc2626'
          : '#0f172a';
    return `
        <div style="text-align:center;flex:1;min-width:0;">
          <div style="font-size:11px;font-weight:600;color:#94a3b8;margin-bottom:4px;">${edit(labelProp)}</div>
          <div data-value-col="${valueProp}" style="font-size:14px;font-weight:700;color:${color};">
            <span data-arrow="${valueProp}" style="margin-right:4px;">${arrow}</span>${edit(valueProp)}
          </div>
        </div>`;
  };

  return `
    <div style="font-family:inherit;">
      <div style="display:flex;gap:12px;margin-bottom:16px;">
        ${kpiCard('medianLabel', 'medianPrice', 'priceNote')}
        ${kpiCard('salesLabel', 'salesCount', 'card2Note')}
        ${kpiCard('daysLabel', 'daysToSell', 'districtLine')}
      </div>
      <div style="background:rgba(226,242,254,0.7);border:1px solid #cbd5e1;border-radius:12px;padding:16px 24px;">
        <div style="font-size:11px;font-weight:700;color:#1e40af;margin-bottom:12px;">${edit('compareLabel')}</div>
        <div style="display:flex;gap:8px;">
          ${statCol('statPriceLabel', 'comparePrice')}
          ${statCol('statSalesLabel', 'compareSales')}
          ${statCol('statDaysLabel', 'compareDays', true)}
        </div>
      </div>
    </div>`;
}

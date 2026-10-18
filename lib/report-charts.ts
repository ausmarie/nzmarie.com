import { query as marieQuery } from './db';
import { uploadToR2, isR2Mock } from './r2-storage';

interface RawTrendRow {
  region_name: string;
  period_month: string;
  median_price: number | null;
}

function avg(arr: number[]) {
  const nums = arr.filter(v => v != null).map(v => Number(v));
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
}

function quarterToRange(quarter: string): { start: string; end: string } | null {
  const [yearStr, qStr] = quarter.split('-Q');
  if (!yearStr || !qStr) return null;
  const year = parseInt(yearStr);
  const qNum = parseInt(qStr);
  const startMonth = (qNum - 1) * 3 + 1;
  const startDate = `${year}-${String(startMonth).padStart(2, '0')}-01`;
  const endMonth = startMonth + 3;
  const endYear = endMonth > 12 ? year + 1 : year;
  const endMonthAdjusted = endMonth > 12 ? endMonth - 12 : endMonth;
  const endDate = `${endYear}-${String(endMonthAdjusted).padStart(2, '0')}-01`;
  return { start: startDate, end: endDate };
}

async function fetchQuarterly(suburbName: string, dataStartQuarter?: string, dataEndQuarter?: string) {
  let startStr: string, endStr: string;
  if (dataStartQuarter && dataEndQuarter) {
    const start = quarterToRange(dataStartQuarter);
    if (!start) return { subData: [], distData: [] };
    startStr = start.start;
    if (dataStartQuarter === dataEndQuarter) {
      endStr = start.end;
    } else {
      const end = quarterToRange(dataEndQuarter);
      endStr = end?.end ?? start.end;
    }
  } else {
    const now = new Date();
    endStr = `${now.getFullYear() + 1}-01-01`;
    const startDate = new Date(now.getFullYear(), now.getMonth() - 8 * 3, 1);
    startStr = startDate.toISOString().slice(0, 10);
  }

  const result = await marieQuery<RawTrendRow>(
    `SELECT region_name, period_month::text, median_price
     FROM market_monthly_snapshots
     WHERE region_name IN ($1, 'North Shore City')
       AND period_month >= $2::date AND period_month < $3::date
       AND median_price IS NOT NULL
     ORDER BY region_name, period_month ASC`,
    [suburbName, startStr, endStr]
  );

  const subQ: Record<string, number[]> = {};
  const distQ: Record<string, number[]> = {};
  for (const row of result.rows) {
    const d = new Date(row.period_month);
    const q = Math.ceil((d.getMonth() + 1) / 3);
    const key = `${d.getFullYear()}-Q${q}`;
    const isDistrict = row.region_name === 'North Shore City' && suburbName !== 'North Shore' && suburbName !== 'North Shore City';
    const target = isDistrict ? distQ : subQ;
    if (!target[key]) target[key] = [];
    if (row.median_price != null) target[key].push(row.median_price);
  }

  const subData = Object.entries(subQ).map(([k, v]) => ({ quarter: k, median: avg(v) })).sort((a, b) => a.quarter.localeCompare(b.quarter));
  const distData = Object.entries(distQ).map(([k, v]) => ({ quarter: k, median: avg(v) })).sort((a, b) => a.quarter.localeCompare(b.quarter));
  return { subData, distData };
}

function monotonePath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return '';
  const n = points.length;
  // Secant slopes
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = points[i + 1].x - points[i].x;
    m.push(dx !== 0 ? (points[i + 1].y - points[i].y) / dx : 0);
  }
  // Tangents (Fritsch–Carlson monotone)
  const t: number[] = [];
  t[0] = m[0];
  t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (m[i - 1] * m[i] <= 0) {
      t[i] = 0;
    } else {
      const dx = points[i + 1].x - points[i - 1].x;
      t[i] = dx !== 0 ? (points[i + 1].y - points[i - 1].y) / dx : 0;
    }
  }
  let d = `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[i], p1 = points[i + 1];
    const dx = p1.x - p0.x;
    const cp1x = p0.x + dx / 3;
    const cp1y = p0.y + t[i] * dx / 3;
    const cp2x = p1.x - dx / 3;
    const cp2y = p1.y - t[i + 1] * dx / 3;
    d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p1.x.toFixed(1)},${p1.y.toFixed(1)}`;
  }
  return d;
}

export function generateSVG(
  suburbName: string,
  subData: { quarter: string; median: number | null }[],
  distData: { quarter: string; median: number | null }[]
): string {
  // Filter out unreasonable values (> $50M) that indicate data corruption (SUM instead of MEDIAN)
  const MAX_SANE_PRICE = 50000000;
  const filterSane = (d: { quarter: string; median: number | null }) =>
    d.median != null && d.median > 10000 && d.median < MAX_SANE_PRICE ? d : { ...d, median: null };

  const cleanSub = subData.map(filterSane);
  const cleanDist = distData.map(filterSane);

  const allQ = [...new Set([...cleanSub.map(d => d.quarter), ...cleanDist.map(d => d.quarter)])].sort();
  const subMap = new Map(cleanSub.map(d => [d.quarter, d.median]));
  const distMap = new Map(cleanDist.map(d => [d.quarter, d.median]));
  const points = allQ.map(q => ({ quarter: q, sub: subMap.get(q) ?? null, dist: distMap.get(q) ?? null }));

  const valid = points.filter(p => p.sub != null || p.dist != null);
  if (valid.length < 2) return '';

  const W = 700, H = 420, PT = 40, PR = 30, PB = 80, PL = 70;
  const CW = W - PL - PR, CH = H - PT - PB;

  // Dynamic Y-axis: no hardcoded zero, 10 % cushion on both sides
  const allVals = points.flatMap(p => [p.sub, p.dist].filter((v): v is number => v != null));
  const minRaw = Math.min(...allVals);
  const maxRaw = Math.max(...allVals);
  const pad = (maxRaw - minRaw) * 0.1 || maxRaw * 0.15;
  const yMin = Math.floor(Math.max(minRaw - pad, 0) / 100000) * 100000;
  const yMax = Math.ceil((maxRaw + pad) / 100000) * 100000;

  const xS = (i: number) => PL + (i / Math.max(points.length - 1, 1)) * CW;
  const yS = (v: number) => PT + CH - ((v - yMin) / (yMax - yMin)) * CH;

  // Premium colors: Royal Indigo for suburb, Slate Grey for benchmark
  const subColor = '#1e40af', distColor = '#94a3b8';

  const subPts = points.filter(p => p.sub != null).map(p => ({ x: xS(allQ.indexOf(p.quarter)), y: yS(p.sub!) }));
  const distPts = points.filter(p => p.dist != null).map(p => ({ x: xS(allQ.indexOf(p.quarter)), y: yS(p.dist!) }));

  const yTicks = 8;
  const yGrid: { y: number; label: string }[] = [];
  for (let i = 0; i <= yTicks; i++) {
    const val = yMin + ((yMax - yMin) / yTicks) * i;
    yGrid.push({ y: yS(val), label: `$${(val / 1000000).toFixed(2)}M` });
  }

  // Monotone cubic bezier curves instead of jagged polyline
  const subLine = subPts.length > 1
    ? `<path d="${monotonePath(subPts)}" fill="none" stroke="${subColor}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`
    : '';
  const subDots = subPts.map(p =>
    `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4.5" fill="${subColor}" stroke="white" stroke-width="1.5"/>`
  ).join('');
  const distLine = distPts.length > 1
    ? `<path d="${monotonePath(distPts)}" fill="none" stroke="${distColor}" stroke-width="2" stroke-dasharray="5,5" stroke-linecap="round" stroke-linejoin="round"/>`
    : '';
  const distDots = distPts.map(p =>
    `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.5" fill="${distColor}" stroke="white" stroke-width="1"/>`
  ).join('');

  const showDistrict = cleanDist.length > 0;
  const displayName = suburbName === 'North Shore City' ? 'North Shore' : suburbName;
  const titleText = suburbName === 'North Shore City'
    ? `${displayName} — Median Price`
    : `${displayName} vs North Shore — Median Price`;

  const legendHtml = `<rect x="${W / 2 - 120}" y="${H - 48}" width="${showDistrict ? 240 : 120}" height="26" rx="4" fill="white" stroke="#f1f5f9" stroke-width="1"/>
<line x1="${W / 2 - 108}" y1="${H - 39}" x2="${W / 2 - 85}" y2="${H - 39}" stroke="${subColor}" stroke-width="3" stroke-linecap="round"/>
<circle cx="${W / 2 - 96.5}" cy="${H - 39}" r="3.5" fill="${subColor}" stroke="white" stroke-width="1"/>
<text x="${W / 2 - 75}" y="${H - 35}" fill="#374151" font-size="10">${displayName}</text>${showDistrict ? `
<line x1="${W / 2 + 5}" y1="${H - 39}" x2="${W / 2 + 28}" y2="${H - 39}" stroke="${distColor}" stroke-width="2" stroke-dasharray="5,5" stroke-linecap="round"/>
<circle cx="${W / 2 + 16.5}" cy="${H - 39}" r="3" fill="${distColor}" stroke="white" stroke-width="1"/>
<text x="${W / 2 + 38}" y="${H - 35}" fill="#374151" font-size="10">North Shore</text>` : ''}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="font-family: Arial, sans-serif;">
<rect width="${W}" height="${H}" fill="white"/>
<rect x="${PL}" y="${PT}" width="${CW}" height="${CH}" fill="none" stroke="#f1f5f9" stroke-width="1"/>
${yGrid.map(g => `<line x1="${PL}" y1="${g.y}" x2="${W - PR}" y2="${g.y}" stroke="#f1f5f9" stroke-width="1" stroke-dasharray="4,4"/>
<text x="${PL - 6}" y="${g.y + 4}" text-anchor="end" fill="#6b7280" font-size="11">${g.label}</text>`).join('')}
<line x1="${PL}" y1="${H - PB}" x2="${W - PR}" y2="${H - PB}" stroke="#d1d5db" stroke-width="1"/>
${points.map((p, i) => `<text x="${xS(i)}" y="${H - PB + 20}" text-anchor="middle" fill="#6b7280" font-size="11">${p.quarter.replace('-Q', ' Q')}</text>`).join('')}
<text x="${W / 2}" y="22" text-anchor="middle" fill="#111827" font-size="14" font-weight="bold">${titleText}</text>
${subLine}
${subDots}
${distLine}
${distDots}
${legendHtml}
<text x="14" y="${H / 2}" text-anchor="middle" fill="#6b7280" font-size="11" transform="rotate(-90, 14, ${H / 2})">Median Price (NZD)</text>
</svg>`;
}

export async function generateChartImageUrl(suburbName: string, quarter: string, dataStartQuarter?: string, dataEndQuarter?: string): Promise<string | null> {
  if (isR2Mock) return null;

  const { subData, distData } = await fetchQuarterly(suburbName, dataStartQuarter, dataEndQuarter);
  const svg = generateSVG(suburbName, subData, distData);
  if (!svg) return null;

  const safeName = suburbName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const boundQuarter = dataStartQuarter && dataEndQuarter ? `${dataStartQuarter}-${dataEndQuarter}` : quarter;
  const key = `charts/${safeName}-${boundQuarter}-median-trend.svg`;
  await uploadToR2(key, Buffer.from(svg, 'utf-8'), 'image/svg+xml', 'public, max-age=0, must-revalidate');

  const domain = process.env.R2_PUBLIC_DOMAIN;
  return domain ? `${domain}/${key}?v=${Date.now()}` : null;
}

export type LeadChartMetric = 'sales' | 'median_price' | 'days_to_sell';
export type ChartPeriodType = 'quarter' | 'month';

export interface MetricChartPoint {
  period: string;
  sub: number | null;
  dist: number | null;
}

export interface MetricRow {
  region_name: string;
  period_month: string;
  median_price: number | null;
  sales_count: number | null;
  days_to_sell: number | null;
}

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const METRIC_META: Record<LeadChartMetric, { yLabel: string; format: (v: number) => string }> = {
  sales: { yLabel: 'Number of Sales', format: (v) => String(Math.round(v)) },
  median_price: { yLabel: 'Median Price (NZD)', format: (v) => `$${(v / 1000000).toFixed(2)}M` },
  days_to_sell: { yLabel: 'Days to Sell', format: (v) => String(Math.round(v)) },
};

function metricValue(row: MetricRow, metric: LeadChartMetric): number | null {
  const raw = metric === 'sales' ? row.sales_count : metric === 'median_price' ? row.median_price : row.days_to_sell;
  return raw == null ? null : Number(raw);
}

function periodKeyFor(dateStr: string, periodType: ChartPeriodType): string {
  const ym = dateStr.slice(0, 7);
  if (periodType === 'month') return ym;
  const [y, m] = ym.split('-').map(Number);
  return `${y}-Q${Math.ceil(m / 3)}`;
}

export function buildPeriodKeys(startDate: string, endDate: string, periodType: ChartPeriodType): string[] {
  const keys: string[] = [];
  const [sy, sm] = startDate.slice(0, 7).split('-').map(Number);
  const endKey = endDate.slice(0, 7);
  let y = sy;
  let m = sm;
  let guard = 0;
  while (guard++ < 600) {
    const ym = `${y}-${String(m).padStart(2, '0')}`;
    if (ym >= endKey) break;
    const key = periodKeyFor(ym, periodType);
    if (!keys.includes(key)) keys.push(key);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return keys;
}

export function aggregateMetricSeries(
  rows: MetricRow[],
  metric: LeadChartMetric,
  periodType: ChartPeriodType,
  suburbName: string,
  startDate: string,
  endDate: string
): MetricChartPoint[] {
  const keys = buildPeriodKeys(startDate, endDate, periodType);
  const subBuckets = new Map<string, number[]>();
  const distBuckets = new Map<string, number[]>();
  const isDistrict = suburbName === 'North Shore' || suburbName === 'North Shore City';

  for (const row of rows) {
    const value = metricValue(row, metric);
    if (value == null) continue;
    const key = periodKeyFor(row.period_month, periodType);
    let target: Map<string, number[]>;
    if (row.region_name === suburbName) {
      target = subBuckets;
    } else if (row.region_name === 'North Shore City') {
      if (isDistrict) target = subBuckets;
      else target = distBuckets;
    } else {
      continue;
    }
    if (!target.has(key)) target.set(key, []);
    target.get(key)!.push(value);
  }

  const combine = (bucket: number[] | undefined): number | null => {
    if (!bucket || bucket.length === 0) return null;
    if (metric === 'sales') return bucket.reduce((a, b) => a + b, 0);
    return Math.round(bucket.reduce((a, b) => a + b, 0) / bucket.length);
  };

  return keys.map((k) => ({ period: k, sub: combine(subBuckets.get(k)), dist: combine(distBuckets.get(k)) }));
}

function metricTitle(suburbName: string, metric: LeadChartMetric, periodType: ChartPeriodType): string {
  const display = suburbName === 'North Shore City' ? 'North Shore' : suburbName;
  const isDistrict = suburbName === 'North Shore City' || suburbName === 'North Shore';
  const suffix = isDistrict ? '' : ' and North Shore City';
  if (metric === 'sales') {
    return `Number of Sales/${periodType === 'month' ? 'Month' : 'Quarter'} in ${display}${suffix}`;
  }
  if (metric === 'median_price') {
    return `Median Sale Price in ${display}${suffix}`;
  }
  return `Median Days to Sell in ${display}${suffix}`;
}

function niceAxis(values: number[], ticks: number): { min: number; max: number; step: number } {
  const vMin = Math.min(...values);
  const vMax = Math.max(...values);
  const pad = (vMax - vMin) * 0.1 || (vMax !== 0 ? Math.abs(vMax) * 0.15 : 1);
  const lo = Math.max(0, vMin - pad);
  let hi = vMax + pad;
  if (hi <= lo) hi = lo + (lo > 0 ? lo * 0.2 : 1);
  const raw = (hi - lo) / ticks;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  const min = Math.floor(lo / step) * step;
  const max = Math.max(Math.ceil(hi / step) * step, min + step);
  return { min, max, step };
}

function ticksOf(axis: { min: number; max: number; step: number }): number[] {
  const out: number[] = [];
  for (let v = axis.min; v <= axis.max + axis.step / 2; v += axis.step) {
    out.push(Number(v.toFixed(6)));
  }
  return out;
}

export function renderMetricChartSvg(
  suburbName: string,
  metric: LeadChartMetric,
  periodType: ChartPeriodType,
  points: MetricChartPoint[]
): string {
  const valid = points.filter((p) => p.sub != null || p.dist != null);
  if (valid.length === 0) return '';

  const display = suburbName === 'North Shore City' ? 'North Shore' : suburbName;
  const showDistrict = valid.some((p) => p.dist != null);
  const sharedAxis = showDistrict && metric !== 'sales';
  const meta = METRIC_META[metric];

  const W = 700, H = 420, PT = 44, PR = showDistrict && !sharedAxis ? 76 : 30, PB = 88, PL = 76;
  const CW = W - PL - PR, CH = H - PT - PB;
  const n = points.length;
  const xS = (i: number) => PL + (n > 1 ? (i / (n - 1)) * CW : CW / 2);

  const subValues = points.map((p) => p.sub).filter((v): v is number => v != null);
  const distValues = points.map((p) => p.dist).filter((v): v is number => v != null);

  const toAxis = (values: number[]) => {
    if (values.length === 0) return null;
    const axis = niceAxis(values, 8);
    if (metric === 'median_price') return axis;
    const step = Math.max(1, Math.round(axis.step));
    return {
      min: Math.floor(axis.min / step) * step,
      max: Math.max(Math.ceil(axis.max / step) * step, step),
      step,
    };
  };

  const subAxis = sharedAxis ? toAxis([...subValues, ...distValues]) : toAxis(subValues);
  const distAxis = showDistrict ? (sharedAxis ? subAxis : toAxis(distValues)) : null;

  const yLeft = (v: number) => PT + CH - ((v - subAxis!.min) / (subAxis!.max - subAxis!.min)) * CH;
  const yRight = (v: number) => PT + CH - ((v - distAxis!.min) / (distAxis!.max - distAxis!.min)) * CH;
  const yDist = (v: number) => (sharedAxis ? yLeft(v) : yRight(v));

  const subColor = '#1e40af';
  const distColor = '#94a3b8';

  const subPts = points
    .map((p, i) => (p.sub != null && subAxis ? { x: xS(i), y: yLeft(p.sub) } : null))
    .filter((p): p is { x: number; y: number } => p != null);
  const distPts = points
    .map((p, i) => (p.dist != null && distAxis ? { x: xS(i), y: yDist(p.dist) } : null))
    .filter((p): p is { x: number; y: number } => p != null);

  const gridSource = subAxis
    ? { ticks: ticksOf(subAxis), y: (v: number) => yLeft(v), anchor: 'left' as const }
    : distAxis
      ? { ticks: ticksOf(distAxis), y: (v: number) => yDist(v), anchor: 'right' as const }
      : null;

  const labelStep = Math.ceil(n / 14) || 1;
  const xLabel = (p: string) => {
    if (periodType === 'quarter') return p.replace('-Q', ' Q');
    const [y, m] = p.split('-').map(Number);
    return `${MONTH_ABBR[m - 1]} ${String(y).slice(2)}`;
  };

  const subLine = subPts.length > 1
    ? `<path d="${monotonePath(subPts)}" fill="none" stroke="${subColor}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`
    : '';
  const subDots = subPts.map((p) =>
    `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4.5" fill="${subColor}" stroke="white" stroke-width="1.5"/>`
  ).join('');
  const distLine = distPts.length > 1
    ? `<path d="${monotonePath(distPts)}" fill="none" stroke="${distColor}" stroke-width="2" stroke-dasharray="5,5" stroke-linecap="round" stroke-linejoin="round"/>`
    : '';
  const distDots = distPts.map((p) =>
    `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.5" fill="${distColor}" stroke="white" stroke-width="1"/>`
  ).join('');

  const legendWidth = showDistrict ? 240 : 130;
  const legendHtml = `<rect x="${W / 2 - legendWidth / 2}" y="${H - 50}" width="${legendWidth}" height="26" rx="4" fill="white" stroke="#f1f5f9" stroke-width="1"/>
<line x1="${W / 2 - legendWidth / 2 + 12}" y1="${H - 39}" x2="${W / 2 - legendWidth / 2 + 35}" y2="${H - 39}" stroke="${subColor}" stroke-width="3" stroke-linecap="round"/>
<circle cx="${W / 2 - legendWidth / 2 + 23.5}" cy="${H - 39}" r="3.5" fill="${subColor}" stroke="white" stroke-width="1"/>
<text x="${W / 2 - legendWidth / 2 + 45}" y="${H - 35}" fill="#374151" font-size="10">${display}</text>${showDistrict ? `
<line x1="${W / 2 + 5}" y1="${H - 39}" x2="${W / 2 + 28}" y2="${H - 39}" stroke="${distColor}" stroke-width="2" stroke-dasharray="5,5" stroke-linecap="round"/>
<circle cx="${W / 2 + 16.5}" cy="${H - 39}" r="3" fill="${distColor}" stroke="white" stroke-width="1"/>
<text x="${W / 2 + 38}" y="${H - 35}" fill="#374151" font-size="10">North Shore</text>` : ''}`;

  const leftLabels = subAxis
    ? ticksOf(subAxis).map((v) => `<text x="${PL - 6}" y="${(yLeft(v) + 4).toFixed(1)}" text-anchor="end" fill="${sharedAxis ? '#6b7280' : subColor}" font-size="11">${meta.format(v)}</text>`).join('\n')
    : '';
  const rightLabels = distAxis && !sharedAxis
    ? ticksOf(distAxis).map((v) => `<text x="${W - PR + 8}" y="${(yRight(v) + 4).toFixed(1)}" text-anchor="start" fill="#64748b" font-size="11">${meta.format(v)}</text>`).join('\n')
    : '';

  const gridLines = gridSource
    ? gridSource.ticks.map((v) => `<line x1="${PL}" y1="${gridSource.y(v).toFixed(1)}" x2="${W - PR}" y2="${gridSource.y(v).toFixed(1)}" stroke="#f1f5f9" stroke-width="1" stroke-dasharray="4,4"/>`).join('\n')
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="font-family: Arial, sans-serif;">
<rect width="${W}" height="${H}" fill="white"/>
<rect x="${PL}" y="${PT}" width="${CW}" height="${CH}" fill="none" stroke="#f1f5f9" stroke-width="1"/>
${gridLines}
${leftLabels}
${rightLabels}
<line x1="${PL}" y1="${H - PB}" x2="${W - PR}" y2="${H - PB}" stroke="#d1d5db" stroke-width="1"/>
${points.map((p, i) => (i % labelStep === 0 ? `<text x="${xS(i).toFixed(1)}" y="${H - PB + 20}" text-anchor="middle" fill="#6b7280" font-size="11">${xLabel(p.period)}</text>` : '')).join('\n')}
<text x="${W / 2}" y="26" text-anchor="middle" fill="#111827" font-size="14" font-weight="bold">${metricTitle(suburbName, metric, periodType)}</text>
${subLine}
${subDots}
${distLine}
${distDots}
${legendHtml}
<text x="14" y="${PT + CH / 2}" text-anchor="middle" fill="#6b7280" font-size="11" transform="rotate(-90, 14, ${PT + CH / 2})">${meta.yLabel}</text>
</svg>`;
}

export async function generateMetricChartImageUrl(
  suburbName: string,
  metric: LeadChartMetric,
  periodType: ChartPeriodType,
  startDate: string,
  endDate: string
): Promise<string | null> {
  if (isR2Mock) return null;
  if (!startDate || !endDate || endDate <= startDate) return null;

  const result = await marieQuery<MetricRow>(
    `SELECT region_name, period_month::text, median_price, sales_count, days_to_sell
     FROM market_monthly_snapshots
     WHERE region_name IN ($1, 'North Shore City')
       AND period_month >= $2::date AND period_month < $3::date
     ORDER BY region_name, period_month ASC`,
    [suburbName, startDate, endDate]
  );

  const points = aggregateMetricSeries(result.rows, metric, periodType, suburbName, startDate, endDate);
  const svg = renderMetricChartSvg(suburbName, metric, periodType, points);
  if (!svg) return null;

  const safeName = suburbName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const key = `charts/${safeName}-${metric}-${periodType}-${startDate}-to-${endDate}.svg`;
  await uploadToR2(key, Buffer.from(svg, 'utf-8'), 'image/svg+xml', 'public, max-age=0, must-revalidate');

  const domain = process.env.R2_PUBLIC_DOMAIN;
  return domain ? `${domain}/${key}?v=${Date.now()}` : null;
}

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

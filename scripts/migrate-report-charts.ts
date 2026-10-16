import * as fs from 'fs';
import * as path from 'path';

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split('\n').forEach(l => {
      const t = l.trim(); if (!t || t.startsWith('#')) return;
      const i = t.indexOf('='); if (i === -1) return;
      const k = t.slice(0, i).trim(), v = t.slice(i + 1).trim();
      if (!process.env[k]) process.env[k] = v;
    });
  }
}
loadEnv();

import { Pool, QueryResultRow } from 'pg';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 5 });

async function query<T extends QueryResultRow = Record<string, unknown>>(text: string, params?: unknown[]) {
  return pool.query<T>(text, params);
}

function blockText(b: Record<string, unknown>): string {
  const content = b.content as unknown[];
  if (!content || !content.length) return '';
  const first = content[0];
  if (typeof first === 'string') return first;
  if (first && typeof first === 'object') return String((first as Record<string, unknown>).text ?? '');
  return '';
}

function svgChart(
  suburbName: string,
  suburbData: { quarter: string; median: number | null }[],
  districtData: { quarter: string; median: number | null }[]
): string {
  const validSub = suburbData.filter(d => d.median != null);
  const validDist = districtData.filter(d => d.median != null);
  if (validSub.length < 2 && validDist.length < 2) return '';

  // Merge all quarters
  const allQ = [...new Set([...suburbData.map(d => d.quarter), ...districtData.map(d => d.quarter)])].sort();
  const subMap = new Map(suburbData.map(d => [d.quarter, d.median]));
  const distMap = new Map(districtData.map(d => [d.quarter, d.median]));
  const points = allQ.map(q => ({ quarter: q, sub: subMap.get(q) ?? null, dist: distMap.get(q) ?? null }));

  const W = 700, H = 380, PT = 40, PR = 30, PB = 60, PL = 70;
  const CW = W - PL - PR, CH = H - PT - PB;

  const allVals = points.flatMap(p => [p.sub, p.dist].filter((v): v is number => v != null));
  const maxVal = Math.max(...allVals);
  const yMax = Math.ceil(maxVal * 1.15 / 100000) * 100000;
  const yMin = 0;

  const xS = (i: number) => PL + (i / Math.max(points.length - 1, 1)) * CW;
  const yS = (v: number) => PT + CH - ((v - yMin) / (yMax - yMin)) * CH;

  const subColor = '#2563EB';
  const distColor = '#DC2626';

  const subPts = points.filter(p => p.sub != null).map(p => ({ x: xS(allQ.indexOf(p.quarter)), y: yS(p.sub!) }));
  const distPts = points.filter(p => p.dist != null).map(p => ({ x: xS(allQ.indexOf(p.quarter)), y: yS(p.dist!) }));

  const yTicks = 5;
  const yGrid: { y: number; label: string }[] = [];
  for (let i = 0; i <= yTicks; i++) {
    const val = (yMax / yTicks) * i;
    yGrid.push({ y: yS(val), label: `$${(val / 1000000).toFixed(1)}M` });
  }

  const subLine = subPts.length > 1 ? `<polyline points="${subPts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}" fill="none" stroke="${subColor}" stroke-width="2.5"/>` : '';
  const subDots = subPts.map(p => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4" fill="${subColor}"/>`).join('');
  const distLine = distPts.length > 1 ? `<polyline points="${distPts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}" fill="none" stroke="${distColor}" stroke-width="2.5" stroke-dasharray="6,3"/>` : '';
  const distDots = distPts.map(p => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4" fill="${distColor}"/>`).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="font-family: Arial, sans-serif;">
<rect width="${W}" height="${H}" fill="white"/>
<rect x="${PL}" y="${PT}" width="${CW}" height="${CH}" fill="none" stroke="#e5e7eb" stroke-width="1"/>
${yGrid.map(g => `<line x1="${PL}" y1="${g.y}" x2="${W - PR}" y2="${g.y}" stroke="#f3f4f6" stroke-width="1"/>
<text x="${PL - 6}" y="${g.y + 4}" text-anchor="end" fill="#6b7280" font-size="11">${g.label}</text>`).join('')}
${points.map((p, i) => `<text x="${xS(i)}" y="${H - PB + 20}" text-anchor="middle" fill="#6b7280" font-size="10">${p.quarter}</text>`).join('')}
<text x="${W / 2}" y="22" text-anchor="middle" fill="#111827" font-size="14" font-weight="bold">${suburbName} vs North Shore City — Median Price</text>
${subLine}
${subDots}
${distLine}
${distDots}
<rect x="${W - 220}" y="30" width="200" height="50" rx="4" fill="white" stroke="#e5e7eb" stroke-width="1"/>
<line x1="${W - 210}" y1="45" x2="${W - 180}" y2="45" stroke="${subColor}" stroke-width="2.5"/>
<circle cx="${W - 195}" cy="45" r="3" fill="${subColor}"/>
<text x="${W - 172}" y="49" fill="#374151" font-size="11">${suburbName}</text>
<line x1="${W - 210}" y1="65" x2="${W - 180}" y2="65" stroke="${distColor}" stroke-width="2.5" stroke-dasharray="6,3"/>
<circle cx="${W - 195}" cy="65" r="3" fill="${distColor}"/>
<text x="${W - 172}" y="69" fill="#374151" font-size="11">North Shore City</text>
<text x="${W / 2}" y="${H - 5}" text-anchor="middle" fill="#6b7280" font-size="11">Quarter</text>
<text x="14" y="${H / 2}" text-anchor="middle" fill="#6b7280" font-size="11" transform="rotate(-90, 14, ${H / 2})">Median Price (NZD)</text>
</svg>`;
}

async function uploadChart(suburbName: string, quarter: string): Promise<string | null> {
  const r2Id = process.env.R2_ACCOUNT_ID;
  const r2Key = process.env.R2_ACCESS_KEY_ID;
  const r2Secret = process.env.R2_SECRET_ACCESS_KEY;
  const r2Bucket = process.env.R2_BUCKET_NAME;
  const r2Domain = process.env.R2_PUBLIC_DOMAIN;
  if (!r2Key || r2Key.startsWith('mock-') || !r2Secret || !r2Bucket || !r2Domain) return null;

  const now = new Date();
  const endStr = `${now.getFullYear() + 1}-01-01`;
  const startDate = new Date(now.getFullYear(), now.getMonth() - 24, 1);
  const startStr = startDate.toISOString().slice(0, 10);

  const dataResult = await query<{ region_name: string; period_month: string; median_price: number | null }>(
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
  for (const row of dataResult.rows) {
    const d = new Date(row.period_month);
    const q = Math.ceil((d.getMonth() + 1) / 3);
    const key = `${d.getFullYear()}-Q${q}`;
    const target = row.region_name === 'North Shore City' ? distQ : subQ;
    if (!target[key]) target[key] = [];
    if (row.median_price != null) target[key].push(row.median_price);
  }

  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const subData = Object.entries(subQ).map(([k, v]) => ({ quarter: k, median: avg(v) })).sort((a, b) => a.quarter.localeCompare(b.quarter));
  const distData = Object.entries(distQ).map(([k, v]) => ({ quarter: k, median: avg(v) })).sort((a, b) => a.quarter.localeCompare(b.quarter));

  const svg = svgChart(suburbName, subData, distData);
  if (!svg) return null;

  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${r2Id}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: r2Key, secretAccessKey: r2Secret },
  });
  const safeName = suburbName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const key = `charts/${safeName}-${quarter}-median-trend.svg`;
  await client.send(new PutObjectCommand({
    Bucket: r2Bucket,
    Key: key,
    Body: Buffer.from(svg, 'utf-8'),
    ContentType: 'image/svg+xml',
  }));
  return `${r2Domain}/${key}`;
}

interface ReportRow {
  id: string;
  suburb_id: string;
  quarter: string;
  suburb_name: string;
  content: unknown[];
}

async function main() {
  console.log('Fetching all existing reports...');
  const result = await query<ReportRow>(
    `SELECT rd.id, rd.suburb_id, rd.quarter, rs.name as suburb_name, rd.content
     FROM report_documents rd
     JOIN report_suburbs rs ON rd.suburb_id = rs.id
     WHERE rd.doc_type = 'report' AND rd.quarter IS NOT NULL AND rd.status != 'archived'
     ORDER BY rs.name, rd.quarter`
  );
  console.log(`Found ${result.rows.length} reports.`);

  let updated = 0, skipped = 0;
  for (const report of result.rows) {
    const content = report.content as Record<string, unknown>[];
    if (!content || !Array.isArray(content)) { skipped++; console.log(`  SKIP ${report.suburb_name} ${report.quarter}: no content`); continue; }

    // Remove any existing chart image + caption blocks (fixes wrong-format images)
    for (let i = content.length - 1; i >= 0; i--) {
      const b = content[i];
      if (b.type === 'image' && String((b.props as Record<string, unknown>)?.url ?? '').includes('median-trend')) {
        const nextBlock = content[i + 1];
        if (nextBlock?.type === 'paragraph' && String((nextBlock.content as unknown[])?.[0] ?? '').includes('Chart:')) {
          content.splice(i, 2);
        } else {
          content.splice(i, 1);
        }
      }
    }

    try {
      const chartUrl = await uploadChart(report.suburb_name, report.quarter);
      if (!chartUrl) { skipped++; console.log(`  SKIP ${report.suburb_name} ${report.quarter}: chart null`); continue; }

      const trendIdx = content.findIndex(b => b.type === 'heading' && blockText(b).includes('REINZ Market Trends'));
      if (trendIdx === -1) { skipped++; console.log(`  SKIP ${report.suburb_name} ${report.quarter}: heading not found`); continue; }

      const chartBlock: Record<string, unknown> = {
        type: 'image',
        props: { url: chartUrl, caption: '', name: 'Median price trend chart', showPreview: true, previewWidth: 700, textAlignment: 'left', backgroundColor: 'default' },
      };
      const captionBlock: Record<string, unknown> = {
        type: 'paragraph',
        content: ['Chart: Median price trend — quarterly comparison.'],
      };
      content.splice(trendIdx + 2, 0, chartBlock, captionBlock);

      await query('UPDATE report_documents SET content = $1, updated_at = NOW() WHERE id = $2', [JSON.stringify(content), report.id]);
      console.log(`  OK  ${report.suburb_name} ${report.quarter}: chart inserted`);
      updated++;
    } catch (err) {
      console.error(`  ERR ${report.suburb_name} ${report.quarter}:`, (err as Error).message);
      skipped++;
    }
  }
  console.log(`\nDone. ${updated} updated, ${skipped} skipped.`);
  await pool.end();
}

main().catch(err => { console.error('Failed:', err); process.exit(1); });

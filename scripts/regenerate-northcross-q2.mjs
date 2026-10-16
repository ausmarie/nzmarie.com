import fs from 'fs';
import path from 'path';
function loadEnv() {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(l => {
      const t = l.trim(); if (!t || t.startsWith('#')) return;
      const i = t.indexOf('='); if (i === -1) return;
      process.env[t.slice(0,i).trim()] = t.slice(i+1).trim();
    });
  }
}
loadEnv();

const fmtM = (v) => { if (v == null) return '-'; return `$${(v/1000000).toFixed(1)}M`; };
const agg = (arr) => { const vals = arr.filter(v => v != null).map(Number); return vals.length ? Math.round(vals.reduce((a,b)=>a+b,0)/vals.length) : null; };
const sum = (arr) => { return arr.filter(v => v != null).map(Number).reduce((a,b)=>a+b,0); };

(async function main(){
  try {
    const { Pool } = await import('pg');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 2 });

    // find suburb id for Northcross
    const suburbRes = await pool.query(`SELECT id, name FROM report_suburbs WHERE name ILIKE 'Northcross' LIMIT 1`);
    if (suburbRes.rows.length === 0) { console.log('Suburb Northcross not found in report_suburbs'); await pool.end(); return; }
    const suburb = suburbRes.rows[0];
    const reportQuarter = '2026-Q2';

    const quarterToRange = (q) => {
      const [ys, qs] = q.split('-Q'); const y = Number(ys); const qn = Number(qs); const startMonth = (qn-1)*3+1; const start = `${y}-${String(startMonth).padStart(2,'0')}-01`; const endMonth = startMonth+3; const endYear = endMonth>12? y+1: y; const endMonthAdj = endMonth>12? endMonth-12: endMonth; const end = `${endYear}-${String(endMonthAdj).padStart(2,'0')}-01`; return { start, end };
    };
    const range = quarterToRange(reportQuarter);

    const marketRes = await pool.query(
      `SELECT region_name, region_type, period_month, median_price, sales_count, days_to_sell, median_price_1yr_prior, price_diff_1yr_pct, median_valuation, median_list_price, total_volume
       FROM market_monthly_snapshots
       WHERE region_name IN ($1, 'North Shore City')
         AND period_month >= $2::date AND period_month < $3::date
       ORDER BY region_name, period_month ASC`,
      [suburb.name, range.start, range.end]
    );

    const qAggRes = await pool.query(
      `SELECT
        region_name,
        region_type,
        EXTRACT(YEAR FROM period_month)::int AS year,
        CEIL(EXTRACT(MONTH FROM period_month) / 3.0)::int AS quarter,
        SUM(total_volume) FILTER (WHERE total_volume IS NOT NULL) AS total_volume,
        SUM(sales_count) AS sales_count,
        ROUND(AVG(days_to_sell)) AS days_to_sell,
        ROUND(AVG(median_price)) AS median_price,
        AVG(price_diff_1yr_pct) AS price_diff_1yr_pct
      FROM market_monthly_snapshots
      WHERE region_name IN ($1, 'North Shore City')
        AND period_month >= $2::date AND period_month < $3::date
        GROUP BY region_name, region_type, EXTRACT(YEAR FROM period_month)::int, CEIL(EXTRACT(MONTH FROM period_month) / 3.0)::int
      ORDER BY region_name`,
      [suburb.name, range.start, range.end]
    );

    console.log('market rows:', marketRes.rows.length, 'quarterAgg rows:', qAggRes.rows.length);

    // choose quarterAgg for Northcross
    const qParts = reportQuarter.split('-Q'); const qYear = Number(qParts[0]); const qNum = Number(qParts[1]);
    const suburbAgg = qAggRes.rows.find(r => r.region_name.toLowerCase().trim() === suburb.name.toLowerCase().trim() && Number(r.year)===qYear && Number(r.quarter)===qNum);

    let kpiTotalVolume = null, kpiSales = 0, kpiDays = null, kpiMedian = null, pricePct = null;
    if (suburbAgg) {
      kpiTotalVolume = suburbAgg.total_volume !== null ? Number(suburbAgg.total_volume) : null;
      kpiSales = Number(suburbAgg.sales_count || 0);
      kpiDays = suburbAgg.days_to_sell !== null ? Number(suburbAgg.days_to_sell) : null;
      kpiMedian = suburbAgg.median_price !== null ? Number(suburbAgg.median_price) : null;
      pricePct = suburbAgg.price_diff_1yr_pct !== null ? Number(suburbAgg.price_diff_1yr_pct) : null;
    } else {
      const subData = marketRes.rows.filter(r => (r.region_type === 'suburb') || (r.region_name && r.region_name.toLowerCase().trim()===suburb.name.toLowerCase().trim()));
      kpiMedian = agg(subData.map(r => r.median_price));
      kpiSales = sum(subData.map(r => r.sales_count));
      kpiDays = agg(subData.map(r => r.days_to_sell));
      const totalVolumes = subData.map(r => r.total_volume).filter(v => v != null).map(Number);
      kpiTotalVolume = totalVolumes.length ? totalVolumes.reduce((a,b)=>a+b,0) : null;
      const lastSub = subData[subData.length - 1];
      pricePct = lastSub?.price_diff_1yr_pct != null ? Number(lastSub.price_diff_1yr_pct) : null;
    }

    const title = `${suburb.name} ${reportQuarter.replace('-Q', ' Q')} Market Report (regenerated)`;

    // build minimal content
    const blocks = [];
    blocks.push({ type: 'heading', props: { level: 1, textAlignment: 'center' }, content: [suburb.name] });
    blocks.push({ type: 'heading', props: { level: 2, textAlignment: 'center' }, content: [`${reportQuarter.replace('-Q',' Q')} Market Report`] });
    blocks.push({ type: 'heading', props: { level: 2 }, content: [`${suburb.name} Quarterly Data`] });
    blocks.push({ type: 'quarterlyData', props: {
      suburbName: suburb.name,
      totalVolume: fmtM(kpiTotalVolume),
      totalVolumeNumeric: kpiTotalVolume,
      totalSales: String(kpiSales),
      totalSalesNumeric: kpiSales,
      avgDaysToSell: kpiDays != null ? String(kpiDays) : '',
      periodText: reportQuarter.replace('-Q',' Q'),
    }});

    // monthly table
    const monthStr = (d) => typeof d === 'string' ? d : new Date(d).toISOString().slice(0,10);
    const months = [...new Set(marketRes.rows.map(r => monthStr(r.period_month)))].sort();
    const header = { cells: [['Month'], [`${suburb.name} Median`], [`${suburb.name} Sales`], ['District Median']] };
    const mRows = [header];
    const suburbData = marketRes.rows.filter(r => r.region_type === 'suburb');
    const districtData = marketRes.rows.filter(r => r.region_type !== 'suburb');
    for (const month of months) {
      const sub = suburbData.find(r => monthStr(r.period_month) === month);
      const dist = districtData.find(r => monthStr(r.period_month) === month);
      const dsp = (d) => new Date(d).toLocaleDateString('en-NZ', { month: 'short', year: 'numeric' });
      mRows.push({ cells: [ [dsp(month)], [fmtM(sub?.median_price)], [sub ? String(sub.sales_count ?? 0) : '-'], [fmtM(dist?.median_price)] ] });
    }
    blocks.push({ type: 'table', props: { width: 1 }, content: { type: 'tableContent', rows: mRows, headerRows: 1, columnWidths: [] } });

    // find an admin user id to attach
    const adminRes = await pool.query(`SELECT id FROM admin_users LIMIT 1`);
    const userId = adminRes.rows.length ? adminRes.rows[0].id : null;

    const insertRes = await pool.query(`INSERT INTO report_documents (user_id, doc_type, suburb_id, quarter, title, content) VALUES ($1, 'report', $2, $3, $4, $5) RETURNING id`, [userId, suburb.id, reportQuarter, title, JSON.stringify(blocks)]);
    console.log('Inserted report id:', insertRes.rows[0].id);

    await pool.end();
  } catch (err) {
    console.error('Error regenerating:', err);
    process.exit(1);
  }
})();

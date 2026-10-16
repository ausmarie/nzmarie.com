import * as fs from 'fs';
import * as path from 'path';
function loadEnv() {
  const e = path.join(process.cwd(), '.env');
  if (fs.existsSync(e)) {
    fs.readFileSync(e, 'utf8').split('\n').forEach(l => {
      const t = l.trim(); if (!t || t.startsWith('#')) return;
      const i = t.indexOf('='); if (i === -1) return;
      process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
    });
  }
}
loadEnv();
async function main() {
  const { Pool } = await import('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 2 });
  const r = await pool.query(`SELECT title, content FROM report_documents WHERE id = 'aec58f78-96cc-4de4-8014-a35361d43896'`);
  if (r.rows.length === 0) { console.log('Not found'); return; }
  console.log('Title:', r.rows[0].title);
  const content = r.rows[0].content;
  for (let i = 0; i < content.length; i++) {
    const b = content[i];
    if (b.type === 'table') {
      const tc = b.content;
      if (tc && tc.type === 'tableContent' && tc.rows) {
        for (let ri = 0; ri < tc.rows.length; ri++) {
          const row = tc.rows[ri];
          const cellTexts = row.cells.map((c: any) => JSON.stringify(c)).join(' | ');
          console.log('Block', i, 'Row', ri, ':', cellTexts);
        }
      }
    }
  }
  const r2 = await pool.query(
    `SELECT region_name, region_type, period_month::text, median_price, sales_count, days_to_sell
     FROM market_monthly_snapshots
     WHERE region_name IN ('Oteha', 'North Shore City')
       AND period_month >= '2026-01-01' AND period_month < '2026-04-01'
     ORDER BY region_name, period_month`
  );
  console.log('\nRaw market data:');
  for (const row of r2.rows) {
    console.log(JSON.stringify(row));
  }
  await pool.end();
}
main().catch(e => { console.error(e); process.exit(1); });

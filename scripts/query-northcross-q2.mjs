import fs from 'fs';
import path from 'path';

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        const k = trimmed.substring(0, idx).trim();
        const v = trimmed.substring(idx + 1).trim();
        process.env[k] = v;
      }
    }
  }
}

loadEnv();

(async function main(){
  try {
    const { Pool } = await import('pg');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: true }, max: 2 });

    console.log('Querying raw monthly rows for Northcross 2026-04 to 2026-06...');
    const rowsRes = await pool.query(
      `SELECT region_name, period_month::text AS period_month, total_volume, sales_count, days_to_sell, median_price
       FROM market_monthly_snapshots
       WHERE region_name ILIKE 'Northcross'
         AND period_month BETWEEN '2026-04-01'::date AND '2026-06-30'::date
       ORDER BY period_month`
    );
    console.log('RAW ROWS:');
    for (const r of rowsRes.rows) {
      console.log(JSON.stringify(r));
    }

    console.log('\nQuerying quarter aggregation (2026 Q2) for Northcross...');
    const aggRes = await pool.query(
      `SELECT region_name,
              SUM(total_volume) FILTER (WHERE total_volume IS NOT NULL) AS total_volume_sum,
              SUM(sales_count) AS sales_sum,
              ROUND(AVG(days_to_sell)) AS avg_days,
              ROUND(AVG(median_price)) AS avg_median
       FROM market_monthly_snapshots
       WHERE region_name ILIKE 'Northcross'
         AND period_month BETWEEN '2026-04-01'::date AND '2026-06-30'::date
       GROUP BY region_name`
    );
    console.log('AGGREGATE:');
    console.log(JSON.stringify(aggRes.rows, null, 2));

    await pool.end();
  } catch (err) {
    console.error('Error querying DB:', err);
    process.exit(1);
  }
})();

import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx > 0) {
      process.env[trimmed.substring(0, idx).trim()] = trimmed.substring(idx + 1).trim();
    }
  }
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL missing');
  process.exit(1);
}

const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });

(async () => {
  try {
    const tables = ['properties', 'outreach_enriched', 'outreach_send_logs', 'outreach_properties', 'real_estate', 'real_estate_rent'];
    for (const table of tables) {
      const res = await pool.query(
        `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = $1 ORDER BY indexname`,
        [table]
      );
      console.log('TABLE', table, 'INDEXES:', res.rows.length);
      for (const row of res.rows) {
        console.log(JSON.stringify(row));
      }
      console.log('---');
    }
  } catch (error) {
    console.error(error);
  } finally {
    await pool.end();
  }
})();

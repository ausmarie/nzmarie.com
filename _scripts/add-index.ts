import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        process.env[trimmed.substring(0, idx).trim()] = trimmed.substring(idx + 1).trim();
      }
    }
  }
}

loadEnv();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  try {
    console.log('Creating index idx_leads_status_created...');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_leads_status_created ON leads (status, created_at DESC)');
    console.log('OK');

    console.log('Running ANALYZE leads...');
    await pool.query('ANALYZE leads');
    console.log('OK');

    const res = await pool.query('SHOW INDEXES FROM leads');
    console.log('\nIndexes on leads:');
    res.rows.forEach((r: { index_name: string; column_names: string[] }) =>
      console.log(' -', r.index_name, 'columns:', JSON.stringify(r.column_names))
    );

    await pool.end();
    console.log('\nDone.');
  } catch (err) {
    console.error('Error:', (err as Error).message);
    process.exit(1);
  }
}

main();

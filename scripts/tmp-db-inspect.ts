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
      const key = trimmed.substring(0, idx).trim();
      const val = trimmed.substring(idx + 1).trim();
      process.env[key] = val;
    }
  }
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL not found');
  process.exit(1);
}

const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });

(async () => {
  try {
    const cols = await pool.query(
      "SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_name IN ('outreach_enriched', 'properties', 'outreach_properties') ORDER BY table_name, ordinal_position"
    );
    console.log('COLUMNS:', JSON.stringify(cols.rows, null, 2));
    const ver = await pool.query('SELECT current_database() as db, version() as version');
    console.log('VERSION:', JSON.stringify(ver.rows, null, 2));
  } catch (error) {
    console.error('ERROR:', error);
  } finally {
    await pool.end();
  }
})();

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx > 0) process.env[trimmed.substring(0, idx).trim()] = trimmed.substring(idx + 1).trim();
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
    // Count properties in Torbay
    const res = await pool.query("SELECT COUNT(*) as total FROM properties WHERE LOWER(suburb) = LOWER('Torbay')");
    console.log('properties in Torbay:', res.rows[0].total);

    // Total count of all properties
    const totalRes = await pool.query('SELECT COUNT(*) as total FROM properties');
    console.log('total properties:', totalRes.rows[0].total);

    await pool.end();
  } catch (err) {
    console.error('Error:', (err as Error).message);
    process.exit(1);
  }
}

main();

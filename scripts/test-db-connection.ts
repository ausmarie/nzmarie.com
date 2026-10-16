import { Pool } from 'pg';
import { DateTime } from 'luxon';
import * as fs from 'fs';
import * as path from 'path';

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }
      const index = trimmed.indexOf('=');
      if (index > 0) {
        const key = trimmed.substring(0, index).trim();
        const val = trimmed.substring(index + 1).trim();
        process.env[key] = val;
      }
    }
  }
}

async function testDatabaseConnection() {
  loadEnv();
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL not found');
    process.exit(1);
  }
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: true },
    connectionTimeoutMillis: 10000,
  });
  try {
    const result = await pool.query('SELECT NOW() as current_time, version() as db_version');
    const utcTime = result.rows[0].current_time;
    const nzTime = DateTime.fromJSDate(new Date(utcTime))
      .setZone('Pacific/Auckland')
      .toFormat('yyyy-MM-dd HH:mm:ss ZZZZ');
    console.log('Connected successfully');
    console.log('Server Time (UTC):', utcTime);
    console.log('NZ Time:', nzTime);
    console.log('Database:', result.rows[0].db_version.substring(0, 60));
  } catch (error: any) {
    console.error('Database connection test FAILED', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testDatabaseConnection();

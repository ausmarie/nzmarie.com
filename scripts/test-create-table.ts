import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { Pool } from 'pg';

function loadEnv() {
  const envPath = join(process.cwd(), '.env');
  if (existsSync(envPath)) {
    const envContent = readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const index = trimmed.indexOf('=');
      if (index > 0) {
        const key = trimmed.substring(0, index).trim();
        const val = trimmed.substring(index + 1).trim();
        process.env[key] = val;
      }
    }
  }
}

loadEnv();

const marieDB = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
});

async function testCreate() {
  try {
    console.log('Creating report_downloads table...');
    await marieDB.query(`
      CREATE TABLE IF NOT EXISTS report_downloads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        suburb VARCHAR(100) NOT NULL,
        report_type VARCHAR(50) DEFAULT 'local_market',
        downloaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        source VARCHAR(50),
        campaign_id UUID,
        tracking_code VARCHAR(50),
        user_agent TEXT,
        ip_address VARCHAR(45),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    console.log('✅ Table created successfully');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await marieDB.end();
  }
}

testCreate();

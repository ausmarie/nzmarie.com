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

async function checkTables() {
  try {
    const result = await marieDB.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('✅ Existing tables in Marie DB:');
    result.rows.forEach(row => console.log(`  - ${row.table_name}`));
    
    // Check for new admin tables
    const adminTables = [
      'report_downloads',
      'direct_mail_campaigns',
      'direct_mail_addresses',
      'outreach_tasks',
      'suburb_reports'
    ];
    
    console.log('\n🔍 Checking for new admin tables:');
    for (const tableName of adminTables) {
      const exists = result.rows.some(row => row.table_name === tableName);
      console.log(`  ${exists ? '✅' : '❌'} ${tableName}`);
    }
    
  } catch (error: any) {
    console.error('Error:', error.message);
  } finally {
    await marieDB.end();
  }
}

checkTables();

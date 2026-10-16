const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DB_URL = 'postgresql://nzmarie:HHa_pWigbE_OcEX83FNRPg@baby-centaur-27756.j77.aws-ap-southeast-1.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full';

const migrationFile = path.join(__dirname, '../database/migrations/035_activity_ru_optimization.sql');

async function run() {
  const c = new Client({ connectionString: DB_URL });
  await c.connect();
  console.log('Connected to CockroachDB.');

  const sql = fs.readFileSync(migrationFile, 'utf8');

  const statements = sql
    .split(';')
    .map(s => s.replace(/--[^\n]*/g, '').trim())
    .filter(s => s.length > 0);

  console.log(`Running ${statements.length} SQL statements...\n`);

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const preview = stmt.split('\n').find(l => l.trim().length > 0) || stmt.slice(0, 80);
    try {
      await c.query(stmt);
      console.log(`[${i + 1}/${statements.length}] OK: ${preview.trim()}`);
    } catch (e) {
      if (e.message.includes('already exists')) {
        console.log(`[${i + 1}/${statements.length}] SKIP (already exists): ${preview.trim()}`);
      } else {
        console.error(`[${i + 1}/${statements.length}] ERROR: ${preview.trim()}`);
        console.error(`  -> ${e.message}`);
      }
    }
  }

  await c.end();
  console.log('\nMigration complete.');
}

run().catch(e => { console.error('Fatal:', e.message); process.exit(1); });

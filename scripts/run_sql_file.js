#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });
const { Client } = require('pg');

async function main() {
  const rawArgs = process.argv.slice(2);
  let file;
  for (let i = 0; i < rawArgs.length; i++) {
    const a = rawArgs[i];
    if (a === '--file' || a === '-f') {
      file = rawArgs[i + 1];
      break;
    } else if (a.startsWith('--file=')) {
      file = a.split('=')[1];
      break;
    }
  }
  if (!file) {
    console.error('Usage: node run_sql_file.js --file path/to/file.sql');
    process.exit(2);
  }
  const fullPath = path.resolve(process.cwd(), file);
  if (!fs.existsSync(fullPath)) {
    console.error('SQL file not found:', fullPath);
    process.exit(2);
  }
  const sql = fs.readFileSync(fullPath, 'utf8');

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL not set in .env');
    process.exit(2);
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  // Split statements by semicolon for sequential execution (simple splitter)
  const parts = sql
    .split(/;\s*\n/)
    .map(s => s.trim())
    .filter(Boolean);

  for (let i = 0; i < parts.length; i++) {
    const stmt = parts[i];
    if (!stmt) continue;
    try {
      const res = await client.query(stmt);
      if (res.command === 'SELECT') {
        console.log('\n--- QUERY RESULT (first 20 rows) ---');
        console.log(JSON.stringify(res.rows.slice(0, 20), null, 2));
        console.log('rows_count:', res.rowCount);
      } else {
        console.log(`\n--- COMMAND: ${res.command} / ${res.rowCount} rows affected ---`);
      }
    } catch (err) {
      console.error('\nERROR executing statement:', err.message || err);
      console.error('Failed statement snippet:', stmt.slice(0, 200));
      await client.end();
      process.exit(3);
    }
  }

  await client.end();
  console.log('\nAll statements executed. (Dry-run/preview SQL typically only SELECTs)');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

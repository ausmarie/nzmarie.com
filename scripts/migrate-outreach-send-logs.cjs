#!/usr/bin/env node
require('dotenv').config({ path: '.env' });
const { Client } = require('pg');

const connStr = process.env.DATABASE_URL;

async function exec(label, sql) {
  const client = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    await client.query(sql);
    console.log(`  OK: ${label}`);
  } catch (err) {
    if (
      err.code === '42701' ||
      err.code === '42P07' ||
      err.message?.includes('already exists')
    ) {
      console.log(`  SKIP (already exists): ${label}`);
    } else {
      console.error(`  ERROR: ${label}:`, err.message);
      throw err;
    }
  } finally {
    await client.end();
  }
}

async function query(sql) {
  const client = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    return await client.query(sql);
  } finally {
    await client.end();
  }
}

async function run() {
  const host = connStr?.split('@')[1]?.split('/')[0];
  console.log(`Connected: ${host}\n`);

  console.log('[1/4] outreach_properties — add columns (one connection each)');
  await exec('last_sent_at',     `ALTER TABLE outreach_properties ADD COLUMN IF NOT EXISTS last_sent_at TIMESTAMPTZ`);
  await exec('total_send_count', `ALTER TABLE outreach_properties ADD COLUMN IF NOT EXISTS total_send_count INT DEFAULT 0`);
  await exec('last_campaign',    `ALTER TABLE outreach_properties ADD COLUMN IF NOT EXISTS last_campaign VARCHAR(100)`);

  console.log('\n[2/4] outreach_send_logs — create table');
  await exec('CREATE outreach_send_logs', `
    CREATE TABLE IF NOT EXISTS outreach_send_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      outreach_property_id UUID NOT NULL REFERENCES outreach_properties(id) ON DELETE CASCADE,
      suburb_report_id UUID REFERENCES suburb_reports(id) ON DELETE SET NULL,
      report_title VARCHAR(255) NOT NULL,
      campaign_key VARCHAR(100) NOT NULL,
      suburb VARCHAR(100) NOT NULL,
      sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      sent_by VARCHAR(255) NOT NULL,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);

  console.log('\n[3/4] outreach_send_logs — indexes');
  await exec('idx_send_logs_property', `CREATE INDEX IF NOT EXISTS idx_send_logs_property ON outreach_send_logs(outreach_property_id)`);
  await exec('idx_send_logs_campaign', `CREATE INDEX IF NOT EXISTS idx_send_logs_campaign ON outreach_send_logs(campaign_key)`);
  await exec('idx_send_logs_suburb',   `CREATE INDEX IF NOT EXISTS idx_send_logs_suburb ON outreach_send_logs(suburb)`);
  await exec('idx_send_logs_sent_at',  `CREATE INDEX IF NOT EXISTS idx_send_logs_sent_at ON outreach_send_logs(sent_at DESC)`);

  console.log('\n[4/4] outreach_qr_tokens — send_log_id');
  await exec('send_log_id column', `ALTER TABLE outreach_qr_tokens ADD COLUMN IF NOT EXISTS send_log_id UUID REFERENCES outreach_send_logs(id) ON DELETE CASCADE`);
  await exec('idx_qr_send_log',    `CREATE INDEX IF NOT EXISTS idx_qr_send_log ON outreach_qr_tokens(send_log_id)`);

  console.log('\n--- VERIFY ---');

  const r1 = await query(`
    SELECT column_name, data_type, column_default
    FROM information_schema.columns
    WHERE table_name = 'outreach_properties'
      AND column_name IN ('last_sent_at','total_send_count','last_campaign')
    ORDER BY column_name`);
  console.log('\noutreach_properties new columns:');
  r1.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type}  default=${r.column_default}`));
  if (r1.rows.length < 3) console.warn('  WARNING: expected 3 columns, got', r1.rows.length);

  const r2 = await query(`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_name = 'outreach_send_logs' ORDER BY ordinal_position`);
  console.log(`\noutreach_send_logs (${r2.rows.length} columns):`);
  r2.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type}`));

  const r3 = await query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'outreach_qr_tokens' AND column_name = 'send_log_id'`);
  console.log(`\noutreach_qr_tokens.send_log_id: ${r3.rows.length > 0 ? 'EXISTS ✓' : 'MISSING ✗'}`);

  const r4 = await query(`
    SELECT tablename, indexname FROM pg_indexes
    WHERE tablename IN ('outreach_send_logs','outreach_qr_tokens','outreach_properties')
      AND indexname LIKE 'idx_send%' OR indexname LIKE 'idx_qr_send%'
    ORDER BY tablename, indexname`);
  console.log('\nNew indexes:');
  r4.rows.forEach(r => console.log(`  [${r.tablename}] ${r.indexname}`));

  console.log('\nMigration complete ✓');
}

run().catch(err => {
  console.error('\nFailed:', err.message);
  process.exit(1);
});

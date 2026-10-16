const { Client } = require('pg');

const DB_URL = 'postgresql://nzmarie:HHa_pWigbE_OcEX83FNRPg@baby-centaur-27756.j77.aws-ap-southeast-1.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full';

async function run() {
  const c = new Client({ connectionString: DB_URL });
  await c.connect();
  console.log('Connected to CockroachDB.');

  // Check pg_trgm
  try {
    const ext = await c.query("SELECT name FROM pg_available_extensions WHERE name = 'pg_trgm'");
    console.log('pg_trgm available:', ext.rows.length > 0 ? 'YES' : 'NO');
  } catch (e) {
    console.log('pg_available_extensions not supported:', e.message);
  }

  // Check if properties table exists (needed for the index)
  try {
    const pt = await c.query("SELECT table_name FROM information_schema.tables WHERE table_name = 'properties'");
    console.log('properties table exists:', pt.rows.length > 0 ? 'YES' : 'NO');
  } catch (e) {
    console.log('Error checking properties table:', e.message);
  }

  // Check if outreach_send_logs table exists
  try {
    const ot = await c.query("SELECT table_name FROM information_schema.tables WHERE table_name = 'outreach_send_logs'");
    console.log('outreach_send_logs table exists:', ot.rows.length > 0 ? 'YES' : 'NO');
  } catch (e) {
    console.log('Error checking outreach_send_logs table:', e.message);
  }

  await c.end();
}

run().catch(e => { console.error('Fatal:', e.message); process.exit(1); });

// scripts/check-marie-db.js
// Check Marie DB current state

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load .env file manually
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=:#]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

const marieDB = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
});

async function checkTables() {
  try {
    console.log('Connecting to Marie DB...\n');
    
    // Check existing tables
    const result = await marieDB.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log('=== Existing Tables in Marie DB ===');
    result.rows.forEach(row => console.log('  -', row.table_name));
    console.log('');
    
    // Check if new tables exist
    console.log('=== New Tables Status ===');
    const newTables = ['direct_mail_campaigns', 'direct_mail_addresses'];
    for (const table of newTables) {
      const check = await marieDB.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = $1
        )`,
        [table]
      );
      const status = check.rows[0].exists ? '✅ EXISTS' : '❌ MISSING';
      console.log(`  ${status}: ${table}`);
    }
    
    // Check appraisal_leads for suburb column
    console.log('\n=== appraisal_leads Table ===');
    const suburbCheck = await marieDB.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'appraisal_leads' AND column_name = 'suburb'
    `);
    const suburbStatus = suburbCheck.rows.length > 0 ? '✅ EXISTS' : '❌ MISSING';
    console.log(`  ${suburbStatus}: suburb column`);
    
    // Check report_downloads structure
    const rdExists = await marieDB.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'report_downloads'
      )
    `);
    
    if (rdExists.rows[0].exists) {
      const rdColumns = await marieDB.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'report_downloads'
        ORDER BY ordinal_position
      `);
      console.log('\n=== report_downloads Columns ===');
      rdColumns.rows.forEach(row => console.log('  -', row.column_name));
      
      // Check for new columns
      const newColumns = ['name', 'phone', 'tracking_code'];
      console.log('\nNew columns needed:');
      for (const col of newColumns) {
        const exists = rdColumns.rows.some(r => r.column_name === col);
        console.log(`  ${exists ? '✅' : '❌'}: ${col}`);
      }
    }
    
    // Count data in key tables
    console.log('\n=== Data Counts ===');
    const tables = ['admin_users', 'appraisal_leads', 'report_downloads', 'suburb_reports'];
    for (const table of tables) {
      try {
        const count = await marieDB.query(`SELECT COUNT(*) FROM ${table}`);
        console.log(`  ${table}: ${count.rows[0].count} rows`);
      } catch (e) {
        console.log(`  ${table}: ❌ table does not exist`);
      }
    }
    
    // Check for functions
    console.log('\n=== Functions ===');
    const funcCheck = await marieDB.query(`
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_schema = 'public' 
      AND routine_name = 'check_download_limit'
    `);
    const funcStatus = funcCheck.rows.length > 0 ? '✅ EXISTS' : '❌ MISSING';
    console.log(`  ${funcStatus}: check_download_limit()`);
    
    console.log('\n✅ Check complete!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await marieDB.end();
  }
}

checkTables();

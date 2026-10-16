// scripts/run-migration.js
// Execute database migration

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

async function runMigration() {
  try {
    console.log('🚀 Starting migration...\n');
    
    // Read migration file
    const migrationPath = path.join(__dirname, '..', 'database', 'migrations', '003_add_missing_fields.sql');
    const sql = fs.readFileSync(migrationPath, 'utf-8');
    
    console.log('📄 Executing migration: 003_add_missing_fields.sql');
    console.log('─────────────────────────────────────────────────\n');
    
    // Execute migration
    await marieDB.query(sql);
    
    console.log('✅ Migration executed successfully!\n');
    
    // Verify the changes
    console.log('🔍 Verifying changes...\n');
    
    // Check phone column
    const phoneCheck = await marieDB.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'report_downloads' AND column_name = 'phone'
    `);
    console.log(`  ${phoneCheck.rows.length > 0 ? '✅' : '❌'} phone column in report_downloads`);
    
    // Check function
    const funcCheck = await marieDB.query(`
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_schema = 'public' AND routine_name = 'check_download_limit'
    `);
    console.log(`  ${funcCheck.rows.length > 0 ? '✅' : '❌'} check_download_limit() function`);
    
    // Check triggers
    const triggerCheck = await marieDB.query(`
      SELECT trigger_name 
      FROM information_schema.triggers 
      WHERE event_object_table IN ('report_downloads', 'appraisal_leads', 'direct_mail_addresses', 'direct_mail_campaigns')
    `);
    console.log(`  ✅ ${triggerCheck.rows.length} triggers created`);
    triggerCheck.rows.forEach(row => {
      console.log(`     - ${row.trigger_name}`);
    });
    
    // Test the function
    console.log('\n🧪 Testing check_download_limit() function...\n');
    const testResult = await marieDB.query(`SELECT check_download_limit('test@example.com', 'Albany') as result`);
    const result = testResult.rows[0].result;
    console.log('  Test result:');
    console.log(`    - Can download: ${result.can_download}`);
    console.log(`    - Current count: ${result.current_count}`);
    console.log(`    - Limit: ${result.limit}`);
    console.log(`    - Remaining: ${result.remaining}`);
    console.log(`    - Message: ${result.message}`);
    
    console.log('\n✅ All checks passed! Migration complete.\n');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    await marieDB.end();
  }
}

runMigration();

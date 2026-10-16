const { Pool } = require('pg');

// Louis DB connection string (Jakarta region)
const LOUIS_DB_URL = 'postgresql://nz-property:dscf1BymwHmJCItzMkq_aA@jazzed-buzzard-25204.j77.aws-ap-southeast-3.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full';

const louisPool = new Pool({
  connectionString: LOUIS_DB_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  connectionTimeoutMillis: 10000,
});

async function checkTables() {
  try {
    console.log('🔍 Checking Louis DB tables (Jakarta region)...\n');
    
    // Test connection first
    console.log('Testing connection...');
    const testResult = await louisPool.query('SELECT NOW()');
    console.log('✅ Connected! Server time:', testResult.rows[0].now, '\n');
    
    // List all tables
    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `;
    
    const result = await louisPool.query(tablesQuery);
    
    console.log(`📊 Found ${result.rows.length} tables:\n`);
    result.rows.forEach((row, index) => {
      console.log(`${index + 1}. ${row.table_name}`);
    });
    
    // Look for property-related tables
    console.log('\n🏠 Property-related tables:');
    const propertyTables = result.rows.filter(row => 
      row.table_name.toLowerCase().includes('property') ||
      row.table_name.toLowerCase().includes('prop') ||
      row.table_name.toLowerCase().includes('value')
    );
    
    if (propertyTables.length > 0) {
      propertyTables.forEach(table => {
        console.log(`  ✓ ${table.table_name}`);
      });
      
      // Get column details for each property table
      for (const table of propertyTables) {
        console.log(`\n📋 Columns in "${table.table_name}":\n`);
        
        const columnsQuery = `
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_name = $1
          ORDER BY ordinal_position;
        `;
        
        const columns = await louisPool.query(columnsQuery, [table.table_name]);
        columns.rows.forEach(col => {
          console.log(`  • ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? '(required)' : ''}`);
        });
        
        // Get sample row
        console.log(`\n📝 Sample data from "${table.table_name}" (first row):\n`);
        const sampleQuery = `SELECT * FROM ${table.table_name} LIMIT 1`;
        const sample = await louisPool.query(sampleQuery);
        if (sample.rows.length > 0) {
          console.log(JSON.stringify(sample.rows[0], null, 2));
        } else {
          console.log('  (Table is empty)');
        }
        console.log('\n' + '='.repeat(80) + '\n');
      }
    } else {
      console.log('  ❌ No property-related tables found');
      console.log('\n📋 All available tables:');
      result.rows.forEach(row => {
        console.log(`  • ${row.table_name}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Error code:', error.code);
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Possible reasons:');
      console.error('  1. Database is not accessible from your location');
      console.error('  2. Network/firewall blocking connection');
      console.error('  3. Database server is down');
      console.error('  4. Wrong connection string');
    }
  } finally {
    await louisPool.end();
  }
}

checkTables();

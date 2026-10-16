require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

console.log('DATABASE_URL loaded:', process.env.DATABASE_URL ? 'Yes' : 'No');

const marieDB = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
});

async function createOutreachTable() {
  const client = await marieDB.connect();
  
  try {
    console.log('Creating outreach_selected_properties table...');
    
    const sql = fs.readFileSync(path.join(__dirname, '..', 'database', 'create_outreach_table.sql'), 'utf8');
    
    await client.query(sql);
    
    console.log('✅ Successfully created outreach_selected_properties table');
    
    const result = await client.query(`
      SELECT table_name, column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'outreach_selected_properties'
      ORDER BY ordinal_position;
    `);
    
    console.log('\nTable structure:');
    result.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type} ${row.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
    });
    
    const indexResult = await client.query(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'outreach_selected_properties';
    `);
    
    console.log('\nIndexes created:');
    indexResult.rows.forEach(row => {
      console.log(`  ${row.indexname}`);
    });
    
  } catch (error) {
    console.error('❌ Error creating table:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await marieDB.end();
  }
}

createOutreachTable();
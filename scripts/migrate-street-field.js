/**
 * Migration Script: Populate Street Field
 * Purpose: Extract and populate street names from existing addresses
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  // Read environment variables
  require('dotenv').config({ path: '.env.local' });
  require('dotenv').config();

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL not found in environment');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    console.log('🔄 Starting migration 013: Populate Street Field...\n');

    // Read and execute the migration SQL
    const sqlPath = path.join(__dirname, '../database/migrations/013_populate_street_field.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    await pool.query(sql);

    // Get statistics
    const stats = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE street IS NOT NULL AND street != '') as with_street,
        COUNT(*) FILTER (WHERE street IS NULL OR street = '') as without_street,
        COUNT(*) as total
      FROM outreach_properties
    `);

    const { with_street, without_street, total } = stats.rows[0];

    console.log('\n✅ Migration 013 Complete!');
    console.log('─────────────────────────────');
    console.log(`   Total records: ${total}`);
    console.log(`   With street:   ${with_street} ✓`);
    console.log(`   Without street: ${without_street}`);
    console.log('─────────────────────────────\n');

    // Show sample results
    const samples = await pool.query(`
      SELECT property_address, street 
      FROM outreach_properties 
      WHERE street IS NOT NULL AND street != ''
      LIMIT 5
    `);

    if (samples.rows.length > 0) {
      console.log('📋 Sample extracted streets:');
      samples.rows.forEach((row, i) => {
        console.log(`   ${i + 1}. ${row.property_address}`);
        console.log(`      → Street: "${row.street}"`);
      });
      console.log('');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();

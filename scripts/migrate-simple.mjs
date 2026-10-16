/**
 * Simple Database Migration Script - No external dependencies except pg
 */

import pg from 'pg';
const { Pool } = pg;

const DATABASE_URL = 'postgresql://nzmarie:HHa_pWigbE_OcEX83FNRPg@baby-centaur-27756.j77.aws-ap-southeast-1.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full';

function extractStreetFromAddress(address) {
  // Remove leading number and optional unit
  let street = address.replace(/^\d+[A-Za-z]?(?:\/\d+)?\s+/, '');
  // Take everything before the first comma
  street = street.split(',')[0].trim();
  return street && street.length >= 3 ? street : null;
}

async function run() {
  console.log('🔄 Starting migration...\n');
  
  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    // Get properties without street
    const result = await pool.query(`
      SELECT id, property_address 
      FROM outreach_properties 
      WHERE street IS NULL OR street = ''
    `);

    console.log(`📊 Found ${result.rows.length} properties to update\n`);

    let updated = 0;
    let failed = 0;

    for (const prop of result.rows) {
      const street = extractStreetFromAddress(prop.property_address);
      
      if (street) {
        try {
          await pool.query(
            'UPDATE outreach_properties SET street = $1 WHERE id = $2',
            [street, prop.id]
          );
          updated++;
          console.log(`✓ ${prop.property_address} → "${street}"`);
        } catch (err) {
          failed++;
          console.error(`✗ Failed: ${prop.property_address}`);
        }
      } else {
        failed++;
      }
    }

    // Create indexes
    console.log('\n🔧 Creating indexes...');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_outreach_street ON outreach_properties(street)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_outreach_sort_order ON outreach_properties(suburb, street, created_at, property_address)');
    console.log('✓ Indexes created');

    // Get stats
    const stats = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE street IS NOT NULL AND street != '') as with_street,
        COUNT(*) as total
      FROM outreach_properties
    `);

    console.log('\n' + '='.repeat(40));
    console.log('✅ Migration Complete!');
    console.log('='.repeat(40));
    console.log(`Total records: ${stats.rows[0].total}`);
    console.log(`Updated: ${updated}`);
    console.log(`Failed: ${failed}`);
    console.log(`With street: ${stats.rows[0].with_street}`);
    console.log('='.repeat(40));

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

run().catch(console.error);

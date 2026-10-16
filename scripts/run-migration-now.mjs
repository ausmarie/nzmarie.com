/**
 * Direct Database Migration Script
 * Run with: node scripts/run-migration-now.mjs
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
const dotenv = require('dotenv');
const envLocalPath = join(__dirname, '../.env.local');
const envPath = join(__dirname, '../.env');

try {
  dotenv.config({ path: envLocalPath });
} catch (e) {
  console.log('No .env.local found, trying .env...');
}
dotenv.config({ path: envPath });

const pg = require('pg');
const { Pool } = pg;

async function extractStreetFromAddress(address) {
  // Remove leading number and optional unit (e.g., "5 ", "15A ", "123/456 ")
  let street = address.replace(/^\d+[A-Za-z]?(?:\/\d+)?\s+/, '');
  
  // Take everything before the first comma (to remove suburb, city, etc.)
  street = street.split(',')[0].trim();
  
  // Return null if empty or too short
  if (!street || street.length < 3) {
    return null;
  }
  
  return street;
}

async function runMigration() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL not found in environment');
    console.error('   Make sure .env.local or .env contains DATABASE_URL');
    process.exit(1);
  }

  console.log('🔄 Connecting to database...\n');
  
  const pool = new Pool({ 
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('sslmode=require') ? { rejectUnauthorized: false } : false
  });

  try {
    // Test connection
    await pool.query('SELECT NOW()');
    console.log('✅ Database connected\n');

    // Get all properties without street
    console.log('📊 Fetching properties without street...');
    const result = await pool.query(`
      SELECT id, property_address, street 
      FROM outreach_properties 
      WHERE street IS NULL OR street = ''
      ORDER BY created_at DESC
    `);

    const properties = result.rows;
    console.log(`   Found ${properties.length} properties to update\n`);

    if (properties.length === 0) {
      console.log('✅ All properties already have street names!');
      console.log('   No migration needed.\n');
      await pool.end();
      return;
    }

    let updated = 0;
    let failed = 0;
    const samples = [];

    console.log('🔧 Updating properties...\n');
    
    for (const prop of properties) {
      const street = await extractStreetFromAddress(prop.property_address);
      
      if (street) {
        try {
          await pool.query(
            'UPDATE outreach_properties SET street = $1, updated_at = NOW() WHERE id = $2',
            [street, prop.id]
          );
          updated++;
          
          if (samples.length < 5) {
            samples.push({ address: prop.property_address, street });
          }
          
          console.log(`   ✓ ${prop.property_address}`);
          console.log(`     → Street: "${street}"`);
        } catch (err) {
          failed++;
          console.error(`   ✗ Failed: ${prop.property_address}`, err.message);
        }
      } else {
        failed++;
        console.log(`   ⚠️  Could not extract: ${prop.property_address}`);
      }
    }

    // Create indexes
    console.log('\n🔧 Creating indexes...');
    
    try {
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_outreach_street ON outreach_properties(street);
      `);
      console.log('   ✓ idx_outreach_street');
    } catch (e) {
      console.log('   → idx_outreach_street already exists');
    }

    try {
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_outreach_sort_order 
        ON outreach_properties(suburb, street, created_at, property_address);
      `);
      console.log('   ✓ idx_outreach_sort_order');
    } catch (e) {
      console.log('   → idx_outreach_sort_order already exists');
    }

    // Get final statistics
    const stats = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE street IS NOT NULL AND street != '') as with_street,
        COUNT(*) FILTER (WHERE street IS NULL OR street = '') as without_street,
        COUNT(*) as total
      FROM outreach_properties
    `);

    const { with_street, without_street, total } = stats.rows[0];

    console.log('\n' + '═'.repeat(50));
    console.log('✅ Migration Complete!');
    console.log('═'.repeat(50));
    console.log(`   Total records:      ${total}`);
    console.log(`   Updated now:        ${updated} ✓`);
    console.log(`   Failed:             ${failed}`);
    console.log(`   With street:        ${with_street}`);
    console.log(`   Without street:     ${without_street}`);
    console.log('═'.repeat(50));
    
    if (samples.length > 0) {
      console.log('\n📋 Sample results:');
      samples.forEach((s, i) => {
        console.log(`   ${i + 1}. ${s.address}`);
        console.log(`      → "${s.street}"`);
      });
    }
    
    console.log('\n🎉 All done! You can now refresh the Outreach page.');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migration
runMigration().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});

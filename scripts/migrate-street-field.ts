/**
 * Migration Script: Populate Street Field
 * Usage: npx tsx scripts/migrate-street-field.ts
 */

import { marieDB } from '../lib/db';

async function extractStreetFromAddress(address: string): Promise<string | null> {
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
  console.log('🔄 Starting migration: Populate Street Field...\n');

  try {
    // Get all properties without street
    const result = await marieDB.query(`
      SELECT id, property_address, street 
      FROM outreach_properties 
      WHERE street IS NULL OR street = ''
      ORDER BY created_at DESC
    `);

    const properties = result.rows;
    console.log(`📊 Found ${properties.length} properties without street\n`);

    let updated = 0;
    let failed = 0;

    for (const prop of properties) {
      const street = await extractStreetFromAddress(prop.property_address);
      
      if (street) {
        try {
          await marieDB.query(
            'UPDATE outreach_properties SET street = $1 WHERE id = $2',
            [street, prop.id]
          );
          updated++;
          console.log(`✓ ${prop.property_address}`);
          console.log(`  → Street: "${street}"`);
        } catch (err) {
          failed++;
          console.error(`✗ Failed to update: ${prop.property_address}`);
        }
      } else {
        console.log(`⚠️  Could not extract street from: ${prop.property_address}`);
        failed++;
      }
    }

    // Get final statistics
    const stats = await marieDB.query(`
      SELECT 
        COUNT(*) FILTER (WHERE street IS NOT NULL AND street != '') as with_street,
        COUNT(*) FILTER (WHERE street IS NULL OR street = '') as without_street,
        COUNT(*) as total
      FROM outreach_properties
    `);

    const { with_street, without_street, total } = stats.rows[0];

    console.log('\n✅ Migration Complete!');
    console.log('═══════════════════════════════');
    console.log(`   Total records:     ${total}`);
    console.log(`   Updated:           ${updated} ✓`);
    console.log(`   Failed:            ${failed}`);
    console.log(`   With street:       ${with_street}`);
    console.log(`   Without street:    ${without_street}`);
    console.log('═══════════════════════════════\n');

    // Create index if not exists
    console.log('🔧 Creating indexes...');
    await marieDB.query(`
      CREATE INDEX IF NOT EXISTS idx_outreach_street ON outreach_properties(street);
      CREATE INDEX IF NOT EXISTS idx_outreach_sort_order 
      ON outreach_properties(suburb, street, created_at, property_address);
    `);
    console.log('✓ Indexes created\n');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run migration
runMigration()
  .then(() => {
    console.log('🎉 All done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { marieDB } from '@/lib/db';
import { isAdmin } from '@/lib/permissions';

/**
 * POST /api/admin/migrate-streets
 * Extract and populate street names from existing addresses
 */
export async function POST() {
  const session = await auth();

  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('🔄 Starting street migration...');

    // Function to extract street name
    function extractStreetFromAddress(address: string): string | null {
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

    // Get all properties without street
    const result = await marieDB.query(`
      SELECT id, property_address, street 
      FROM outreach_properties 
      WHERE street IS NULL OR street = ''
      ORDER BY created_at DESC
    `);

    const properties = result.rows;
    const total = properties.length;
    let updated = 0;
    let failed = 0;
    const samples: Array<{ address: string; street: string }> = [];

    for (const prop of properties) {
      const street = extractStreetFromAddress(prop.property_address);
      
      if (street) {
        try {
          await marieDB.query(
            'UPDATE outreach_properties SET street = $1, updated_at = NOW() WHERE id = $2',
            [street, prop.id]
          );
          updated++;
          if (samples.length < 5) {
            samples.push({ address: prop.property_address, street });
          }
        } catch (err) {
          failed++;
          console.error(`Failed to update: ${prop.property_address}`, err);
        }
      } else {
        failed++;
      }
    }

    // Create indexes if not exist
    await marieDB.query(`
      CREATE INDEX IF NOT EXISTS idx_outreach_street ON outreach_properties(street);
    `);

    await marieDB.query(`
      CREATE INDEX IF NOT EXISTS idx_outreach_sort_order 
      ON outreach_properties(suburb, street, created_at, property_address);
    `);

    // Get final statistics
    const stats = await marieDB.query(`
      SELECT 
        COUNT(*) FILTER (WHERE street IS NOT NULL AND street != '') as with_street,
        COUNT(*) FILTER (WHERE street IS NULL OR street = '') as without_street,
        COUNT(*) as total
      FROM outreach_properties
    `);

    const { with_street, without_street, total: totalRecords } = stats.rows[0];

    return NextResponse.json({
      success: true,
      message: 'Street migration completed',
      stats: {
        totalProcessed: total,
        updated,
        failed,
        totalRecords: parseInt(totalRecords),
        withStreet: parseInt(with_street),
        withoutStreet: parseInt(without_street),
      },
      samples,
    });
  } catch (error) {
    console.error('Street migration error:', error);
    return NextResponse.json(
      { error: 'Migration failed', details: (error as Error).message },
      { status: 500 }
    );
  }
}

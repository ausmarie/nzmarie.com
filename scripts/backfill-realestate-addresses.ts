import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const index = trimmed.indexOf('=');
      if (index > 0) {
        const key = trimmed.substring(0, index).trim();
        const val = trimmed.substring(index + 1).trim();
        process.env[key] = val;
      }
    }
  }
}

function parseAddress(fullAddress: string): { street: string; suburb: string | null; city: string | null } {
  if (!fullAddress) return { street: '', suburb: null, city: null };
  const parts = fullAddress.split(',').map(p => p.trim()).filter(Boolean);
  if (parts.length >= 3) {
    const city = parts.pop() || null;
    const suburb = parts.pop() || null;
    const street = parts.join(', ');
    return { street, suburb, city };
  }
  if (parts.length === 2) {
    const city = parts.pop() || null;
    return { street: parts[0], suburb: null, city };
  }
  return { street: parts[0] || fullAddress, suburb: null, city: null };
}

async function main() {
  loadEnv();

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ DATABASE_URL not found');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log('🔍 Fetching all real_estate rows...');
    const result = await pool.query(`
      SELECT id, address, region FROM real_estate WHERE address IS NOT NULL AND address != ''
    `);
    console.log(`Found ${result.rows.length} rows\n`);

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const row of result.rows) {
      const parsed = parseAddress(row.address);
      if (!parsed.suburb && !parsed.city) {
        skipped++;
        continue;
      }
      try {
        await pool.query(
          `UPDATE real_estate SET address = $1, suburb = $2, city = $3 WHERE id = $4`,
          [parsed.street, parsed.suburb, parsed.city, row.id]
        );
        updated++;
        if (updated <= 5 || updated % 200 === 0) {
          console.log(`  ✓ [${updated}] "${row.address}" → street="${parsed.street}", suburb="${parsed.suburb}", city="${parsed.city}"`);
        }
      } catch (err) {
        console.error(`  ✗ Error updating ${row.id}:`, err);
        errors++;
      }
    }

    console.log(`\n✅ Done! Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}`);

    // Verify
    const verify = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(suburb) as has_suburb,
        COUNT(city) as has_city
      FROM real_estate
    `);
    console.log(`Verification - Total: ${verify.rows[0].total}, Has suburb: ${verify.rows[0].has_suburb}, Has city: ${verify.rows[0].has_city}`);

  } catch (err) {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();

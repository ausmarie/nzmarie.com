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

async function main() {
  loadEnv();

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL not found');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    // Step 1: Update address and extract suburb for rows with comma separator
    console.log('Extracting suburb from address...');
    const result1 = await pool.query(`
      UPDATE real_estate_rent SET
        suburb = TRIM(SPLIT_PART(address, ',', 2)),
        address = TRIM(SPLIT_PART(address, ',', 1))
      WHERE address LIKE '%,%' AND suburb IS NULL
    `);
    console.log(`  Updated ${result1.rowCount} rows with suburb\n`);

    // Step 2: Set city from region (title-case)
    console.log('Setting city from region...');
    const result2 = await pool.query(`
      UPDATE real_estate_rent SET
        city = INITCAP(region)
      WHERE city IS NULL AND region IS NOT NULL
    `);
    console.log(`  Updated ${result2.rowCount} rows with city\n`);

    // Verify
    const verify = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(suburb) as has_suburb,
        COUNT(city) as has_city,
        COUNT(car_spaces) as has_car_spaces
      FROM real_estate_rent
    `);
    console.log(`Verification:`);
    console.log(`  Total: ${verify.rows[0].total}`);
    console.log(`  Has suburb: ${verify.rows[0].has_suburb}`);
    console.log(`  Has city: ${verify.rows[0].has_city}`);
    console.log(`  Has car_spaces: ${verify.rows[0].has_car_spaces}`);

  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();

#!/usr/bin/env ts-node
/**
 * Run migration 039: create + populate street_locations.
 * Safe to run repeatedly (idempotent).
 *
 * Usage: npx tsx scripts/migrate-street-locations.ts
 */
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
    console.error('❌ DATABASE_URL not found in environment');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const filePath = path.join(process.cwd(), 'database', 'migrations', '039_create_street_locations.sql');
    const sql = fs.readFileSync(filePath, 'utf8');

    console.log('⚙️  Running migration 039_create_street_locations.sql ...');
    await pool.query(sql);
    console.log('✅ Migration applied\n');

    const count = await pool.query('SELECT COUNT(*) AS total FROM street_locations');
    console.log(`📍 street_locations rows: ${count.rows[0].total}`);

    const sample = await pool.query(`
      SELECT suburb, street, ROUND(center_lat::numeric, 5) AS lat, ROUND(center_lng::numeric, 5) AS lng, property_count
      FROM street_locations
      WHERE source = 'properties'
      ORDER BY property_count DESC
      LIMIT 10
    `);
    console.log('\nSample rows (top by property_count):');
    for (const r of sample.rows) {
      console.log(`  ${r.suburb} | ${r.street} | ${r.lat}, ${r.lng} | ${r.property_count} props`);
    }

    const noCoords = await pool.query(`
      SELECT COUNT(DISTINCT op.street) AS missing
      FROM outreach_properties op
      WHERE op.street IS NOT NULL AND TRIM(op.street) <> ''
        AND NOT EXISTS (
          SELECT 1 FROM street_locations sl
          WHERE sl.suburb = op.suburb AND sl.street = op.street
        )
    `);
    console.log(`\n⚠️  Streets with no coordinates (candidates for geocoding): ${noCoords.rows[0].missing}`);
  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();

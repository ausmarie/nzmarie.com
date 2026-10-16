/**
 * DB optimization DDL script.
 * Run: node scripts/db-optimize.mjs
 *
 * Steps:
 *   1. Sample addresses to verify the street_name extraction expression
 *   2. Add street_name generated column to properties table
 *   3. Create composite index (LOWER(suburb), street_name)
 *   4. Create LOWER(suburb) functional index
 */

import pg from 'pg';
import { readFileSync } from 'fs';

// Load DATABASE_URL from .env
const envContent = readFileSync('.env', 'utf8');
const dbUrlMatch = envContent.match(/^DATABASE_URL=(.+)$/m);
if (!dbUrlMatch) { console.error('DATABASE_URL not found in .env'); process.exit(1); }
const DATABASE_URL = dbUrlMatch[1].trim();

const pool = new pg.Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  const client = await pool.connect();
  try {
    // ── Step 1: sample addresses to verify extraction expression ──────────────
    console.log('\n=== Step 1: Sample address → street_name extraction ===');
    const sample = await client.query(`
      SELECT
        address,
        TRIM(
          REGEXP_REPLACE(
            REGEXP_REPLACE(
              RTRIM(REGEXP_REPLACE(address, E'\\\\d{7,}$', '')),
              E'^[0-9]+[A-Za-z]?(?:[-/][0-9]+[A-Za-z]?)*\\\\s+', '', 'g'
            ),
            E'^[0-9]+[0-9A-Za-z]*\\\\s*', '', 'g'
          )
        ) AS street_name_preview
      FROM properties
      WHERE LOWER(suburb) = 'torbay'
      ORDER BY address ASC
      LIMIT 20
    `);
    sample.rows.forEach(r => console.log(`  "${r.address}"  →  "${r.street_name_preview}"`));

    // ── Step 2: check if street_name column already exists ────────────────────
    console.log('\n=== Step 2: Check existing columns ===');
    const colCheck = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'properties' AND column_name = 'street_name'
    `);
    if (colCheck.rows.length > 0) {
      console.log('  street_name column already exists, skipping ADD COLUMN');
    } else {
      console.log('  Adding street_name generated column...');
      await client.query(`
        ALTER TABLE properties
        ADD COLUMN street_name TEXT
          GENERATED ALWAYS AS (
            TRIM(
              REGEXP_REPLACE(
                REGEXP_REPLACE(
                  RTRIM(REGEXP_REPLACE(address, E'\\d{7,}$', '')),
                  E'^[0-9]+[A-Za-z]?(?:[-/][0-9]+[A-Za-z]?)*\\s+', '', 'g'
                ),
                E'^[0-9]+[0-9A-Za-z]*\\s*', '', 'g'
              )
            )
          ) STORED
      `);
      console.log('  ✓ street_name column added');
    }

    // ── Step 3: composite index (LOWER(suburb), street_name) ─────────────────
    console.log('\n=== Step 3: Create composite index idx_properties_suburb_street ===');
    const idxCheck1 = await client.query(`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'properties' AND indexname = 'idx_properties_suburb_street'
    `);
    if (idxCheck1.rows.length > 0) {
      console.log('  idx_properties_suburb_street already exists, skipping');
    } else {
      console.log('  Creating idx_properties_suburb_street... (may take a moment on large tables)');
      await client.query(`
        CREATE INDEX idx_properties_suburb_street
        ON properties (LOWER(suburb), street_name)
      `);
      console.log('  ✓ idx_properties_suburb_street created');
    }

    // ── Step 4: LOWER(suburb) functional index ────────────────────────────────
    console.log('\n=== Step 4: Create functional index idx_properties_suburb_lower ===');
    const idxCheck2 = await client.query(`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'properties' AND indexname = 'idx_properties_suburb_lower'
    `);
    if (idxCheck2.rows.length > 0) {
      console.log('  idx_properties_suburb_lower already exists, skipping');
    } else {
      console.log('  Creating idx_properties_suburb_lower...');
      await client.query(`
        CREATE INDEX idx_properties_suburb_lower
        ON properties (LOWER(suburb))
      `);
      console.log('  ✓ idx_properties_suburb_lower created');
    }

    // ── Step 5: verify ────────────────────────────────────────────────────────
    console.log('\n=== Step 5: Verify ===');
    const verify = await client.query(`
      SELECT
        address,
        street_name
      FROM properties
      WHERE LOWER(suburb) = 'torbay'
      ORDER BY address ASC
      LIMIT 10
    `);
    verify.rows.forEach(r => console.log(`  "${r.address}"  →  "${r.street_name}"`));

    const idxList = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'properties'
        AND indexname IN ('idx_properties_suburb_street','idx_properties_suburb_lower')
    `);
    console.log('\n  Indexes created:');
    idxList.rows.forEach(r => console.log(`    ${r.indexname}: ${r.indexdef}`));

    console.log('\n✅ All DDL steps completed successfully.');
  } catch (err) {
    console.error('\n❌ DDL error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();

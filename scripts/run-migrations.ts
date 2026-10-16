#!/usr/bin/env ts-node
/**
 * Run all database migrations
 * 
 * This script executes all SQL migration files in order and verifies
 * that all required tables exist.
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
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

async function runMigrations() {
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
    console.log('🔄 Starting database migrations...\n');

    // Get all migration files
    const migrationsDir = path.join(process.cwd(), 'database', 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql') && !f.startsWith('000_'))
      .sort();

    console.log(`📁 Found ${files.length} migration files\n`);

    // Execute each migration
    async function runMigrationFile(file: string, sql: string) {
      const maxAttempts = 3;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          await pool.query(sql);
          console.log(`✅ ${file} completed\n`);
          return;
        } catch (error: any) {
          const message = error?.message ?? '';
          const isRetryable = /TransactionRetryWithProtoRefreshError|TransactionRetryError|restart transaction/i.test(message);
          const isAlreadyApplied = message.includes('already exists') || message.includes('duplicate');

          if (isAlreadyApplied) {
            console.log(`✓  ${file} (already applied)\n`);
            return;
          }

          if (isRetryable && attempt < maxAttempts) {
            console.warn(`⚠️  Retryable error running ${file} (attempt ${attempt}): ${message}`);
            await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
            continue;
          }

          console.error(`❌ Error in ${file}:`, message);
          return;
        }
      }
    }

    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');
      
      // Skip if file is empty or only contains comments
      if (!sql.trim() || sql.trim().startsWith('--') && !sql.includes('CREATE')) {
        console.log(`⏭️  Skipping ${file} (no SQL commands)`);
        continue;
      }

      console.log(`⚙️  Running ${file}...`);
      await runMigrationFile(file, sql);
    }

    // Verify all required tables exist
    console.log('\n🔍 Verifying tables...\n');

    const requiredTables = [
      'admin_users',
      'appraisal_leads',
      'report_downloads',
      'report_download_events',
      'direct_mail_campaigns',
      'direct_mail_addresses',
      'outreach_tasks',
      'suburb_reports',
    ];

    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = ANY($1)
      ORDER BY table_name
    `, [requiredTables]);

    const existingTables = result.rows.map(r => r.table_name);

    console.log('📊 Table Status:\n');
    for (const table of requiredTables) {
      if (existingTables.includes(table)) {
        console.log(`  ✅ ${table}`);
      } else {
        console.log(`  ❌ ${table} (missing)`);
      }
    }

    // Check for suburb column in appraisal_leads
    console.log('\n🔍 Checking appraisal_leads schema...\n');
    
    const columnsResult = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'appraisal_leads'
      ORDER BY ordinal_position
    `);

    const columns = columnsResult.rows.map(r => r.column_name);
    console.log('  Columns:', columns.join(', '));

    if (columns.includes('suburb')) {
      console.log('  ✅ suburb column exists');
    } else {
      console.log('  ⚠️  suburb column missing - run migration 009');
    }

    console.log('\n✨ Migration check completed successfully!\n');

  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migrations
runMigrations().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

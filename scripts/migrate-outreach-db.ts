import { marieDB } from '../lib/db';
import fs from 'fs';
import path from 'path';

async function runMigration() {
  console.log('Starting Outreach database migration...');

  try {
    const migration1 = fs.readFileSync(
      path.join(process.cwd(), 'database/migrations/001_create_outreach_properties.sql'),
      'utf8'
    );
    
    const migration2 = fs.readFileSync(
      path.join(process.cwd(), 'database/migrations/002_migrate_outreach_data.sql'),
      'utf8'
    );

    console.log('Running migration 001: Create outreach_properties table...');
    await marieDB.query(migration1);
    console.log('✓ Migration 001 completed');

    console.log('Running migration 002: Migrate existing data...');
    await marieDB.query(migration2);
    console.log('✓ Migration 002 completed');

    console.log('\n✅ All migrations completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Verify data in outreach_properties table');
    console.log('2. Test the Outreach page functionality');
    console.log('3. If everything works, you can drop outreach_selected_properties table');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();

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
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }
      const index = trimmed.indexOf('=');
      if (index > 0) {
        const key = trimmed.substring(0, index).trim();
        const val = trimmed.substring(index + 1).trim();
        process.env[key] = val;
      }
    }
  }
}

async function createOutreachTable() {
  loadEnv();
  
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL not found');
    process.exit(1);
  }
  
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 5,
  });

  try {
    console.log('Creating outreach_selected_properties table...');
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS outreach_selected_properties (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        
        louis_property_id UUID NOT NULL,
        property_address TEXT NOT NULL,
        suburb VARCHAR(100) NOT NULL,
        street VARCHAR(255),
        city VARCHAR(100),
        
        bedrooms INTEGER,
        bathrooms INTEGER,
        rv_value DECIMAL(10,2),
        
        status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'COMPLETED')),
        
        selected_by VARCHAR(255) NOT NULL,
        selected_at TIMESTAMPTZ DEFAULT NOW(),
        sent_by VARCHAR(255),
        sent_at TIMESTAMPTZ,
        
        tracking_code VARCHAR(50) UNIQUE,
        notes TEXT,
        
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_outreach_status ON outreach_selected_properties(status);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_outreach_suburb ON outreach_selected_properties(suburb);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_outreach_selected_at ON outreach_selected_properties(selected_at);`);
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_property_user ON outreach_selected_properties(louis_property_id, selected_by);`);
    
    await pool.query(`
      DROP TRIGGER IF EXISTS trigger_update_outreach_updated_at ON outreach_selected_properties;
    `);
    
    await pool.query(`
      CREATE OR REPLACE FUNCTION update_outreach_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    await pool.query(`
      CREATE TRIGGER trigger_update_outreach_updated_at
      BEFORE UPDATE ON outreach_selected_properties
      FOR EACH ROW EXECUTE FUNCTION update_outreach_updated_at();
    `);
    
    console.log('✅ Successfully created outreach_selected_properties table');
    
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'outreach_selected_properties'
      ORDER BY ordinal_position;
    `);
    
    console.log('\nTable structure:');
    result.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type} ${row.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
    });
    
    const indexResult = await pool.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'outreach_selected_properties';
    `);
    
    console.log('\nIndexes created:');
    indexResult.rows.forEach(row => {
      console.log(`  ${row.indexname}`);
    });
    
  } catch (error: any) {
    console.error('❌ Error creating table:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

createOutreachTable();
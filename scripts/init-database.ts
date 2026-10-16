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

async function initDatabase() {
  loadEnv();
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL not found');
    process.exit(1);
  }
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: true },
  });

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(150) NOT NULL UNIQUE,
        google_id VARCHAR(100) UNIQUE,
        name VARCHAR(100),
        avatar_url TEXT,
        role VARCHAR(20) NOT NULL DEFAULT 'admin',
        is_active BOOLEAN NOT NULL DEFAULT true,
        last_login_at TIMESTAMPTZ,
        login_count INTEGER DEFAULT 0,
        last_login_ip TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        created_by UUID REFERENCES admin_users(id),
        updated_at TIMESTAMPTZ DEFAULT now(),
        notes TEXT,
        CONSTRAINT valid_role CHECK (role IN ('super_admin', 'admin', 'viewer'))
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        admin_id UUID NOT NULL REFERENCES admin_users(id),
        action VARCHAR(50) NOT NULL,
        resource_type VARCHAR(50),
        resource_id UUID,
        details JSONB,
        ip_address TEXT,
        user_agent TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS market_reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        suburb VARCHAR(50) NOT NULL,
        version VARCHAR(50) NOT NULL,
        title VARCHAR(200) NOT NULL,
        r2_key TEXT NOT NULL UNIQUE,
        file_size BIGINT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT now()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS appraisal_leads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        client_name VARCHAR(100) NOT NULL,
        property_address TEXT NOT NULL,
        email VARCHAR(150) NOT NULL,
        email_hash VARCHAR(64) NOT NULL,
        phone VARCHAR(50) NOT NULL,
        timeline VARCHAR(50),
        motivation VARCHAR(100),
        language_preference VARCHAR(10),
        heard_from VARCHAR(100),
        status VARCHAR(20) NOT NULL DEFAULT 'Pending',
        agent_notes TEXT,
        follow_up_at TIMESTAMPTZ,
        source_page VARCHAR(100),
        utm_source VARCHAR(100),
        utm_medium VARCHAR(100),
        utm_campaign VARCHAR(100),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS report_download_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(150) NOT NULL,
        email_hash VARCHAR(64) NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        phone VARCHAR(50),
        suburb VARCHAR(50) NOT NULL,
        accept_monthly_newsletter BOOLEAN DEFAULT false,
        ip_hash VARCHAR(64) NOT NULL,
        user_agent TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await pool.query(`CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users (email);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_admin_users_active ON admin_users (is_active) WHERE is_active = true;`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin ON admin_audit_logs (admin_id, created_at DESC);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_appraisal_leads_status ON appraisal_leads (status, created_at DESC);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_appraisal_leads_email ON appraisal_leads (email);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_appraisal_leads_created_at ON appraisal_leads (created_at DESC);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_appraisal_leads_follow_up ON appraisal_leads (follow_up_at) WHERE follow_up_at IS NOT NULL AND status IN ('Pending', 'Contacted');`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS section_view_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        campaign_key VARCHAR(50),
        visitor_hash VARCHAR(64) NOT NULL,
        section_name VARCHAR(50) NOT NULL,
        is_new_device BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_section_view_campaign ON section_view_logs(campaign_key, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_section_view_visitor ON section_view_logs(visitor_hash, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_section_view_section ON section_view_logs(section_name, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_section_view_time ON section_view_logs(created_at DESC);
    `);

    const reportCount = await pool.query('SELECT COUNT(*) FROM market_reports');
    if (parseInt(reportCount.rows[0].count) === 0) {
      await pool.query(`
        INSERT INTO market_reports (suburb, version, title, r2_key, is_active)
        VALUES ('Northcross', '2026-Q2', 'Northcross Market Report', 'reports/Northcross/2026-Q2.pdf', true);
      `);
      console.log('Inserted default report data');
    }

    console.log('Database initialized successfully');
  } catch (error: any) {
    console.error('Database initialization FAILED', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

initDatabase();

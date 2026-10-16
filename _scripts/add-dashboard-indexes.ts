import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        process.env[trimmed.substring(0, idx).trim()] = trimmed.substring(idx + 1).trim();
      }
    }
  }
}

loadEnv();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const INDEXES = [
  // Dashboard: appraisal_leads follow-up queries
  'CREATE INDEX IF NOT EXISTS idx_leads_followup ON appraisal_leads (follow_up_at, contact_status)',
  // Dashboard: appraisal_leads high priority count
  'CREATE INDEX IF NOT EXISTS idx_leads_priority ON appraisal_leads (priority)',
  // Dashboard: outreach_selected_properties pending count
  'CREATE INDEX IF NOT EXISTS idx_outreach_status ON outreach_selected_properties (status)',
  // Dashboard: report_downloads today's downloads count
  'CREATE INDEX IF NOT EXISTS idx_reports_downloaded_at ON report_downloads (downloaded_at)',
];

async function main() {
  try {
    for (const sql of INDEXES) {
      console.log(`Running: ${sql}...`);
      await pool.query(sql);
      console.log('  OK');
    }

    console.log('\nRunning ANALYZE on affected tables...');
    await pool.query('ANALYZE appraisal_leads');
    await pool.query('ANALYZE outreach_selected_properties');
    await pool.query('ANALYZE report_downloads');
    console.log('  OK');

    const tables = ['appraisal_leads', 'outreach_selected_properties', 'report_downloads'];
    for (const table of tables) {
      const res = await pool.query('SHOW INDEXES FROM ' + table);
      console.log(`\nIndexes on ${table}:`);
      res.rows.forEach((r: { index_name: string; column_names: string[] }) =>
        console.log(' -', r.index_name, 'columns:', JSON.stringify(r.column_names))
      );
    }

    await pool.end();
    console.log('\nDone.');
  } catch (err) {
    console.error('Error:', (err as Error).message);
    process.exit(1);
  }
}

main();

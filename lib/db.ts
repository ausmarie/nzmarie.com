import { Pool, QueryResult, QueryResultRow } from 'pg';

const mariePool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 20,
});

export async function query<T extends QueryResultRow = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  return mariePool.query<T>(text, params);
}

export interface MarieDBPool extends Pool {
  ensureOutreachTablesExist?: () => Promise<void>;
}

export const marieDB: MarieDBPool = mariePool as MarieDBPool;
export const pool = mariePool;

let _outreachTableEnsured = false;

export async function ensureOutreachTablesExist(): Promise<void> {
  if (_outreachTableEnsured) return;
  try {
    const check = await mariePool.query(`
      SELECT
        (SELECT COUNT(*) FROM information_schema.tables
         WHERE table_name = 'outreach_send_logs' AND table_schema = 'public') AS logs_table,
        (SELECT COUNT(*) FROM information_schema.columns
         WHERE table_name = 'outreach_properties' AND column_name = 'last_sent_at') AS last_sent_col
    `);
    const row = check.rows[0];
    if (Number(row.logs_table) > 0 && Number(row.last_sent_col) > 0) {
      _outreachTableEnsured = true;
      return;
    }

    try {
      await mariePool.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
    } catch {
    }

    const sql = `
    CREATE TABLE IF NOT EXISTS outreach_properties (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      louis_property_id VARCHAR(100),
      property_id UUID,
      property_address TEXT NOT NULL,
      suburb VARCHAR(100) NOT NULL,
      city VARCHAR(100) NOT NULL,
      region VARCHAR(100) NOT NULL,
      street VARCHAR(200),
      owner_name VARCHAR(200),
      property_type VARCHAR(50),
      campaign VARCHAR(100) NOT NULL DEFAULT '2026_Q3_Report',
      status VARCHAR(50) NOT NULL DEFAULT 'pending',
      sent_at TIMESTAMP,
      sent_by VARCHAR(255),
      interacted_at TIMESTAMP,
      converted_at TIMESTAMP,
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      selected_by VARCHAR(255),
      selected_at TIMESTAMPTZ
    );

    CREATE INDEX IF NOT EXISTS idx_outreach_status ON outreach_properties(status);
    CREATE INDEX IF NOT EXISTS idx_outreach_suburb ON outreach_properties(suburb);
    CREATE INDEX IF NOT EXISTS idx_outreach_campaign ON outreach_properties(campaign);
    CREATE INDEX IF NOT EXISTS idx_outreach_property_id ON outreach_properties(property_id);
    CREATE INDEX IF NOT EXISTS idx_outreach_louis_property_id ON outreach_properties(louis_property_id);
    CREATE INDEX IF NOT EXISTS idx_outreach_suburb_street ON outreach_properties(suburb, street, created_at);

    CREATE TABLE IF NOT EXISTS outreach_send_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      outreach_property_id UUID NOT NULL REFERENCES outreach_properties(id) ON DELETE CASCADE,
      suburb_report_id UUID REFERENCES suburb_reports(id) ON DELETE SET NULL,
      report_title VARCHAR(255) NOT NULL,
      campaign_key VARCHAR(100) NOT NULL,
      suburb VARCHAR(100) NOT NULL,
      sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      sent_by VARCHAR(255) NOT NULL,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_send_logs_property ON outreach_send_logs(outreach_property_id);
    CREATE INDEX IF NOT EXISTS idx_send_logs_campaign ON outreach_send_logs(campaign_key);
    CREATE INDEX IF NOT EXISTS idx_send_logs_suburb ON outreach_send_logs(suburb);
    CREATE INDEX IF NOT EXISTS idx_send_logs_sent_at ON outreach_send_logs(sent_at DESC);

    CREATE TABLE IF NOT EXISTS outreach_qr_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      token VARCHAR(100) UNIQUE NOT NULL,
      outreach_property_id UUID REFERENCES outreach_properties(id) ON DELETE CASCADE,
      send_log_id UUID REFERENCES outreach_send_logs(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT NOW(),
      scanned_at TIMESTAMP,
      scan_count INT DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_qr_token ON outreach_qr_tokens(token);
    CREATE INDEX IF NOT EXISTS idx_qr_property ON outreach_qr_tokens(outreach_property_id);
    CREATE INDEX IF NOT EXISTS idx_qr_send_log ON outreach_qr_tokens(send_log_id);

    CREATE TABLE IF NOT EXISTS card_qr_scan_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      source VARCHAR(50) NOT NULL DEFAULT 'card',
      user_agent TEXT,
      ip_address VARCHAR(100),
      scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_card_qr_scanned_at ON card_qr_scan_logs(scanned_at DESC);

    CREATE TABLE IF NOT EXISTS admin_settings (
      setting_key VARCHAR(100) PRIMARY KEY,
      setting_value TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      updated_by VARCHAR(255)
    );

    ALTER TABLE outreach_properties ADD COLUMN IF NOT EXISTS house_number BIGINT;

    CREATE INDEX IF NOT EXISTS idx_outreach_suburb_street_housenumber
    ON outreach_properties(suburb, street, house_number);
    `;

    await mariePool.query(sql);

    try {
      await mariePool.query(`CREATE INDEX IF NOT EXISTS idx_outreach_address_trgm ON outreach_properties USING gin (property_address gin_trgm_ops)`);
    } catch {
    }

    _outreachTableEnsured = true;
  } catch (err) {
    console.error('Failed to ensure outreach tables exist:', err);
    throw err;
  }
}


// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
mariePool.ensureOutreachTablesExist = ensureOutreachTablesExist;

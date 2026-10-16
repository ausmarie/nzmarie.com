import fs from 'fs';
import path from 'path';

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        const k = trimmed.substring(0, idx).trim();
        const v = trimmed.substring(idx + 1).trim();
        process.env[k] = v;
      }
    }
  }
}

loadEnv();

(async function main() {
  try {
    const { Pool } = await import('pg');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: true }, max: 2 });

    const res = await pool.query(
      `SELECT rs.name, rd.doc_type, rd.title, rd.content
       FROM report_documents rd
       JOIN report_suburbs rs ON rd.suburb_id = rs.id
       WHERE rd.doc_type = 'suburb_intro' AND rs.name ILIKE '%North Shore%'
       ORDER BY rd.updated_at DESC`
    );

    console.log(`Found ${res.rows.length} intro docs for North Shore:`);
    for (const r of res.rows) {
      console.log(`=== ${r.name} (${r.title}) ===`);
      console.log(JSON.stringify(r.content, null, 2));
    }

    await pool.end();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();

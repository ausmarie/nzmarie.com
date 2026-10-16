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

async function main() {
  try {
    // 1. Find records with visitor hash starting with a56f459e8bba
    const hashResult = await pool.query(
      "SELECT id, campaign_key, visitor_hash, created_at FROM campaign_visit_logs WHERE visitor_hash LIKE 'a56f459e8bba%' ORDER BY created_at DESC"
    );
    console.log('Records with a56f459e8bba...:');
    hashResult.rows.forEach(r => console.log(`  ${r.created_at} | ${r.campaign_key} | ${r.visitor_hash.substring(0,15)}...`));

    // 2. Move them back to oteha
    const updateResult = await pool.query(
      "UPDATE campaign_visit_logs SET campaign_key = 'oteha' WHERE visitor_hash LIKE 'a56f459e8bba%' RETURNING id, campaign_key"
    );
    console.log(`\nMoved ${updateResult.rowCount} records back to oteha`);

    // 3. Update oteha campaign_name to just "Oteha" (remove "Campaign")
    await pool.query(
      "UPDATE campaign_analytics SET campaign_name = 'Oteha' WHERE campaign_key = 'oteha'"
    );
    console.log('Updated oteha campaign_name to "Oteha"');

    // 4. Recalculate all campaign_analytics from actual visit logs
    await pool.query(`
      INSERT INTO campaign_analytics (campaign_key, campaign_name, total_pv, total_uv, last_visited_at, updated_at)
      SELECT
        cvl.campaign_key,
        CASE
          WHEN cvl.campaign_key = 'business_card' THEN 'Business Card'
          WHEN cvl.campaign_key = 'oteha' THEN 'Oteha'
          ELSE cvl.campaign_key
        END,
        COUNT(*) AS total_pv,
        COUNT(DISTINCT visitor_hash) AS total_uv,
        MAX(created_at) AS last_visited_at,
        NOW()
      FROM campaign_visit_logs cvl
      WHERE cvl.campaign_key IN ('oteha', 'business_card')
      GROUP BY cvl.campaign_key
      ON CONFLICT (campaign_key)
      DO UPDATE SET
        total_pv = EXCLUDED.total_pv,
        total_uv = EXCLUDED.total_uv,
        last_visited_at = EXCLUDED.last_visited_at,
        updated_at = NOW(),
        campaign_name = EXCLUDED.campaign_name
    `);
    console.log('Recalculated campaign_analytics');

    // 5. Verify
    const finalLogs = await pool.query(
      'SELECT campaign_key, visitor_hash, created_at FROM campaign_visit_logs ORDER BY created_at DESC LIMIT 6'
    );
    console.log('\nFinal visit logs (latest 6):');
    finalLogs.rows.forEach(r => console.log(`  ${r.created_at} | ${r.campaign_key} | ${r.visitor_hash.substring(0,12)}...`));

    const finalAnalytics = await pool.query(
      'SELECT campaign_key, campaign_name, total_pv, total_uv FROM campaign_analytics ORDER BY total_pv DESC'
    );
    console.log('\nFinal campaign_analytics:');
    finalAnalytics.rows.forEach(r => console.log(`  ${r.campaign_key} (${r.campaign_name}): pv=${r.total_pv} uv=${r.total_uv}`));

    await pool.end();
    console.log('\nDone.');
  } catch (err) {
    console.error('Error:', (err as Error).message);
    process.exit(1);
  }
}

main();

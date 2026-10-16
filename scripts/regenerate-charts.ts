import * as fs from 'fs';
import * as path from 'path';

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split('\n').forEach(l => {
      const t = l.trim(); if (!t || t.startsWith('#')) return;
      const i = t.indexOf('='); if (i === -1) return;
      const k = t.slice(0, i).trim(), v = t.slice(i + 1).trim();
      if (!process.env[k]) process.env[k] = v;
    });
  }
}
loadEnv();

async function main() {
  const { Pool } = await import('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 2 });

  const { rows: docs } = await pool.query(
    `SELECT id, title, content, suburb_id FROM report_documents WHERE content IS NOT NULL`
  );

  const { generateChartImageUrl } = await import('../lib/report-charts');

  let total = 0;
  let updated = 0;

  for (const doc of docs) {
    const blocks = doc.content;
    if (!Array.isArray(blocks)) continue;

    const chartBlock = blocks.find(
      (b: any) => b.type === 'image' && b.props?.name === 'Median price trend chart'
    );
    if (!chartBlock) continue;

    total++;

    const titleParts = (doc.title || '').split(' ');
    const suburbName = titleParts[0];
    if (!suburbName) continue;

    const qMatch = (doc.title || '').match(/(\d{4}-Q[1-4])/);
    const quarter = qMatch ? qMatch[1] : null;
    if (!quarter) continue;

    try {
      const newUrl = await generateChartImageUrl(suburbName, quarter);
      if (newUrl) {
        chartBlock.props.url = newUrl;
        await pool.query(
          `UPDATE report_documents SET content = $1::jsonb WHERE id = $2`,
          [JSON.stringify(blocks), doc.id]
        );
        updated++;
        console.log(`Regenerated chart for ${doc.title} -> ${newUrl}`);
      } else {
        console.log(`Skipped ${doc.title} (null URL - no chart data)`);
      }
    } catch (err) {
      console.error(`Failed for ${doc.title}:`, err);
    }
  }

  console.log(`\nDone: ${total} reports with charts found, ${updated} charts regenerated`);
  await pool.end();
}
main().catch(e => { console.error(e); process.exit(1); });

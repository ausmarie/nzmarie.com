import fs from 'fs';
import path from 'path';
function loadEnv() {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(l => {
      const t = l.trim(); if (!t || t.startsWith('#')) return;
      const i = t.indexOf('='); if (i === -1) return;
      process.env[t.slice(0,i).trim()] = t.slice(i+1).trim();
    });
  }
}
loadEnv();

(async function main(){
  try {
    const { Pool } = await import('pg');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 2 });

    const res = await pool.query(`SELECT id, title, content, created_at FROM report_documents WHERE title ILIKE '%Northcross%' ORDER BY created_at DESC LIMIT 1`);
    if (res.rows.length === 0) {
      console.log('No report_documents found with title matching Northcross');
      await pool.end();
      return;
    }
    const doc = res.rows[0];
    console.log('Found report id:', doc.id);
    console.log('Title:', doc.title);
    console.log('Created at:', doc.created_at);

    const content = doc.content;
    if (!content) {
      console.log('No content field in report');
      await pool.end();
      return;
    }

    console.log('\nBlocks:');
    for (let i = 0; i < content.length; i++) {
      const b = content[i];
      const preview = { index: i, type: b.type };
      if (b.type === 'custom' || b.type === 'card') {
        preview.name = b.name || b.title || b.props?.title;
      }
      console.log(JSON.stringify(preview));
      if (b.type === 'custom' || b.type === 'card') {
        console.log(' Props:', JSON.stringify(b.props, null, 2));
      }
      if (b.type === 'table') {
        const tc = b.content;
        if (tc && tc.type === 'tableContent' && tc.rows) {
          for (let ri = 0; ri < tc.rows.length; ri++) {
            const row = tc.rows[ri];
            const cellTexts = row.cells.map(c => JSON.stringify(c)).join(' | ');
            console.log(' Block', i, 'Row', ri, ':', cellTexts);
          }
        }
      }
    }

    // Search for any block prop that mentions totalVolume or quarterly
    console.log('\nSearching blocks for quarterly/totalVolume fields...');
    for (let i = 0; i < content.length; i++) {
      const b = content[i];
      const s = JSON.stringify(b);
      if (/totalVolume|quarterly|quarter/i.test(s)) {
        console.log('--- block index', i, 'matches ---');
        console.log(s.substring(0, 4000));
      }
    }

    await pool.end();
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
})();

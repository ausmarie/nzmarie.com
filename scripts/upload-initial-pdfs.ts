#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
// note: dynamic import of db and r2-storage happens after loadEnv() below

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

async function main() {
  loadEnv();

  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry') || args.includes('-d') || !args.includes('--apply');
  const reportsDir = path.resolve(process.cwd(), 'tmp', 'r2-mock-reports', 'reports');

  if (!fs.existsSync(reportsDir)) {
    console.error('Reports directory not found:', reportsDir);
    process.exit(1);
  }

  const files: { filePath: string; key: string; size: number; suburb: string; version: string; title: string }[] = [];

  function walk(dir: string) {
    for (const name of fs.readdirSync(dir)) {
      const p = path.join(dir, name);
      const stat = fs.statSync(p);
      if (stat.isDirectory()) {
        walk(p);
      } else if (stat.isFile()) {
        // derive key relative to reportsDir
        const rel = path.relative(reportsDir, p).replace(/\\/g, '/');
        const key = `reports/${rel}`;
        const parts = rel.split('/');
        const suburb = parts[0] || 'Unknown';
        const filename = parts[parts.length - 1];
        const version = filename.replace(/\.[^.]+$/, '');
        const title = `${suburb} ${version}`;
        files.push({ filePath: p, key, size: stat.size, suburb, version, title });
      }
    }
  }

  walk(reportsDir);

  console.log(`Found ${files.length} report file(s) to process.`);
  if (files.length === 0) process.exit(0);

  for (const f of files) {
    console.log(`\nProcessing: ${f.filePath}`);
    console.log(` -> key: ${f.key}, size: ${f.size} bytes`);

    if (dryRun) {
      console.log('Dry run: skipping upload and DB update. Use --apply to make changes.');
      continue;
    }

    // upload
    const buffer = fs.readFileSync(f.filePath);
    try {
      const { uploadToR2 } = await import('../lib/r2-storage');
      const uploadedKey = await uploadToR2(f.key, buffer);
      console.log('Uploaded to R2 as:', uploadedKey);

      // upsert into market_reports
      const { query, pool } = await import('../lib/db');
      const existing = await query(`SELECT id FROM market_reports WHERE r2_key = $1 LIMIT 1`, [uploadedKey]);
      if (existing.rows.length > 0) {
        await query(`UPDATE market_reports SET file_size = $1 WHERE id = $2`, [f.size, existing.rows[0].id]);
        console.log('Updated existing market_reports record id=', existing.rows[0].id);
      } else {
        // insert with unique r2_key
        await query(`INSERT INTO market_reports (suburb, version, title, r2_key, file_size, is_active) VALUES ($1,$2,$3,$4,$5,true)`, [f.suburb, f.version, f.title, uploadedKey, f.size]);
        console.log('Inserted new market_reports record for key=', uploadedKey);
      }
    } catch (err: any) {
      console.error('Error uploading/updating DB for', f.key, err?.message || err);
    }
  }

  // optional: close DB pool if exported
  try {
    const maybe = await import('../lib/db');
    if (maybe.pool && typeof maybe.pool.end === 'function') await maybe.pool.end();
  } catch (e) {
    // ignore
  }

  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});

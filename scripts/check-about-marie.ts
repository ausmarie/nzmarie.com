import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import { query as marieQuery } from '../lib/db';

async function run() {
  const result = await marieQuery(
    `SELECT id, title, icon, doc_type, status, content::text FROM report_documents WHERE title = 'About Marie' OR icon = 'about_marie'`
  );
  console.log(JSON.stringify(result.rows, null, 2));
}

run().catch(console.error);

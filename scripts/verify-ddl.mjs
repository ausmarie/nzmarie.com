import pg from 'pg';
import { readFileSync } from 'fs';

const envContent = readFileSync('.env', 'utf8');
const dbUrlMatch = envContent.match(/^DATABASE_URL=(.+)$/m);
const DATABASE_URL = dbUrlMatch[1].trim();

const pool = new pg.Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

const client = await pool.connect();

const col = await client.query(
  `SELECT column_name, generation_expression
   FROM information_schema.columns
   WHERE table_name = 'properties' AND column_name = 'street_name'`
);
console.log('street_name column:', col.rows.length > 0 ? `EXISTS  (expression: ${col.rows[0].generation_expression})` : 'MISSING ❌');

const idx = await client.query(
  `SELECT indexname, indexdef
   FROM pg_indexes
   WHERE tablename = 'properties'
     AND indexname IN ('idx_properties_suburb_street', 'idx_properties_suburb_lower')`
);
if (idx.rows.length === 0) {
  console.log('Indexes: NONE FOUND ❌');
} else {
  idx.rows.forEach(r => console.log(`Index ✓  ${r.indexname}:\n         ${r.indexdef}`));
}

const sample = await client.query(
  `SELECT address, street_name FROM properties WHERE LOWER(suburb)='torbay' LIMIT 5`
);
console.log('\nSample rows:');
sample.rows.forEach(r => console.log(`  "${r.address}"  →  "${r.street_name}"`));

client.release();
await pool.end();

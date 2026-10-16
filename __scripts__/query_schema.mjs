import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const pool = new pg.Pool({
  connectionString: process.env.LOUIS_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const result = await pool.query(
  "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'real_estate' ORDER BY ordinal_position"
);
console.log(JSON.stringify(result.rows, null, 2));
await pool.end();

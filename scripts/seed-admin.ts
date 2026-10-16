import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }
      const index = trimmed.indexOf('=');
      if (index > 0) {
        const key = trimmed.substring(0, index).trim();
        const val = trimmed.substring(index + 1).trim();
        process.env[key] = val;
      }
    }
  }
}

async function seedAdmin() {
  loadEnv();
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL not found');
    process.exit(1);
  }
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: true },
  });
  try {
    const email = 'nzmarie.com@gmail.com';
    const checkResult = await pool.query('SELECT id FROM admin_users WHERE email = $1', [email]);
    if (checkResult.rows.length === 0) {
      await pool.query(
        'INSERT INTO admin_users (email, name, role, is_active, notes) VALUES ($1, $2, $3, true, $4)',
        [email, 'Marie Zhang', 'super_admin', 'Owner and Primary Administrator']
      );
      console.log('Admin user seeded');
    } else {
      console.log('Admin user already exists');
    }
  } catch (error: any) {
    console.error('Seeding admin user FAILED', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seedAdmin();

import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://nzmarie:HHa_pWigbE_OcEX83FNRPg@baby-centaur-27756.j77.aws-ap-southeast-1.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full',
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const suburbRes = await pool.query("SELECT id, name FROM report_suburbs WHERE name = 'Oteha'");
  const suburb = suburbRes.rows[0];
  console.log('Suburb:', JSON.stringify(suburb));

  if (suburb) {
    const docsRes = await pool.query(
      "SELECT id, doc_type, title, quarter, status FROM report_documents WHERE suburb_id = $1 AND status != 'archived' ORDER BY sort_order",
      [suburb.id]
    );
    console.log('Documents:', JSON.stringify(docsRes.rows, null, 2));
  }
  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });

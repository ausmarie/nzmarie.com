import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://nzmarie:HHa_pWigbE_OcEX83FNRPg@baby-centaur-27756.j77.aws-ap-southeast-1.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full',
  ssl: { rejectUnauthorized: false },
});

async function main() {
  // Simulate the overview query
  const result = await pool.query(`
    SELECT
      rs.id AS suburb_id,
      rs.name AS suburb_name,
      rd.id AS doc_id,
      rd.doc_type,
      rd.title,
      rd.quarter,
      rd.status,
      rd.created_at
    FROM report_suburbs rs
    LEFT JOIN report_documents rd ON rd.suburb_id = rs.id AND rd.status != 'archived'
    WHERE rs.is_active = TRUE AND rs.name = 'Oteha'
    ORDER BY rd.sort_order ASC, rd.created_at DESC
  `);

  console.log('Rows from overview query:');
  for (const row of result.rows) {
    console.log(`  doc_type:${row.doc_type} doc_id:${row.doc_id} title:${row.title} quarter:${row.quarter} status:${row.status}`);
  }

  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });

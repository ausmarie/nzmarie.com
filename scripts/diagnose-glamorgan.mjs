import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://nzmarie:HHa_pWigbE_OcEX83FNRPg@baby-centaur-27756.j77.aws-ap-southeast-1.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full',
});

async function run() {
  // Get the actual streets in Run 1 for Torbay from street-clusters logic
  // (what the API returns as run 1's streets)
  const run1Streets = await pool.query(`
    WITH addr AS (
      SELECT op.street, op.property_address,
             sl.center_lat AS lat, sl.center_lng AS lng
      FROM outreach_properties op
      JOIN street_locations sl
        ON sl.suburb = op.suburb AND sl.street = op.street
        AND sl.center_lat IS NOT NULL AND sl.center_lng IS NOT NULL
      LEFT JOIN properties p ON REPLACE(op.property_id::text, '-', '') = p.id
      WHERE op.suburb = 'Torbay'
        AND op.status = 'pending'
        AND op.street IS NOT NULL AND TRIM(op.street) <> ''
        AND (p.no_junk_mail = false OR p.no_junk_mail IS NULL)
        AND NOT EXISTS (
          SELECT 1 FROM outreach_send_logs sl3
          JOIN suburb_reports sr3 ON sl3.suburb_report_id = sr3.id
          WHERE sl3.outreach_property_id = op.id AND sr3.suburb = 'Torbay'
        )
    )
    SELECT street, COUNT(*) as addr_count
    FROM addr
    GROUP BY street
    ORDER BY street
  `);
  console.log('\n--- Streets in Torbay run (all qualifying streets) ---');
  run1Streets.rows.forEach(r => console.log(r));

  // Check what the main API (handleLegacyQuery) returns for Torbay + Glamorgan Drive
  // with sent_status=unsent
  const mainLegacy = await pool.query(`
    SELECT op.property_address, op.street, p.no_junk_mail
    FROM outreach_properties op
    LEFT JOIN properties p ON REPLACE(op.property_id::text, '-', '') = p.id
    WHERE op.status = 'pending'
      AND op.suburb ILIKE 'Torbay'
      AND op.street IN ('Glamorgan Drive')
      AND NOT EXISTS (
        SELECT 1 FROM outreach_send_logs sl3
        JOIN suburb_reports sr3 ON sl3.suburb_report_id = sr3.id
        WHERE sl3.outreach_property_id = op.id AND sr3.suburb = 'Torbay'
      )
    ORDER BY op.property_address
    LIMIT 30
  `);
  console.log('\n--- handleLegacyQuery: Torbay + Glamorgan Drive + unsent ---');
  console.log('Total:', mainLegacy.rows.length);
  mainLegacy.rows.forEach(r => console.log(r.property_address, '| junk:', r.no_junk_mail));

  // Check what handleMVQuery (outreach_enriched) returns
  // First check if the MV exists
  const mvExists = await pool.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_name = 'outreach_enriched'
  `);
  console.log('\n--- outreach_enriched MV exists:', mvExists.rows.length > 0);

  if (mvExists.rows.length > 0) {
    const mv = await pool.query(`
      SELECT property_address, street, no_junk_mail
      FROM outreach_enriched
      WHERE status = 'pending'
        AND suburb ILIKE 'Torbay'
        AND street IN ('Glamorgan Drive')
      LIMIT 30
    `).catch(e => ({ rows: [], error: e.message }));
    console.log('\n--- outreach_enriched rows for Glamorgan Drive ---');
    if ('error' in mv) console.log('Error:', mv.error);
    else { console.log('Total:', mv.rows.length); mv.rows.forEach(r => console.log(r)); }
  }

  // Check what USE_OUTREACH_MV env var would produce - test the MV query path
  // with sent_status filter on outreach_enriched
  if (mvExists.rows.length > 0) {
    const mvUnsent = await pool.query(`
      SELECT property_address, street, no_junk_mail
      FROM outreach_enriched
      WHERE status = 'pending'
        AND suburb ILIKE 'Torbay'
        AND street IN ('Glamorgan Drive')
        AND NOT EXISTS (
          SELECT 1 FROM outreach_send_logs sl3
          JOIN suburb_reports sr3 ON sl3.suburb_report_id = sr3.id
          WHERE sl3.outreach_property_id = id AND sr3.suburb = 'Torbay'
        )
      LIMIT 30
    `).catch(e => ({ rows: [], error: e.message }));
    console.log('\n--- outreach_enriched + unsent filter ---');
    if ('error' in mvUnsent) console.log('Error:', mvUnsent.error);
    else { console.log('Total:', mvUnsent.rows.length); mvUnsent.rows.forEach(r => console.log(r)); }
  }

  // THE CRITICAL CHECK: what does the page actually fetch?
  // The page sends: status=pending, suburb=Torbay, streets=<run1 streets>, sent_status=unsent
  // Let's get the actual run 1 streets first (budget=30)
  // Simulate what street-clusters returns for run 1
  const allStreets = await pool.query(`
    WITH addr AS (
      SELECT op.street, sl.center_lat AS lat, sl.center_lng AS lng,
             COUNT(*) as cnt
      FROM outreach_properties op
      JOIN street_locations sl
        ON sl.suburb = op.suburb AND sl.street = op.street
        AND sl.center_lat IS NOT NULL AND sl.center_lng IS NOT NULL
      LEFT JOIN properties p ON REPLACE(op.property_id::text, '-', '') = p.id
      WHERE op.suburb = 'Torbay'
        AND op.status = 'pending'
        AND op.street IS NOT NULL AND TRIM(op.street) <> ''
        AND (p.no_junk_mail = false OR p.no_junk_mail IS NULL)
        AND NOT EXISTS (
          SELECT 1 FROM outreach_send_logs sl3
          JOIN suburb_reports sr3 ON sl3.suburb_report_id = sr3.id
          WHERE sl3.outreach_property_id = op.id AND sr3.suburb = 'Torbay'
        )
      GROUP BY op.street, sl.center_lat, sl.center_lng
    )
    SELECT street, lat, lng, cnt FROM addr ORDER BY street
  `);
  console.log('\n--- All qualifying streets for Torbay with counts ---');
  allStreets.rows.forEach(r => console.log(`${r.street}: ${r.cnt} addresses`));
}

run().finally(() => pool.end());

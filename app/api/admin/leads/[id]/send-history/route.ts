import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { marieDB } from '@/lib/db';
import { isAdmin } from '@/lib/permissions';

export async function GET(
  _request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const session = await auth();

  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Load the canonical property address too, so older leads can still match
    // outreach records when their stored address formatting differs.
    const leadResult = await marieDB.query(
      `SELECT l.property_address, l.property_id, l.suburb, l.source_outreach_id,
              p.address AS property_record_address, p.suburb AS property_record_suburb
       FROM leads l
       LEFT JOIN properties p ON REPLACE(l.property_id::text, '-', '') = p.id
       WHERE l.id = $1`,
      [params.id]
    );

    if (leadResult.rows.length === 0) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    const lead = leadResult.rows[0];

    // Match by explicit links first, then bridge through Properties and use
    // normalized street + suburb equality for records without those links.
    const addressMatchResult = await marieDB.query(
      `WITH target AS (
         SELECT
           LOWER(REGEXP_REPLACE(
             REGEXP_REPLACE(
               REGEXP_REPLACE(TRIM(SPLIT_PART(COALESCE(NULLIF($5, ''), $3), ',', 1)), '[0-9]{7,}$', ''),
               '[[:space:]]*/[[:space:]]*', '/', 'g'
             ),
             '[^[:alnum:]/]', '', 'g'
           )) AS street,
           LOWER(REGEXP_REPLACE(TRIM(COALESCE(NULLIF($6, ''), $4)), '[^[:alnum:]]', '', 'g')) AS suburb
       ),
       property_matches AS (
         SELECT p.id::text AS id, p.address, p.suburb
         FROM properties p
         CROSS JOIN target t
         WHERE ($2::text IS NOT NULL AND REPLACE(p.id::text, '-', '') = REPLACE($2::text, '-', ''))
            OR (
              LOWER(REGEXP_REPLACE(
                REGEXP_REPLACE(
                  REGEXP_REPLACE(TRIM(SPLIT_PART(p.address, ',', 1)), '[0-9]{7,}$', ''),
                  '[[:space:]]*/[[:space:]]*', '/', 'g'
                ),
                '[^[:alnum:]/]', '', 'g'
              )) = t.street
              AND LOWER(REGEXP_REPLACE(TRIM(p.suburb), '[^[:alnum:]]', '', 'g')) = t.suburb
            )
       )
       SELECT op.id FROM outreach_properties op
       CROSS JOIN target t
       WHERE ($1::text IS NOT NULL AND op.id::text = $1::text)
          OR ($2::text IS NOT NULL AND REPLACE(op.property_id::text, '-', '') = REPLACE($2::text, '-', ''))
          OR (
            LOWER(REGEXP_REPLACE(
              REGEXP_REPLACE(
                REGEXP_REPLACE(TRIM(SPLIT_PART(op.property_address, ',', 1)), '[0-9]{7,}$', ''),
                '[[:space:]]*/[[:space:]]*', '/', 'g'
              ),
              '[^[:alnum:]/]', '', 'g'
            )) = t.street
            AND LOWER(REGEXP_REPLACE(TRIM(op.suburb), '[^[:alnum:]]', '', 'g')) = t.suburb
          )
          OR EXISTS (
            SELECT 1 FROM property_matches p
            WHERE REPLACE(op.property_id::text, '-', '') = REPLACE(p.id, '-', '')
               OR (
                 LOWER(REGEXP_REPLACE(
                   REGEXP_REPLACE(
                     REGEXP_REPLACE(TRIM(SPLIT_PART(op.property_address, ',', 1)), '[0-9]{7,}$', ''),
                     '[[:space:]]*/[[:space:]]*', '/', 'g'
                   ),
                   '[^[:alnum:]/]', '', 'g'
                 )) =
                   LOWER(REGEXP_REPLACE(
                     REGEXP_REPLACE(
                       REGEXP_REPLACE(TRIM(SPLIT_PART(p.address, ',', 1)), '[0-9]{7,}$', ''),
                       '[[:space:]]*/[[:space:]]*', '/', 'g'
                     ),
                     '[^[:alnum:]/]', '', 'g'
                   ))
                 AND LOWER(REGEXP_REPLACE(TRIM(op.suburb), '[^[:alnum:]]', '', 'g')) =
                   LOWER(REGEXP_REPLACE(TRIM(p.suburb), '[^[:alnum:]]', '', 'g'))
               )
          )`,
      [
        lead.source_outreach_id || null,
        lead.property_id || null,
        lead.property_address,
        lead.suburb,
        lead.property_record_address || null,
        lead.property_record_suburb || null,
      ]
    );

    const outreachPropertyIds = [...new Set(
      addressMatchResult.rows.map((row) => String(row.id))
    )];

    if (outreachPropertyIds.length === 0) {
      return NextResponse.json({ success: true, history: [] });
    }

    // Fetch send history for all matching outreach properties
    const placeholders = outreachPropertyIds.map((_, i) => `$${i + 1}`).join(',');
    const historyResult = await marieDB.query(
      `SELECT 
         l.id as log_id,
         l.outreach_property_id,
         l.suburb_report_id,
         l.report_title,
         l.campaign_key,
         l.suburb,
         l.sent_at,
         l.sent_by,
         l.notes,
         sr.file_url as pdf_file_url,
         sr.file_name as pdf_file_name,
         COALESCE(SUM(qt.scan_count), 0)::INTEGER as scan_count
        FROM outreach_send_logs l
        LEFT JOIN suburb_reports sr ON l.suburb_report_id = sr.id
        LEFT JOIN outreach_qr_tokens qt ON l.id = qt.send_log_id
        WHERE l.outreach_property_id IN (${placeholders})
        GROUP BY l.id, sr.id
        ORDER BY l.sent_at DESC`,
      outreachPropertyIds
    );

    return NextResponse.json({
      success: true,
      history: historyResult.rows,
    });
  } catch (error) {
    console.error('Error fetching lead send history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch send history' },
      { status: 500 }
    );
  }
}
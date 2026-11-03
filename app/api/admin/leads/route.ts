import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { marieDB } from '@/lib/db';
import { isAdmin } from '@/lib/permissions';
import { batchGetCachedR2Urls } from '@/lib/streetview';
import { matchPropertyIdByAddress } from '@/lib/lead-property';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const priority = searchParams.get('priority');
  const source = searchParams.get('source');
  const suburb = searchParams.get('suburb');
  const search = searchParams.get('search');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = (page - 1) * limit;

  try {
    // Count query — single table, no JOIN, cheap
    let countQuery = `SELECT COUNT(*) as total FROM leads l WHERE 1=1`;
    let dataQuery = `
      SELECT l.*,
        p.id as joined_property_id,
        p.address as joined_property_address,
        p.suburb as joined_property_suburb,
        p.city as joined_property_city,
        p.region as joined_property_region,
        p.postcode,
        p.cover_image_url as image_url,
        p.bedrooms,
        p.bathrooms,
        p.car_spaces as garages,
        p.capital_value as rv,
        p.land_value,
        p.improvement_value,
        p.last_sold_price,
        p.last_sold_date,
        p.year_built as build_year,
        NULLIF(p.floor_size, '-') as floor_area,
        COALESCE(NULLIF(p.land_area_numeric::text, ''), NULLIF(p.land_area, '-')) as land_area,
        p.property_url,
        p.description,
        p.has_rental_history,
        p.is_currently_rented,
        p.estimated_value_low,
        p.estimated_value_high,
        p.property_history,
        p.property_type,
        p.sale_status,
        p.latitude,
        p.longitude,
        COALESCE(re.original_link, rer.original_link, re.property_url, rer.property_url) as realestate_url,
        CASE WHEN re.id IS NOT NULL THEN true ELSE false END as on_market_sale,
        re.status as sale_listing_status,
        re.price_display as sale_price,
        re.agent_name as sale_agent,
        CASE WHEN rer.id IS NOT NULL THEN true ELSE false END as on_market_rent,
        rer.status as rent_listing_status,
        rer.price_display as rent_price,
        op.id as outreach_id,
        op.campaign as outreach_campaign,
        op.status as outreach_status,
        op.sent_at,
        op.last_sent_at,
        op.total_send_count
      FROM leads l
      LEFT JOIN properties p ON REPLACE(l.property_id::text, '-', '') = p.id
      LEFT JOIN real_estate re
        ON LOWER(REGEXP_REPLACE(TRIM(SPLIT_PART(re.address, ',', 1)), '  +', ' ', 'g')) =
           LOWER(REGEXP_REPLACE(TRIM(p.address), '  +', ' ', 'g'))
       AND LOWER(REGEXP_REPLACE(TRIM(re.suburb), '  +', ' ', 'g')) =
           LOWER(REGEXP_REPLACE(TRIM(p.suburb), '  +', ' ', 'g'))
      LEFT JOIN real_estate_rent rer
        ON LOWER(REGEXP_REPLACE(TRIM(SPLIT_PART(rer.address, ',', 1)), '  +', ' ', 'g')) =
           LOWER(REGEXP_REPLACE(TRIM(p.address), '  +', ' ', 'g'))
       AND LOWER(REGEXP_REPLACE(TRIM(rer.suburb), '  +', ' ', 'g')) =
           LOWER(REGEXP_REPLACE(TRIM(p.suburb), '  +', ' ', 'g'))
      LEFT JOIN outreach_properties op ON l.source_outreach_id = op.id
      WHERE 1=1
    `;
    const countParams: unknown[] = [];
    const dataParams: unknown[] = [];
    let idx = 1;

    if (status) {
      const clause = ` AND l.status = $${idx++}`;
      countQuery += clause;
      dataQuery += clause;
      countParams.push(status);
      dataParams.push(status);
    }
    if (priority) {
      const clause = ` AND l.priority = $${idx++}`;
      countQuery += clause;
      dataQuery += clause;
      countParams.push(priority);
      dataParams.push(priority);
    }
    if (source) {
      const clause = ` AND l.source = $${idx++}`;
      countQuery += clause;
      dataQuery += clause;
      countParams.push(source);
      dataParams.push(source);
    }
    if (suburb) {
      const clause = ` AND l.suburb ILIKE $${idx++}`;
      countQuery += clause;
      dataQuery += clause;
      countParams.push(suburb);
      dataParams.push(suburb);
    }
    if (search) {
      const clause = ` AND (l.property_address ILIKE $${idx} OR l.owner_name ILIKE $${idx} OR l.owner_email ILIKE $${idx} OR l.owner_phone ILIKE $${idx} OR l.summary ILIKE $${idx})`;
      countQuery += clause;
      dataQuery += clause;
      const val = `%${search}%`;
      countParams.push(val);
      dataParams.push(val);
      idx++;
    }

    dataQuery += ` ORDER BY l.created_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
    dataParams.push(limit, offset);

    const [countResult, dataResult] = await Promise.all([
      marieDB.query(countQuery, countParams),
      marieDB.query(dataQuery, dataParams),
    ]);
    const total = parseInt(countResult.rows[0]?.total || '0');
    const rows = dataResult.rows as Array<Record<string, unknown>>;

    if (rows.length > 0 && rows.some((row) =>
      !Array.isArray(row.address_notes) || !Array.isArray(row.events) || !Array.isArray(row.documents)
    )) {
      const requestedIds = rows.map((row) => String(row.id));
      const propertyIds = rows.map((row) =>
        String(row.property_id || row.joined_property_id || '').replace(/-/g, '')
      );
      const streets = rows.map((row) =>
        String(row.property_address || '')
          .split(',')[0]
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9/]/g, '')
      );
      const suburbs = rows.map((row) =>
        String(row.suburb || '').toLowerCase().replace(/[^a-z0-9]/g, '')
      );

      const historyResult = await marieDB.query(
        `WITH requested AS MATERIALIZED (
          SELECT *
          FROM unnest($1::text[], $2::text[], $3::text[], $4::text[])
            AS r(requested_lead_id, property_id, street, suburb)
        ),
        related AS MATERIALIZED (
          SELECT DISTINCT r.requested_lead_id, related_lead.id::text AS related_lead_id
          FROM requested r
          JOIN leads related_lead
            ON r.property_id <> ''
           AND REPLACE(related_lead.property_id::text, '-', '') = r.property_id
          UNION
          SELECT r.requested_lead_id, related_lead.id::text AS related_lead_id
          FROM requested r
          JOIN leads related_lead
            ON r.street <> '' AND r.suburb <> ''
           AND LOWER(REGEXP_REPLACE(TRIM(SPLIT_PART(related_lead.property_address, ',', 1)), '[^[:alnum:]/]', '', 'g')) = r.street
           AND LOWER(REGEXP_REPLACE(COALESCE(related_lead.suburb, ''), '[^[:alnum:]]', '', 'g')) = r.suburb
        ),
        notes_by_lead AS (
          SELECT related.requested_lead_id,
                 JSON_AGG(JSON_BUILD_OBJECT(
                   'lead_id', related_lead.id,
                   'notes', related_lead.notes,
                   'created_at', related_lead.updated_at
                 ) ORDER BY related_lead.updated_at DESC) AS address_notes
          FROM related
          JOIN leads related_lead ON related_lead.id = related.related_lead_id::uuid
          WHERE NULLIF(TRIM(related_lead.notes), '') IS NOT NULL
          GROUP BY related.requested_lead_id
         ),
         documents_by_lead AS (
           SELECT related.requested_lead_id,
                  JSON_AGG(JSON_BUILD_OBJECT(
                    'id', ld.id,
                    'lead_id', ld.lead_id,
                    'doc_type', ld.doc_type,
                    'file_name', ld.file_name,
                    'file_url', ld.file_url,
                    'file_size', ld.file_size,
                    'mime_type', ld.mime_type,
                    'uploaded_by', ld.uploaded_by,
                    'created_at', ld.created_at
                  ) ORDER BY ld.created_at DESC) AS documents
           FROM related
           JOIN lead_documents ld ON ld.lead_id = related.related_lead_id::uuid
           GROUP BY related.requested_lead_id
         ),
         events_by_lead AS (
           SELECT related.requested_lead_id,
                  JSON_AGG(JSON_BUILD_OBJECT(
                    'id', le.id,
                    'lead_id', le.lead_id,
                    'event_type', le.event_type,
                    'title', le.title,
                    'description', le.description,
                    'created_by', le.created_by,
                    'created_at', le.created_at
                  ) ORDER BY le.created_at DESC) AS events
           FROM related
           JOIN lead_events le ON le.lead_id = related.related_lead_id::uuid
           GROUP BY related.requested_lead_id
         )
         SELECT requested.requested_lead_id AS lead_id,
                COALESCE(notes_by_lead.address_notes, '[]'::json) AS address_notes,
                COALESCE(documents_by_lead.documents, '[]'::json) AS documents,
                COALESCE(events_by_lead.events, '[]'::json) AS events
         FROM requested
         LEFT JOIN notes_by_lead USING (requested_lead_id)
         LEFT JOIN documents_by_lead USING (requested_lead_id)
         LEFT JOIN events_by_lead USING (requested_lead_id)`,
        [requestedIds, propertyIds, streets, suburbs]
      );
      const histories = new Map(
        historyResult.rows.map((history) => [String(history.lead_id), history])
      );
      for (const row of rows) {
        const history = histories.get(String(row.id));
        if (history) {
          row.address_notes = history.address_notes;
          row.documents = history.documents;
          row.events = history.events;
        }
      }
    }

    try {
      const ids = rows
        .filter(r => typeof r.image_url === 'string' && !String(r.image_url).includes('reports.nzmarie.com') && !String(r.image_url).includes('no-photo') && !String(r.image_url).includes('placeholder') && !String(r.image_url).includes('No+Image'))
        .map(r => (r.joined_property_id as string) || (r.property_id ? String(r.property_id).replace(/-/g, '') : null))
        .filter(Boolean) as string[];
      const cleanIds = ids.map(id => String(id).replace(/-/g, ''));
      if (cleanIds.length > 0) {
        const map = await batchGetCachedR2Urls(cleanIds);
        for (const row of rows) {
          const pidRaw = (row.joined_property_id as string) || (row.property_id ? String(row.property_id).replace(/-/g, '') : null);
          const pid = pidRaw ? String(pidRaw).replace(/-/g, '') : null;
          const cached = pid ? map.get(pid) : null;
          if (cached && typeof row.image_url === 'string' && !String(row.image_url).includes('reports.nzmarie.com')) {
            row.image_url = cached;
          }
        }
      }
    } catch {}

    return NextResponse.json({
      success: true,
      data: dataResult.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Error fetching leads:', error);
    return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json() as {
      property_address?: string;
      property_id?: string;
      street?: string;
      suburb?: string;
      city?: string;
      region?: string;
      owner_name?: string;
      owner_email?: string;
      owner_phone?: string;
      source?: string;
      source_outreach_id?: string;
      status?: string;
      priority?: string;
      summary?: string;
      notes?: string;
      next_action?: string;
      next_action_at?: string;
    };

    let property_id = body.property_id;
    const {
      property_address, street, suburb, city, region,
      owner_name, owner_email, owner_phone,
      source = 'manual', source_outreach_id,
      status = 'new', priority = 'medium',
      summary, notes, next_action, next_action_at,
    } = body;

    if (!property_address) {
      return NextResponse.json({ error: 'Property address is required' }, { status: 400 });
    }

    // If source_outreach_id is given but no property_id, lookup from outreach_properties
    if (!property_id && source_outreach_id) {
      const op = await marieDB.query(
        `SELECT property_id FROM outreach_properties WHERE id = $1`,
        [source_outreach_id]
      );
      if (op.rows.length > 0 && op.rows[0].property_id) {
        property_id = op.rows[0].property_id;
      }
    }

    if (!property_id) {
      property_id = await matchPropertyIdByAddress(property_address, suburb) ?? undefined;
    }

    const result = await marieDB.query(
      `INSERT INTO leads (property_address, property_id, street, suburb, city, region, owner_name, owner_email, owner_phone, source, source_outreach_id, status, priority, summary, notes, next_action, next_action_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
       RETURNING *`,
      [
        property_address.trim(),
        property_id?.trim() || null,
        street?.trim() || null,
        suburb?.trim() || null,
        city?.trim() || null,
        region?.trim() || null,
        owner_name?.trim() || null,
        owner_email?.trim() || null,
        owner_phone?.trim() || null,
        source,
        source_outreach_id || null,
        status,
        priority,
        summary?.trim() || null,
        notes?.trim() || null,
        next_action?.trim() || null,
        next_action_at || null,
      ]
    );

    if (source_outreach_id) {
      await marieDB.query(
        `UPDATE outreach_properties SET converted_to_lead_id = $1 WHERE id = $2`,
        [result.rows[0].id, source_outreach_id]
      );
    }

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error creating lead:', error);
    return NextResponse.json({ error: 'Failed to create lead' }, { status: 500 });
  }
}

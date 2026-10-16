import { NextResponse } from 'next/server';
import { DateTime } from 'luxon';
import { auth } from '@/lib/auth';
import { marieDB } from '@/lib/db';
import { isAdmin } from '@/lib/permissions';
import { invalidateStreetClustersForSuburb } from '@/lib/redis';
import { batchGetCachedR2Urls } from '@/lib/streetview';
import { parseReportQuarter } from '@/lib/outreach-quarter';

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const useMV = process.env.USE_OUTREACH_MV === 'true';
  const view = searchParams.get('view') || 'full';

  try {
    await marieDB.ensureOutreachTablesExist?.();

    if (useMV) {
      return handleMVQuery(searchParams, view);
    }

    return handleLegacyQuery(searchParams);
  } catch (error) {
    console.error('Error fetching outreach properties:', error);
    return NextResponse.json(
      { error: 'Failed to fetch properties' },
      { status: 500 }
    );
  }
}

function paginationParams(searchParams: URLSearchParams) {
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '100');
  return { page, limit, offset: (page - 1) * limit };
}

async function handleMVQuery(searchParams: URLSearchParams, view: string) {
  const status = searchParams.get('status');
  const campaign = searchParams.get('campaign');
  const region = searchParams.get('region');
  const city = searchParams.get('city');
  const suburb = searchParams.get('suburb');
  const street = searchParams.get('street');
  const streets = (searchParams.get('streets') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const search = searchParams.get('search');
  const lastSoldNone = searchParams.get('last_sold_none');
  const lastSoldMinYears = searchParams.get('last_sold_min_years');
  const lastSoldMaxYears = searchParams.get('last_sold_max_years');
  const standaloneOnly = searchParams.get('standalone_only');
  const townhouseOnly = searchParams.get('townhouse_only');
  const marketStatus = searchParams.get('market_status');
  const noJunkMail = searchParams.get('no_junk_mail');
  const sentStatus = searchParams.get('sent_status');
  const reportQuarter = searchParams.get('report_quarter');
  const sentDates = (searchParams.get('sent_dates') || '').split(',').map(s => s.trim()).filter(Boolean);
  const sortOrder = searchParams.get('sortOrder') || 'asc';
  const sortMode = searchParams.get('sort_mode');
  const startStreet = searchParams.get('start_street')?.trim() || '';
  // Classic pagination fetches each page independently and needs a real total
  // for "Page X of Y" on every page. Infinite scroll omits it: it already knows
  // the total from page 1 and only needs the next slice of data.
  const includeTotal = searchParams.get('include_total') === 'true';

  const { page, limit, offset } = paginationParams(searchParams);

  const conditions: string[] = [];
  const params: unknown[] = [];
  const qi = parseReportQuarter(reportQuarter);

  if (status === 'sent') {
    if (qi) {
      let sub = `EXISTS (SELECT 1 FROM outreach_send_logs sl2 LEFT JOIN suburb_reports sr2 ON sl2.suburb_report_id = sr2.id WHERE sl2.outreach_property_id = outreach_enriched.id`;
      sub += ` AND ((sr2.quarter = $${params.length + 1} AND sr2.year = $${params.length + 2}) OR sl2.campaign_key ~ $${params.length + 3}))`;
      params.push(qi.quarter, qi.year, qi.campaignPattern);
      conditions.push(sub);
    } else {
      conditions.push(`EXISTS (SELECT 1 FROM outreach_send_logs sl2 WHERE sl2.outreach_property_id = outreach_enriched.id)`);
    }
  } else if (status === 'pending') {
    if (qi) {
      conditions.push(`status IN ('pending', 'sent')`);
    } else if (sentStatus === 'all' || !sentStatus) {
      conditions.push(`status IN ('pending', 'sent')`);
    } else if (sentStatus === 'sent') {
      conditions.push(`(status = 'sent' OR status = 'pending')`);
    } else {
      conditions.push(`status = 'pending'`);
    }
  } else if (status) {
    conditions.push(`status = $${params.length + 1}`);
    params.push(status);
  }

  if (sentDates.length > 0) {
    const dateRanges = sentDates
      .map((date) => {
        const dt = DateTime.fromISO(date, { zone: 'Pacific/Auckland' });
        if (!dt.isValid) return null;
        return {
          start: dt.startOf('day').toUTC().toISO(),
          end: dt.plus({ days: 1 }).startOf('day').toUTC().toISO(),
        };
      })
      .filter(Boolean) as Array<{ start: string; end: string }>;

    if (dateRanges.length > 0) {
      const rangeClauses = dateRanges
        .map((_, i) => `(sl6.sent_at >= $${params.length + 1 + i * 2} AND sl6.sent_at < $${params.length + 2 + i * 2})`)
        .join(' OR ');
      conditions.push(
        `EXISTS (SELECT 1 FROM outreach_send_logs sl6 WHERE sl6.outreach_property_id = outreach_enriched.id AND (${rangeClauses}))`
      );
      for (const range of dateRanges) {
        params.push(range.start, range.end);
      }
    }
  }

  if (campaign) {
    conditions.push(`(campaign = $${params.length + 1} OR last_campaign = $${params.length + 1} OR EXISTS (SELECT 1 FROM outreach_send_logs sl WHERE sl.outreach_property_id = outreach_enriched.id AND sl.campaign_key = $${params.length + 1}))`);
    params.push(campaign);
  }
  if (region) {
    conditions.push(`lower(region) LIKE lower($${params.length + 1})`);
    params.push(region);
  }
  if (city) {
    conditions.push(`lower(city) LIKE lower($${params.length + 1})`);
    params.push(city);
  }
  if (suburb) {
    conditions.push(`lower(suburb) LIKE lower($${params.length + 1})`);
    params.push(suburb);
  }
  if (street) {
    conditions.push(`(street ILIKE $${params.length + 1} OR property_address ILIKE $${params.length + 2})`);
    params.push(street, `%${street}%`);
  }
  if (streets.length > 0) {
    const placeholders = streets.map((_, i) => `$${params.length + 1 + i}`).join(', ');
    conditions.push(`street IN (${placeholders})`);
    params.push(...streets);
  }
  if (search) {
    const cleanSearch = search.split(',')[0].trim();
    conditions.push(`(property_address ILIKE $${params.length + 1} OR suburb ILIKE $${params.length + 1})`);
    params.push(`%${cleanSearch}%`);
  }

  if (lastSoldNone === 'true') {
    conditions.push('last_sold_date IS NULL');
  } else {
    if (lastSoldMinYears) {
      const years = parseInt(lastSoldMinYears);
      if (!isNaN(years) && years > 0) {
        conditions.push(`last_sold_date <= NOW() - INTERVAL '${years} years'`);
      }
    }
    if (lastSoldMaxYears) {
      const years = parseInt(lastSoldMaxYears);
      if (!isNaN(years) && years > 0) {
        conditions.push(`last_sold_date >= NOW() - INTERVAL '${years} years'`);
      }
    }
  }
  if (standaloneOnly === 'true') {
    conditions.push(`property_address NOT LIKE '%/%'`);
  }
  if (townhouseOnly === 'true') {
    conditions.push(`property_address LIKE '%/%'`);
  }
  if (marketStatus === 'for_sale') {
    conditions.push('on_market_sale = true');
  } else if (marketStatus === 'for_rent') {
    conditions.push('on_market_rent = true');
  } else if (marketStatus === 'rented') {
    conditions.push('has_rental_history = true');
  } else if (marketStatus === 'never_rented') {
    conditions.push('has_rental_history = false');
  } else if (marketStatus === 'not_listed') {
    conditions.push('on_market_sale = false AND on_market_rent = false AND has_rental_history = false');
  }
  if (noJunkMail === 'true') {
    conditions.push('no_junk_mail = true');
  } else if (noJunkMail === 'false') {
    conditions.push('(no_junk_mail = false OR no_junk_mail IS NULL)');
  }

  if (sentStatus === 'sent' || sentStatus === 'unsent') {
    const isSent = sentStatus === 'sent';
    const existsOp = isSent ? 'EXISTS' : 'NOT EXISTS';
    if (qi) {
      let sub = `SELECT 1 FROM outreach_send_logs sl3 LEFT JOIN suburb_reports sr3 ON sl3.suburb_report_id = sr3.id WHERE sl3.outreach_property_id = outreach_enriched.id`;
      if (suburb) {
        sub += ` AND (sl3.suburb = $${params.length + 1} OR sr3.suburb = $${params.length + 1} OR sl3.suburb IS NULL)`;
        params.push(suburb);
      }
      sub += ` AND ((sr3.quarter = $${params.length + 1} AND sr3.year = $${params.length + 2}) OR sl3.campaign_key ~ $${params.length + 3} OR last_campaign ~ $${params.length + 3})`;
      params.push(qi.quarter, qi.year, qi.campaignPattern);
      conditions.push(`${existsOp} (${sub})`);
    } else if (suburb) {
      if (isSent) {
        let sub = `EXISTS (SELECT 1 FROM outreach_send_logs sl3 LEFT JOIN suburb_reports sr3 ON sl3.suburb_report_id = sr3.id WHERE sl3.outreach_property_id = outreach_enriched.id AND (sl3.suburb = $${params.length + 1} OR sr3.suburb = $${params.length + 1} OR sl3.suburb IS NULL)`;
        params.push(suburb);
        sub += ') OR COALESCE(total_send_count, 0) > 0 OR last_sent_at IS NOT NULL OR sent_at IS NOT NULL OR status = \'sent\'';
        conditions.push(`(${sub})`);
      } else {
        let sub = `NOT EXISTS (SELECT 1 FROM outreach_send_logs sl3 LEFT JOIN suburb_reports sr3 ON sl3.suburb_report_id = sr3.id WHERE sl3.outreach_property_id = outreach_enriched.id AND (sl3.suburb = $${params.length + 1} OR sr3.suburb = $${params.length + 1} OR sl3.suburb IS NULL)`;
        params.push(suburb);
        sub += ') AND COALESCE(total_send_count, 0) = 0 AND last_sent_at IS NULL AND sent_at IS NULL AND status <> \'sent\'';
        conditions.push(`(${sub})`);
      }
    } else if (isSent) {
      conditions.push('(EXISTS (SELECT 1 FROM outreach_send_logs sl3 WHERE sl3.outreach_property_id = outreach_enriched.id) OR COALESCE(total_send_count, 0) > 0 OR last_sent_at IS NOT NULL OR sent_at IS NOT NULL OR status = \'sent\')');
    } else {
      conditions.push('(NOT EXISTS (SELECT 1 FROM outreach_send_logs sl3 WHERE sl3.outreach_property_id = outreach_enriched.id) AND COALESCE(total_send_count, 0) = 0 AND last_sent_at IS NULL AND sent_at IS NULL AND status <> \'sent\')');
    }
    if (!isSent) {
      conditions.push('(no_junk_mail IS NULL OR no_junk_mail = false)');
    }
  }

  const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
  const whereParamCount = params.length;

  const orderDirection = sortOrder === 'desc' ? 'DESC' : 'ASC';
  let orderClause: string;
  if (sortMode === 'time') {
    orderClause = `ORDER BY latest_sent_at ${orderDirection} NULLS LAST`;
  } else {
    const streetSortExpr = `COALESCE(
        NULLIF(TRIM(street), ''),
        TRIM(REGEXP_REPLACE(REGEXP_REPLACE(property_address, '^-?\\d+/\\s*', ''), '^-?\\d+[A-Za-z]?\\s*', ''))
      )`;
    orderClause = `
      ORDER BY
        suburb ASC,
        ${startStreet ? `(CASE WHEN ${streetSortExpr} >= $${params.length + 1} THEN 0 ELSE 1 END) ASC,` : ''}
        ${streetSortExpr} ASC,
        NULLIF(REGEXP_REPLACE(REGEXP_REPLACE(property_address, '^-?\\d+/\\s*', ''), '\\D.*', ''), '')::INTEGER ASC NULLS LAST,
        created_at ${orderDirection}
    `;
  }

  if (startStreet) {
    params.push(startStreet);
  }

  let quarterStatusSelect = '';
  if (qi) {
    const base = params.length;
    quarterStatusSelect = `, CASE WHEN EXISTS (SELECT 1 FROM outreach_send_logs slq LEFT JOIN suburb_reports srq ON slq.suburb_report_id = srq.id WHERE slq.outreach_property_id = outreach_enriched.id AND ((srq.quarter = $${base + 1} AND srq.year = $${base + 2}) OR slq.campaign_key ~ $${base + 3})) THEN 'sent' ELSE 'pending' END AS status`;
    params.push(qi.quarter, qi.year, qi.campaignPattern);
  }
  const limitIdx = params.length + 1;
  params.push(limit, offset);

  const cardFields = `
    id, property_id, property_address, suburb, city, region, street,
    campaign, status, created_at, sent_at, no_junk_mail, owner_name,
    property_type, notes, selected_by, selected_at, last_campaign,
    total_send_count, last_sent_at,
    joined_property_id, cover_image_url, bedrooms, bathrooms, car_spaces,
    capital_value, last_sold_price, last_sold_date, year_built,
    on_market_sale, sale_listing_status, sale_price, sale_agent,
    on_market_rent, rent_listing_status, rent_price,
    realestate_url,
    latest_send_title, latest_sent_at, latest_campaign,
    latest_send_quarter, latest_send_year, latest_send_report_suburb
  `;

  const selectClause = (view === 'card' ? cardFields : '*') + quarterStatusSelect;

  const dataQuery = `
    SELECT ${selectClause}
    FROM outreach_enriched
    ${whereClause}
    ${orderClause}
    LIMIT $${limitIdx} OFFSET $${limitIdx + 1}
  `;

  const result = await marieDB.query(dataQuery, params);

  try {
    const rows = result.rows as Array<Record<string, unknown>>;
    const ids = rows
      .filter(r => typeof r.cover_image_url === 'string' && !String(r.cover_image_url).includes('reports.nzmarie.com'))
      .map(r => (r.joined_property_id as string) || (r.property_id ? String(r.property_id).replace(/-/g, '') : null))
      .filter(Boolean) as string[];
    const cleanIds = ids.map(id => String(id).replace(/-/g, ''));
    if (cleanIds.length > 0) {
      const map = await batchGetCachedR2Urls(cleanIds);
      for (const row of rows) {
        const pidRaw = (row.joined_property_id as string) || (row.property_id ? String(row.property_id).replace(/-/g, '') : null);
        const pid = pidRaw ? String(pidRaw).replace(/-/g, '') : null;
        const cached = pid ? map.get(pid) : null;
        if (cached && typeof row.cover_image_url === 'string' && !String(row.cover_image_url).includes('reports.nzmarie.com')) {
          row.cover_image_url = cached;
        }
        if (cached && typeof (row as Record<string, unknown>).image_url === 'string' && !String((row as Record<string, unknown>).image_url).includes('reports.nzmarie.com')) {
          (row as Record<string, unknown>).image_url = cached;
        }
      }
    }
  } catch {}

  // Only compute total on the first page (offset === 0) or when the caller
  // explicitly asks for it (classic pagination).  Subsequent infinite-scroll
  // pages reuse the total the frontend already received from page 1, saving a
  // full table scan on every load.
  let total = 0;
  if (offset === 0 || includeTotal) {
    const countParams = params.slice(0, whereParamCount); // WHERE-clause params only
    const countResult = await marieDB.query(
      `SELECT COUNT(*) AS total FROM outreach_enriched ${whereClause}`,
      countParams
    );
    total = parseInt(countResult.rows[0]?.total ?? '0', 10);
  }

  return NextResponse.json({
    success: true,
    data: result.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: total > 0 ? Math.ceil(total / limit) : undefined,
    },
  });
}

async function handleLegacyQuery(searchParams: URLSearchParams) {
  const status = searchParams.get('status');
  const campaign = searchParams.get('campaign');
  const region = searchParams.get('region');
  const city = searchParams.get('city');
  const suburb = searchParams.get('suburb');
  const street = searchParams.get('street');
  const streets = (searchParams.get('streets') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const search = searchParams.get('search');
  const sortOrder = searchParams.get('sortOrder') || 'asc';
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '100');
  const offset = (page - 1) * limit;
  const lastSoldNone = searchParams.get('last_sold_none');
  const lastSoldMinYears = searchParams.get('last_sold_min_years');
  const lastSoldMaxYears = searchParams.get('last_sold_max_years');
  const standaloneOnly = searchParams.get('standalone_only');
  const townhouseOnly = searchParams.get('townhouse_only');
  const marketStatus = searchParams.get('market_status');
  const noJunkMail = searchParams.get('no_junk_mail');
  const sentStatus = searchParams.get('sent_status');
  const reportQuarter = searchParams.get('report_quarter');
  const qiLegacy = parseReportQuarter(reportQuarter);
  const sentDates = (searchParams.get('sent_dates') || '').split(',').map(s => s.trim()).filter(Boolean);
  const sortMode = searchParams.get('sort_mode');
  const startStreet = searchParams.get('start_street')?.trim() || '';
  const includeTotal = searchParams.get('include_total') === 'true';

  let query = `
    SELECT
      op.*@@QUARTER_STATUS@@,
      ls.report_title as latest_send_title,
      ls.sent_at as latest_sent_at,
      ls.campaign_key as latest_campaign,
      ls.quarter as latest_send_quarter,
      ls.year as latest_send_year,
      ls.report_suburb as latest_send_report_suburb,
      p.id as joined_property_id,
      p.property_url,
      p.cover_image_url as image_url,
      p.bedrooms,
      p.bathrooms,
      p.car_spaces,
      p.floor_size as floor_area,
      p.land_area,
      p.last_sold_price,
      p.last_sold_date,
      p.capital_value,
      p.year_built as build_year,
      p.property_url as pv_url,
      p.description,
      p.has_rental_history,
      p.is_currently_rented,
      p.estimated_value_low,
      p.estimated_value_high,
      p.suburb_median_price,
      p.suburb_days_on_market,
      p.no_junk_mail,
      COALESCE(re.original_link, rer.original_link, re.property_url, rer.property_url) as realestate_url,
      p.property_history,
      CASE WHEN re.id IS NOT NULL THEN true ELSE false END as on_market_sale,
      re.status as sale_listing_status,
      re.price_display as sale_price,
      re.agent_name as sale_agent,
      CASE WHEN rer.id IS NOT NULL THEN true ELSE false END as on_market_rent,
      rer.status as rent_listing_status,
      rer.price_display as rent_price
    FROM outreach_properties op
    LEFT JOIN properties p ON REPLACE(op.property_id::text, '-', '') = p.id
    LEFT JOIN real_estate re ON TRIM(LOWER(SPLIT_PART(re.address, ',', 1))) = TRIM(LOWER(p.address)) AND TRIM(LOWER(re.suburb)) = TRIM(LOWER(p.suburb))
    LEFT JOIN real_estate_rent rer ON TRIM(LOWER(SPLIT_PART(rer.address, ',', 1))) = TRIM(LOWER(p.address)) AND TRIM(LOWER(rer.suburb)) = TRIM(LOWER(p.suburb))
    LEFT JOIN LATERAL (
      SELECT sl.report_title, sl.sent_at, sl.campaign_key, sr.quarter, sr.year, sr.suburb as report_suburb
      FROM outreach_send_logs sl
      LEFT JOIN suburb_reports sr ON sl.suburb_report_id = sr.id
      WHERE sl.outreach_property_id = op.id
      ORDER BY sl.sent_at DESC
      LIMIT 1
    ) ls ON true
    WHERE 1=1
  `;
  const params: unknown[] = [];
  let idx = 1;

  if (status === 'sent') {
    if (qiLegacy) {
      query += ` AND EXISTS (SELECT 1 FROM outreach_send_logs sl2 LEFT JOIN suburb_reports sr2 ON sl2.suburb_report_id = sr2.id WHERE sl2.outreach_property_id = op.id AND ((sr2.quarter = $${idx} AND sr2.year = $${idx + 1}) OR sl2.campaign_key ~ $${idx + 2}))`;
      params.push(qiLegacy.quarter, qiLegacy.year, qiLegacy.campaignPattern);
      idx += 3;
    } else {
      query += ` AND EXISTS (SELECT 1 FROM outreach_send_logs sl2 WHERE sl2.outreach_property_id = op.id)`;
    }
  } else if (status === 'pending') {
    if (qiLegacy) {
      query += ` AND op.status IN ('pending', 'sent')`;
    } else if (sentStatus === 'all' || !sentStatus) {
      query += ` AND op.status IN ('pending', 'sent')`;
    } else if (sentStatus === 'sent') {
      query += ` AND (op.status = 'sent' OR op.status = 'pending')`;
    } else {
      query += ` AND op.status = 'pending'`;
    }
  } else if (status) {
    query += ` AND op.status = $${idx++}`;
    params.push(status);
  }

  if (campaign) {
    query += ` AND (op.campaign = $${idx} OR op.last_campaign = $${idx} OR EXISTS (SELECT 1 FROM outreach_send_logs sl WHERE sl.outreach_property_id = op.id AND sl.campaign_key = $${idx}))`;
    params.push(campaign);
    idx++;
  }
  if (region) {
    query += ` AND op.region ILIKE $${idx++}`;
    params.push(region);
  }
  if (city) {
    query += ` AND op.city ILIKE $${idx++}`;
    params.push(city);
  }
  if (suburb) {
    query += ` AND op.suburb ILIKE $${idx++}`;
    params.push(suburb);
  }
  if (street) {
    query += ` AND (op.street ILIKE $${idx} OR op.property_address ILIKE $${idx + 1})`;
    params.push(street, `%${street}%`);
    idx += 2;
  }
  if (streets.length > 0) {
    const placeholders = streets.map(() => `$${idx++}`).join(', ');
    query += ` AND op.street IN (${placeholders})`;
    params.push(...streets);
  }
  if (search) {
    const cleanSearch = search.split(',')[0].trim();
    query += ` AND (op.property_address ILIKE $${idx} OR op.suburb ILIKE $${idx})`;
    params.push(`%${cleanSearch}%`);
    idx++;
  }

  if (lastSoldNone === 'true') {
    query += ` AND p.last_sold_date IS NULL`;
  } else {
    if (lastSoldMinYears) {
      const years = parseInt(lastSoldMinYears);
      if (!isNaN(years) && years > 0) {
        query += ` AND p.last_sold_date <= NOW() - INTERVAL '${years} years'`;
      }
    }
    if (lastSoldMaxYears) {
      const years = parseInt(lastSoldMaxYears);
      if (!isNaN(years) && years > 0) {
        query += ` AND p.last_sold_date >= NOW() - INTERVAL '${years} years'`;
      }
    }
  }
  if (standaloneOnly === 'true') {
    query += ` AND p.address NOT LIKE '%/%'`;
  }
  if (townhouseOnly === 'true') {
    query += ` AND p.address LIKE '%/%'`;
  }
  if (marketStatus === 'for_sale') {
    query += ` AND re.id IS NOT NULL`;
  } else if (marketStatus === 'for_rent') {
    query += ` AND rer.id IS NOT NULL`;
  } else if (marketStatus === 'rented') {
    query += ` AND p.has_rental_history = true`;
  } else if (marketStatus === 'never_rented') {
    query += ` AND p.has_rental_history = false`;
  } else if (marketStatus === 'not_listed') {
    query += ` AND re.id IS NULL AND rer.id IS NULL AND p.has_rental_history = false`;
  }
  if (noJunkMail === 'true') {
    query += ` AND p.no_junk_mail = true`;
  } else if (noJunkMail === 'false') {
    query += ` AND (p.no_junk_mail = false OR p.no_junk_mail IS NULL)`;
  }

  if (sentStatus === 'sent' || sentStatus === 'unsent') {
    const isSent = sentStatus === 'sent';
    const existsOp = isSent ? 'EXISTS' : 'NOT EXISTS';
    let sub = `SELECT 1 FROM outreach_send_logs sl3 ${qiLegacy ? 'LEFT JOIN' : 'JOIN'} suburb_reports sr3 ON sl3.suburb_report_id = sr3.id WHERE sl3.outreach_property_id = op.id`;
    if (qiLegacy) {
      if (suburb) {
        sub += ` AND (sl3.suburb = $${idx} OR sr3.suburb = $${idx} OR sl3.suburb IS NULL)`;
        params.push(suburb);
        idx++;
      }
      sub += ` AND ((sr3.quarter = $${idx} AND sr3.year = $${idx + 1}) OR sl3.campaign_key ~ $${idx + 2} OR op.last_campaign ~ $${idx + 2})`;
      params.push(qiLegacy.quarter, qiLegacy.year, qiLegacy.campaignPattern);
      idx += 3;
      query += ` AND (${existsOp} (${sub}))`;
    } else if (suburb) {
      sub += ` AND sr3.suburb = $${idx}`;
      params.push(suburb);
      idx++;
      if (isSent) {
        query += ` AND (EXISTS (${sub}) OR op.status = 'sent' OR COALESCE(op.total_send_count, 0) > 0 OR op.last_sent_at IS NOT NULL OR op.sent_at IS NOT NULL)`;
      } else {
        query += ` AND (NOT EXISTS (${sub}) AND op.status <> 'sent' AND COALESCE(op.total_send_count, 0) = 0 AND op.last_sent_at IS NULL AND op.sent_at IS NULL)`;
      }
    } else {
      if (isSent) {
        query += ` AND (EXISTS (SELECT 1 FROM outreach_send_logs sl3 WHERE sl3.outreach_property_id = op.id) OR op.status = 'sent' OR COALESCE(op.total_send_count, 0) > 0 OR op.last_sent_at IS NOT NULL OR op.sent_at IS NOT NULL)`;
      } else {
        query += ` AND (NOT EXISTS (SELECT 1 FROM outreach_send_logs sl3 WHERE sl3.outreach_property_id = op.id) AND op.status <> 'sent' AND COALESCE(op.total_send_count, 0) = 0 AND op.last_sent_at IS NULL AND op.sent_at IS NULL)`;
      }
    }
    if (!isSent) {
      query += ` AND (p.no_junk_mail IS NULL OR p.no_junk_mail = false)`;
    }
  }

  if (sentDates.length > 0) {
    const dateRanges = sentDates
      .map((date) => {
        const dt = DateTime.fromISO(date, { zone: 'Pacific/Auckland' });
        if (!dt.isValid) return null;
        return {
          start: dt.startOf('day').toUTC().toISO(),
          end: dt.plus({ days: 1 }).startOf('day').toUTC().toISO(),
        };
      })
      .filter(Boolean) as Array<{ start: string; end: string }>;

    if (dateRanges.length > 0) {
      const rangeClauses = dateRanges
        .map((_, i) => `(sl6.sent_at >= $${idx + i * 2} AND sl6.sent_at < $${idx + i * 2 + 1})`)
        .join(' OR ');
      query += ` AND EXISTS (SELECT 1 FROM outreach_send_logs sl6 WHERE sl6.outreach_property_id = op.id AND (${rangeClauses}))`;
      for (const range of dateRanges) {
        params.push(range.start, range.end);
      }
      idx += dateRanges.length * 2;
    }
  }

  const orderDirection = sortOrder === 'desc' ? 'DESC' : 'ASC';

  // Snapshot the WHERE-clause param count BEFORE pushing any ORDER BY / LIMIT
  // / OFFSET params.  The count query reuses exactly these params.
  const whereParamCount = params.length;

  // This sentinel marks where the outer ORDER BY begins so we can reliably
  // extract only the WHERE clause for the count query (the lateral subquery
  // above also contains ORDER BY / LIMIT which would fool lastIndexOf).
  const ORDER_BY_SENTINEL = '/*__OUTER_ORDER_BY__*/';

  if (sortMode === 'time') {
    query += ` ${ORDER_BY_SENTINEL} ORDER BY ls.sent_at ${orderDirection} NULLS LAST LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(limit, offset);
  } else {
    const streetSortExpr = `COALESCE(
        NULLIF(TRIM(op.street), ''),
        TRIM(REGEXP_REPLACE(REGEXP_REPLACE(op.property_address, '^\\d+/\\s*', ''), '^\\d+[A-Za-z]?\\s*', ''))
      )`;
    const startCmp = startStreet
      ? `(CASE WHEN ${streetSortExpr} >= $${idx} THEN 0 ELSE 1 END) ASC,`
      : '';
    const limitIdx = idx + (startStreet ? 1 : 0);
    query += `
      ${ORDER_BY_SENTINEL} ORDER BY
        ${startCmp}
        op.suburb ASC,
        ${streetSortExpr} ASC,
        NULLIF(REGEXP_REPLACE(REGEXP_REPLACE(op.property_address, '^\\d+/\\s*', ''), '\\D.*', ''), '')::INTEGER ASC NULLS LAST,
        op.created_at ${orderDirection}
      LIMIT $${limitIdx} OFFSET $${limitIdx + 1}
    `;
    if (startStreet) {
      params.push(startStreet);
      idx++;
    }
    params.push(limit, offset);
  }

  let quarterStatusSelect = '';
  if (qiLegacy) {
    const base = params.length;
    quarterStatusSelect = `, CASE WHEN EXISTS (SELECT 1 FROM outreach_send_logs slq LEFT JOIN suburb_reports srq ON slq.suburb_report_id = srq.id WHERE slq.outreach_property_id = op.id AND ((srq.quarter = $${base + 1} AND srq.year = $${base + 2}) OR slq.campaign_key ~ $${base + 3})) THEN 'sent' ELSE 'pending' END AS status`;
    params.push(qiLegacy.quarter, qiLegacy.year, qiLegacy.campaignPattern);
  }
  query = query.replace('@@QUARTER_STATUS@@', quarterStatusSelect);

  const result = await marieDB.query(query, params);

  try {
    const rows = result.rows as Array<Record<string, unknown>>;
    const ids = rows
      .filter(r => {
        const u = (r.image_url as string) || (r.cover_image_url as string) || '';
        return typeof u === 'string' && !u.includes('reports.nzmarie.com') && !u.includes('no-photo') && !u.includes('placeholder') && !u.includes('No+Image');
      })
      .map(r => (r.joined_property_id as string) || (r.property_id ? String(r.property_id).replace(/-/g, '') : null) || (r as Record<string, unknown>).property_id as string || null)
      .filter(Boolean) as string[];
    const cleanIds = ids.map(id => String(id).replace(/-/g, ''));
    if (cleanIds.length > 0) {
      const map = await batchGetCachedR2Urls(cleanIds);
      for (const row of rows) {
        const pidRaw = (row.joined_property_id as string) || (row.property_id ? String(row.property_id).replace(/-/g, '') : null);
        const pid = pidRaw ? String(pidRaw).replace(/-/g, '') : null;
        const cached = pid ? map.get(pid) : null;
        if (cached) {
          if (typeof row.image_url === 'string' && !String(row.image_url).includes('reports.nzmarie.com')) row.image_url = cached;
          if (typeof row.cover_image_url === 'string' && !String(row.cover_image_url).includes('reports.nzmarie.com')) row.cover_image_url = cached;
        }
      }
    }
  } catch {}

  // Only compute total on the first page or when the caller explicitly asks
  // for it (classic pagination) — skip the full-table COUNT on infinite-scroll
  // pages beyond the first, the frontend already has it from page 1.
  let total = 0;
  if (offset === 0 || includeTotal) {
    // Build a minimal count query: strip down to op, p and the WHERE clause.
    // Use the sentinel to find the outer ORDER BY — lastIndexOf('ORDER BY') would
    // incorrectly match the ORDER BY inside the lateral join subquery.
    const whereStart = query.indexOf('WHERE 1=1');
    const sentinelPos = query.indexOf(ORDER_BY_SENTINEL);
    const whereClause = query.substring(whereStart, sentinelPos);
    const countBaseQuery = `
      SELECT COUNT(*) AS total
      FROM outreach_properties op
      LEFT JOIN properties p ON REPLACE(op.property_id::text, '-', '') = p.id
      LEFT JOIN real_estate re ON TRIM(LOWER(SPLIT_PART(re.address, ',', 1))) = TRIM(LOWER(p.address)) AND TRIM(LOWER(re.suburb)) = TRIM(LOWER(p.suburb))
      LEFT JOIN real_estate_rent rer ON TRIM(LOWER(SPLIT_PART(rer.address, ',', 1))) = TRIM(LOWER(p.address)) AND TRIM(LOWER(rer.suburb)) = TRIM(LOWER(p.suburb))
      ${whereClause}
    `;
    // Use only the WHERE-clause params — excludes startStreet/LIMIT/OFFSET
    // which are appended after the ORDER BY and not present in the count query.
    const countParams = params.slice(0, whereParamCount);
    const countResult = await marieDB.query(countBaseQuery, countParams);
    total = parseInt(countResult.rows[0]?.total ?? '0', 10);
  }

  return NextResponse.json({
    success: true,
    data: result.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: total > 0 ? Math.ceil(total / limit) : undefined,
    },
  });
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json() as {
      property_address?: string;
      suburb?: string;
      city?: string;
      region?: string;
      street?: string;
      owner_name?: string;
      property_type?: string;
      campaign?: string;
      notes?: string;
      louis_property_id?: string;
      property_id?: string;
    };
    const {
      property_address,
      suburb,
      city,
      region,
      street,
      owner_name,
      property_type,
      campaign = '2026_Q3_Report',
      notes,
      louis_property_id,
      property_id,
    } = body;

    if (!property_address || !suburb || !city || !region) {
      return NextResponse.json(
        { error: 'Address, suburb, city, and region are required' },
        { status: 400 }
      );
    }

    let duplicate;
    if (property_id) {
      duplicate = await marieDB.query(
        `SELECT id FROM outreach_properties WHERE property_id = $1 LIMIT 1`,
        [property_id]
      );
    } else if (louis_property_id && louis_property_id.trim().length > 0) {
      duplicate = await marieDB.query(
        `SELECT id FROM outreach_properties WHERE louis_property_id = $1 AND campaign = $2 LIMIT 1`,
        [louis_property_id.trim(), campaign]
      );
    } else {
      const normalizedAddress = property_address
        .toLowerCase()
        .replace(/,\s*new\s*zealand/g, '')
        .replace(/new\s*zealand/g, '')
        .replace(/\b\d{4}\b/g, '')
        .replace(/[^a-z0-9]/g, '');

      duplicate = await marieDB.query(
        `SELECT id FROM outreach_properties
         WHERE LOWER(
           REGEXP_REPLACE(
             REGEXP_REPLACE(
               REGEXP_REPLACE(property_address, ',\\s*New\\s*Zealand', '', 'gi'),
               '\\b\\d{4}\\b',
               '',
               'g'
             ),
             '[^a-zA-Z0-9]',
             '',
             'g'
           )
         ) = $1 AND campaign = $2 LIMIT 1`,
        [normalizedAddress, campaign]
      );
    }

    if (duplicate.rows.length > 0) {
      return NextResponse.json(
        { error: 'Address already exists in this campaign' },
        { status: 409 }
      );
    }

    const result = await marieDB.query(
      `INSERT INTO outreach_properties
       (property_id, louis_property_id, property_address, suburb, city, region, street, owner_name, property_type, campaign, notes, status, selected_by, selected_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending', $12, NOW())
       RETURNING *`,
      [
        property_id?.trim() || null,
        louis_property_id?.trim() || null,
        property_address.trim(),
        suburb.trim(),
        city.trim(),
        region.trim(),
        street?.trim() || null,
        owner_name?.trim() || null,
        property_type?.trim() || null,
        campaign,
        notes?.trim() || null,
        session.user.email,
      ]
    );

    if (suburb) {
      invalidateStreetClustersForSuburb(suburb.trim()).catch(() => { });
    }

    if (process.env.USE_OUTREACH_MV === 'true') {
      marieDB.query('REFRESH MATERIALIZED VIEW CONCURRENTLY outreach_enriched')
        .catch(err => console.error('MV refresh failed (non-critical):', err));
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error creating outreach property:', error);
    return NextResponse.json(
      { error: 'Failed to create property' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query as marieQuery } from '@/lib/db';
import { isAdmin } from '@/lib/permissions';

const COLUMNS = `
  r.id,
  r.address,
  r.status,
  r.data,
  r.listing_date,
  r.listing_date_raw,
  r.price_display,
  r.agent_name,
  r.bedroom_count,
  r.bathroom_count,
  r.land_area,
  r.floor_area,
  r.car_spaces,
  r.property_url,
  r.original_link,
  r.region,
  r.suburb,
  r.city,
  r.latitude,
  r.longitude,
  r.cover_image_url,
  r.images,
  r.normalized_lead_address,
  r.address_fingerprint,
  r.property_type,
  r.description,
  r.listing_number,
  r.listing_date_parsed,
  r.last_sold_date,
  r.property_history
`;

function buildQuery(
  listingType: string,
  columns: string,
  params: unknown[],
  search: string | null,
  region: string | null,
  city: string | null,
  suburb: string | null,
  minBedrooms: string | null,
  maxBedrooms: string | null,
  minBathrooms: string | null,
  maxBathrooms: string | null,
  propertyType: string | null,
  lastSoldMinYears: string | null,
  lastSoldMaxYears: string | null,
  lastSoldNone: string | null,
  sortBy: string | null,
  limit: number,
  offset: number
) {
  let paramIndex = 1;

  let fromClause: string;
  if (listingType === 'all') {
    const rentColumns = columns.replace(/\br\./g, '');
    fromClause = `(
      SELECT ${rentColumns}, 'sale' AS listing_type FROM real_estate
      UNION ALL
      SELECT ${rentColumns}, 'rent' AS listing_type FROM real_estate_rent
    ) r`;
  } else if (listingType === 'rent') {
    fromClause = `real_estate_rent r`;
  } else {
    fromClause = `real_estate r`;
  }

  const listingTypeSelect = listingType !== 'all'
    ? `, '${listingType}' AS listing_type`
    : ', r.listing_type';

  let query = `SELECT${columns}${listingTypeSelect}\n  FROM ${fromClause}\n  WHERE 1=1`;

  if (search) {
    query += ` AND r.address ILIKE $${paramIndex}`;
    params.push(`%${search}%`);
    paramIndex++;
  }

  if (region) {
    query += ` AND LOWER(r.region) LIKE LOWER($${paramIndex})`;
    params.push(`%${region}%`);
    paramIndex++;
  }

  if (city) {
    query += ` AND LOWER(r.city) LIKE LOWER($${paramIndex})`;
    params.push(`%${city}%`);
    paramIndex++;
  }

  if (suburb) {
    query += ` AND LOWER(r.suburb) LIKE LOWER($${paramIndex})`;
    params.push(`%${suburb}%`);
    paramIndex++;
  }

  if (minBedrooms) {
    const val = parseInt(minBedrooms);
    if (!isNaN(val)) {
      query += ` AND r.bedroom_count >= $${paramIndex}`;
      params.push(val);
      paramIndex++;
    }
  }

  if (maxBedrooms) {
    const val = parseInt(maxBedrooms);
    if (!isNaN(val)) {
      query += ` AND r.bedroom_count <= $${paramIndex}`;
      params.push(val);
      paramIndex++;
    }
  }

  if (minBathrooms) {
    const val = parseInt(minBathrooms);
    if (!isNaN(val)) {
      query += ` AND r.bathroom_count >= $${paramIndex}`;
      params.push(val);
      paramIndex++;
    }
  }

  if (maxBathrooms) {
    const val = parseInt(maxBathrooms);
    if (!isNaN(val)) {
      query += ` AND r.bathroom_count <= $${paramIndex}`;
      params.push(val);
      paramIndex++;
    }
  }

  if (propertyType) {
    query += ` AND LOWER(r.property_type) = LOWER($${paramIndex})`;
    params.push(propertyType);
    paramIndex++;
  }

  if (lastSoldNone === 'true') {
    query += ` AND r.last_sold_date IS NULL`;
  } else {
    if (lastSoldMinYears) {
      const years = parseInt(lastSoldMinYears);
      if (!isNaN(years) && years > 0) {
        const d = new Date();
        d.setFullYear(d.getFullYear() - years);
        query += ` AND r.last_sold_date <= $${paramIndex}::date`;
        params.push(d.toISOString().split('T')[0]);
        paramIndex++;
      }
    }
    if (lastSoldMaxYears) {
      const years = parseInt(lastSoldMaxYears);
      if (!isNaN(years) && years > 0) {
        const d = new Date();
        d.setFullYear(d.getFullYear() - years);
        query += ` AND r.last_sold_date >= $${paramIndex}::date`;
        params.push(d.toISOString().split('T')[0]);
        paramIndex++;
      }
    }
  }

  if (sortBy === 'street') {
    query += ` ORDER BY r.address ASC NULLS LAST`;
  } else {
    query += ` ORDER BY COALESCE(
      r.listing_date::timestamptz,
      r.listing_date_parsed::timestamptz,
      CASE
        WHEN r.listing_date_raw ~ '^\d{1,2}\s+\w+\s+\d{4}$' THEN to_date(r.listing_date_raw, 'DD Month YYYY')::timestamptz
        WHEN r.listing_date_raw ~ '^\d{1,2}\s+\w+$' THEN to_date(r.listing_date_raw || ' ' || EXTRACT(YEAR FROM CURRENT_DATE), 'DD Month YYYY')::timestamptz
        ELSE NULL
      END
    ) DESC NULLS LAST, r.address ASC`;
  }

  query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limit, offset);

  return { query, paramIndex };
}

function buildCountQuery(
  listingType: string,
  columns: string,
  params: unknown[],
  search: string | null,
  region: string | null,
  city: string | null,
  suburb: string | null,
  minBedrooms: string | null,
  maxBedrooms: string | null,
  minBathrooms: string | null,
  maxBathrooms: string | null,
  propertyType: string | null,
  lastSoldMinYears: string | null,
  lastSoldMaxYears: string | null,
  lastSoldNone: string | null
) {
  let paramIndex = 1;

  let fromClause: string;
  if (listingType === 'all') {
    fromClause = `(
      SELECT id, address, region, city, suburb,
             bedroom_count, bathroom_count, property_type, last_sold_date
      FROM real_estate
      UNION ALL
      SELECT id, address, region, city, suburb,
             bedroom_count, bathroom_count, property_type, last_sold_date
      FROM real_estate_rent
    ) r`;
  } else if (listingType === 'rent') {
    fromClause = `real_estate_rent r`;
  } else {
    fromClause = `real_estate r`;
  }

  let query = `SELECT COUNT(*) as total FROM ${fromClause} WHERE 1=1`;

  if (search) {
    query += ` AND r.address ILIKE $${paramIndex}`;
    params.push(`%${search}%`);
    paramIndex++;
  }

  if (region) {
    query += ` AND LOWER(r.region) LIKE LOWER($${paramIndex})`;
    params.push(`%${region}%`);
    paramIndex++;
  }

  if (city) {
    query += ` AND LOWER(r.city) LIKE LOWER($${paramIndex})`;
    params.push(`%${city}%`);
    paramIndex++;
  }

  if (suburb) {
    query += ` AND LOWER(r.suburb) LIKE LOWER($${paramIndex})`;
    params.push(`%${suburb}%`);
    paramIndex++;
  }

  if (minBedrooms) {
    const val = parseInt(minBedrooms);
    if (!isNaN(val)) {
      query += ` AND r.bedroom_count >= $${paramIndex}`;
      params.push(val);
      paramIndex++;
    }
  }

  if (maxBedrooms) {
    const val = parseInt(maxBedrooms);
    if (!isNaN(val)) {
      query += ` AND r.bedroom_count <= $${paramIndex}`;
      params.push(val);
      paramIndex++;
    }
  }

  if (minBathrooms) {
    const val = parseInt(minBathrooms);
    if (!isNaN(val)) {
      query += ` AND r.bathroom_count >= $${paramIndex}`;
      params.push(val);
      paramIndex++;
    }
  }

  if (maxBathrooms) {
    const val = parseInt(maxBathrooms);
    if (!isNaN(val)) {
      query += ` AND r.bathroom_count <= $${paramIndex}`;
      params.push(val);
      paramIndex++;
    }
  }

  if (propertyType) {
    query += ` AND LOWER(r.property_type) = LOWER($${paramIndex})`;
    params.push(propertyType);
    paramIndex++;
  }

  if (lastSoldNone === 'true') {
    query += ` AND r.last_sold_date IS NULL`;
  } else {
    if (lastSoldMinYears) {
      const years = parseInt(lastSoldMinYears);
      if (!isNaN(years) && years > 0) {
        const d = new Date();
        d.setFullYear(d.getFullYear() - years);
        query += ` AND r.last_sold_date <= $${paramIndex}::date`;
        params.push(d.toISOString().split('T')[0]);
        paramIndex++;
      }
    }
    if (lastSoldMaxYears) {
      const years = parseInt(lastSoldMaxYears);
      if (!isNaN(years) && years > 0) {
        const d = new Date();
        d.setFullYear(d.getFullYear() - years);
        query += ` AND r.last_sold_date >= $${paramIndex}::date`;
        params.push(d.toISOString().split('T')[0]);
        paramIndex++;
      }
    }
  }

  return query;
}

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search');
  const region = searchParams.get('region');
  const city = searchParams.get('city');
  const suburb = searchParams.get('suburb');
  const minBedrooms = searchParams.get('min_bedrooms');
  const maxBedrooms = searchParams.get('max_bedrooms');
  const minBathrooms = searchParams.get('min_bathrooms');
  const maxBathrooms = searchParams.get('max_bathrooms');
  const propertyType = searchParams.get('property_type');
  const listingType = searchParams.get('type') || 'sale';
  const lastSoldMinYears = searchParams.get('last_sold_min_years');
  const lastSoldMaxYears = searchParams.get('last_sold_max_years');
  const lastSoldNone = searchParams.get('last_sold_none');
  const sortBy = searchParams.get('sort_by');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '18');
  const offset = (page - 1) * limit;

  const dataParams: unknown[] = [];
  const { query } = buildQuery(
    listingType, COLUMNS, dataParams,
    search, region, city, suburb, minBedrooms, maxBedrooms, minBathrooms, maxBathrooms, propertyType,
    lastSoldMinYears, lastSoldMaxYears, lastSoldNone, sortBy, limit, offset
  );

  const countParams: unknown[] = [];
  const countQuery = buildCountQuery(
    listingType, COLUMNS, countParams,
    search, region, city, suburb, minBedrooms, maxBedrooms, minBathrooms, maxBathrooms, propertyType,
    lastSoldMinYears, lastSoldMaxYears, lastSoldNone
  );

  try {
    const countResult = await marieQuery<{ total: string }>(countQuery, countParams);
    const total = parseInt(countResult.rows[0]?.total || '0');

    const result = await marieQuery<{
      id: string;
      address: string;
      status: string | null;
      data: string | null;
      listing_date: string | null;
      listing_date_raw: string | null;
      price_display: string | null;
      agent_name: string | null;
      bedroom_count: string | null;
      bathroom_count: string | null;
      land_area: string | null;
      floor_area: string | null;
      car_spaces: string | null;
      property_url: string | null;
      original_link: string | null;
      region: string | null;
      suburb: string | null;
      city: string | null;
      latitude: string | null;
      longitude: string | null;
      cover_image_url: string | null;
      images: string | null;
      normalized_lead_address: string | null;
      address_fingerprint: string | null;
      property_type: string | null;
      description: string | null;
      listing_number: string | null;
      listing_date_parsed: string | null;
      last_sold_date: string | null;
      property_history: string | null;
      listing_type: string;
    }>(query, dataParams);

    const listings = result.rows.map(row => ({
      id: row.id,
      address: row.address,
      status: row.status ?? null,
      data: row.data ?? null,
      listing_date: row.listing_date ?? null,
      listing_date_raw: row.listing_date_raw ?? null,
      price_display: row.price_display ?? null,
      agent_name: row.agent_name ?? null,
      bedroom_count: row.bedroom_count !== null ? Number(row.bedroom_count) : null,
      bathroom_count: row.bathroom_count !== null ? Number(row.bathroom_count) : null,
      land_area: row.land_area !== null ? Number(row.land_area) : null,
      floor_area: row.floor_area !== null ? Number(row.floor_area) : null,
      car_spaces: row.car_spaces !== null ? Number(row.car_spaces) : null,
      property_url: row.property_url ?? null,
      original_link: row.original_link ?? null,
      region: row.region ?? null,
      suburb: row.suburb ?? null,
      city: row.city ?? null,
      latitude: row.latitude !== null ? Number(row.latitude) : null,
      longitude: row.longitude !== null ? Number(row.longitude) : null,
      cover_image_url: row.cover_image_url ?? null,
      images: row.images ?? null,
      normalized_lead_address: row.normalized_lead_address ?? null,
      address_fingerprint: row.address_fingerprint ?? null,
      property_type: row.property_type ?? null,
      description: row.description ?? null,
      listing_number: row.listing_number ?? null,
      listing_date_parsed: row.listing_date_parsed ?? null,
      last_sold_date: row.last_sold_date ?? null,
      property_history: row.property_history ?? null,
      listing_type: row.listing_type,
    }));

    return NextResponse.json({
      success: true,
      listings,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: unknown) {
    console.error('Error fetching realestate listings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch listings' },
      { status: 500 }
    );
  }
}

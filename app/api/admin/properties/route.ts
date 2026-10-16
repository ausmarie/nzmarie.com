import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query as marieQuery } from '@/lib/db';
import { isAdmin } from '@/lib/permissions';
import { batchResolveStreetViews } from '@/lib/streetview';

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const suburbsParam = searchParams.get('suburbs');
  const suburb = searchParams.get('suburb');
  const lastSoldMinYears = searchParams.get('last_sold_min_years');
  const lastSoldMaxYears = searchParams.get('last_sold_max_years');
  const lastSoldNone = searchParams.get('last_sold_none');
  const buildYearMin = searchParams.get('build_year_min');
  const buildYearMax = searchParams.get('build_year_max');
  const minBedrooms = searchParams.get('min_bedrooms');
  const maxBedrooms = searchParams.get('max_bedrooms');
  const minBathrooms = searchParams.get('min_bathrooms');
  const maxBathrooms = searchParams.get('max_bathrooms');
  const minCarSpaces = searchParams.get('min_car_spaces');
  const maxCarSpaces = searchParams.get('max_car_spaces');
  const rvMin = searchParams.get('rv_min');
  const rvMax = searchParams.get('rv_max');
  const minFloorArea = searchParams.get('min_floor_area');
  const minLandArea = searchParams.get('min_land_area');
  const maxLandArea = searchParams.get('max_land_area');
  const marketPremium = searchParams.get('market_premium');
  const city = searchParams.get('city');
  const region = searchParams.get('region');
  const search = searchParams.get('search');
  const standaloneOnly = searchParams.get('standalone_only');
  const townhouseOnly = searchParams.get('townhouse_only');
  const noJunkMail = searchParams.get('no_junk_mail');
  const marketStatus = searchParams.get('market_status');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '18');
  const skipCount = searchParams.get('skip_count') === 'true';
  // Classic pagination fetches each page independently and needs a real total
  // for "Page X of Y" on every page. Infinite scroll omits it: it already knows
  // the total from page 1 and only needs the next slice of data.
  const includeTotal = searchParams.get('include_total') === 'true';
  const offset = (page - 1) * limit;

  let query = `
    SELECT 
      p.id,
      RTRIM(REGEXP_REPLACE(p.address, '\\d{7,}$', '')) as address,
      p.suburb,
      p.city,
      p.region,
      p.bedrooms,
      p.bathrooms,
      p.car_spaces as garages,
      p.capital_value as rv,
      p.last_sold_price,
      p.last_sold_date,
      p.year_built as build_year,
      COALESCE(NULLIF(p.land_area_numeric::text, ''), NULLIF(p.land_area, '-')) as land_area,
      NULLIF(p.floor_size, '-') as floor_area,
      COALESCE(
        NULLIF(p.cover_image_url, ''),
        'https://via.placeholder.com/400x300/e2e8f0/64748b?text=No+Image'
      ) as image_url,
      p.property_url,
      p.description,
      COALESCE(re.original_link, rer.original_link, re.property_url, rer.property_url) as realestate_url,
      p.postcode,
      p.land_value,
      p.improvement_value,
      p.has_rental_history,
      p.is_currently_rented,
      p.status,
      p.property_history,
      p.normalized_address,
      p.address_fingerprint,
      p.land_area_numeric,
      p.property_type,
      p.sale_status,
      p.sale_status_source,
      p.sale_status_updated_at,
      p.no_junk_mail,
      p.estimated_value_low,
      p.estimated_value_high,
      p.suburb_median_price,
      p.suburb_median_rent,
      p.suburb_days_on_market,
      p.images,
      p.latitude,
      p.longitude,
      p.created_at,
      CASE WHEN re.id IS NOT NULL THEN true ELSE false END as on_market_sale,
      re.status as sale_listing_status,
      re.price_display as sale_price,
      re.agent_name as sale_agent,
      CASE WHEN rer.id IS NOT NULL THEN true ELSE false END as on_market_rent,
      rer.status as rent_listing_status,
      rer.price_display as rent_price
    FROM properties p
    LEFT JOIN real_estate re ON LOWER(REGEXP_REPLACE(TRIM(SPLIT_PART(re.address, ',', 1)), '  +', ' ', 'g')) = LOWER(REGEXP_REPLACE(TRIM(p.address), '  +', ' ', 'g')) AND LOWER(REGEXP_REPLACE(TRIM(re.suburb), '  +', ' ', 'g')) = LOWER(REGEXP_REPLACE(TRIM(p.suburb), '  +', ' ', 'g'))
    LEFT JOIN real_estate_rent rer ON LOWER(REGEXP_REPLACE(TRIM(SPLIT_PART(rer.address, ',', 1)), '  +', ' ', 'g')) = LOWER(REGEXP_REPLACE(TRIM(p.address), '  +', ' ', 'g')) AND LOWER(REGEXP_REPLACE(TRIM(rer.suburb), '  +', ' ', 'g')) = LOWER(REGEXP_REPLACE(TRIM(p.suburb), '  +', ' ', 'g'))
    WHERE 1=1
  `;

  const params: unknown[] = [];
  let paramIndex = 1;

  if (suburbsParam) {
    const suburbs = suburbsParam.split(',').map(s => s.trim()).filter(Boolean);
    if (suburbs.length > 0) {
      const suburbPlaceholders = suburbs.map((_, i) => `$${paramIndex + i}`).join(', ');
      query += ` AND LOWER(p.suburb) IN (${suburbPlaceholders})`;
      suburbs.forEach(suburb => params.push(suburb.toLowerCase()));
      paramIndex += suburbs.length;
    }
  }

  if (suburb) {
    query += ` AND LOWER(p.suburb) = LOWER($${paramIndex})`;
    params.push(suburb);
    paramIndex++;
  }

  const street = searchParams.get('street');
  if (street) {
    // Use the pre-computed street_name generated column when available (walks the
    // composite index idx_properties_suburb_street).  Falls back to the legacy
    // REGEXP expression for rows where the column hasn't been backfilled yet.
    query += ` AND p.street_name = $${paramIndex}`;
    params.push(street);
    paramIndex++;
  }

  const CITY_TO_DB: Record<string, string> = {
    'Auckland': 'Auckland - City',
    'Auckland City': 'Auckland - City',
  };

  if (city) {
    const dbCity = CITY_TO_DB[city] || city;
    query += ` AND p.city = $${paramIndex}`;
    params.push(dbCity);
    paramIndex++;
  }

  if (region) {
    query += ` AND LOWER(p.region) LIKE LOWER($${paramIndex})`;
    params.push(`%${region}%`);
    paramIndex++;
  }

  if (search) {
    const cleanSearch = search.split(',')[0].trim();
    query += ` AND (p.address ILIKE $${paramIndex} OR p.suburb ILIKE $${paramIndex})`;
    params.push(`%${cleanSearch}%`);
    paramIndex++;
  }

  // Special 'unselected' flag: return properties not present in outreach_enriched
  const unselected = searchParams.get('unselected') === 'true';
  if (unselected) {
    // Only apply simple filters; complex joins are expensive here.
    query += ` AND NOT EXISTS (SELECT 1 FROM outreach_enriched oe WHERE LOWER(REPLACE(oe.property_id::text, '-', '')) = LOWER(p.id))`;
  }

  if (lastSoldNone === 'true') {
    query += ` AND p.last_sold_date IS NULL`;
  } else {
    if (lastSoldMinYears) {
      const years = parseInt(lastSoldMinYears);
      if (!isNaN(years) && years > 0) {
        const d = new Date();
        d.setFullYear(d.getFullYear() - years);
        query += ` AND p.last_sold_date <= $${paramIndex}::date`;
        params.push(d.toISOString().split('T')[0]);
        paramIndex++;
      }
    }
    if (lastSoldMaxYears) {
      const years = parseInt(lastSoldMaxYears);
      if (!isNaN(years) && years > 0) {
        const d = new Date();
        d.setFullYear(d.getFullYear() - years);
        query += ` AND p.last_sold_date >= $${paramIndex}::date`;
        params.push(d.toISOString().split('T')[0]);
        paramIndex++;
      }
    }
  }

  if (minBedrooms) {
    query += ` AND p.bedrooms >= $${paramIndex}`;
    params.push(parseInt(minBedrooms));
    paramIndex++;
  }

  if (maxBedrooms) {
    query += ` AND p.bedrooms <= $${paramIndex}`;
    params.push(parseInt(maxBedrooms));
    paramIndex++;
  }

  if (minBathrooms) {
    query += ` AND p.bathrooms >= $${paramIndex}`;
    params.push(parseInt(minBathrooms));
    paramIndex++;
  }

  if (maxBathrooms) {
    query += ` AND p.bathrooms <= $${paramIndex}`;
    params.push(parseInt(maxBathrooms));
    paramIndex++;
  }

  if (minCarSpaces) {
    query += ` AND p.car_spaces >= $${paramIndex}`;
    params.push(parseInt(minCarSpaces));
    paramIndex++;
  }

  if (maxCarSpaces) {
    query += ` AND p.car_spaces <= $${paramIndex}`;
    params.push(parseInt(maxCarSpaces));
    paramIndex++;
  }

  if (buildYearMin) {
    query += ` AND p.year_built >= $${paramIndex}`;
    params.push(parseInt(buildYearMin));
    paramIndex++;
  }

  if (buildYearMax) {
    query += ` AND p.year_built <= $${paramIndex}`;
    params.push(parseInt(buildYearMax));
    paramIndex++;
  }

  if (rvMin) {
    query += ` AND p.capital_value >= $${paramIndex}`;
    params.push(parseInt(rvMin));
    paramIndex++;
  }

  if (rvMax) {
    query += ` AND p.capital_value <= $${paramIndex}`;
    params.push(parseInt(rvMax));
    paramIndex++;
  }

  if (minFloorArea) {
    query += ` AND CASE WHEN p.floor_size ~ '^\\d+(\\.\\d+)?$' THEN p.floor_size::NUMERIC ELSE NULL END >= $${paramIndex}`;
    params.push(parseFloat(minFloorArea));
    paramIndex++;
  }

  if (minLandArea) {
    query += ` AND COALESCE(p.land_area_numeric, NULLIF(p.land_area, '-')::NUMERIC) >= $${paramIndex}`;
    params.push(parseFloat(minLandArea));
    paramIndex++;
  }

  if (maxLandArea) {
    query += ` AND COALESCE(p.land_area_numeric, NULLIF(p.land_area, '-')::NUMERIC) <= $${paramIndex}`;
    params.push(parseFloat(maxLandArea));
    paramIndex++;
  }

  if (marketPremium) {
    const premiumVal = parseFloat(marketPremium) / 100.0;
    query += ` AND p.last_sold_price IS NOT NULL AND p.capital_value IS NOT NULL AND p.capital_value > 0 AND (p.last_sold_price * 1.0 / p.capital_value) > $${paramIndex}`;
    params.push(premiumVal);
    paramIndex++;
  }

  if (standaloneOnly === 'true') {
    query += ` AND p.address NOT LIKE '%/%'`;
  }

  if (townhouseOnly === 'true') {
    query += ` AND p.address LIKE '%/%'`;
  }

  if (noJunkMail === 'true') {
    query += ` AND p.no_junk_mail = true`;
  } else if (noJunkMail === 'false') {
    query += ` AND p.no_junk_mail = false`;
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

  // Get total count — avoid expensive JOINs when filters only touch properties table.
  // Skip COUNT on infinite-scroll pages beyond the first (offset > 0, no
  // include_total): the frontend already knows the total from page 1 and just
  // needs the next slice of data.
  let total = 0;
  if (!skipCount && (offset === 0 || includeTotal)) {
    const needsJoinForCount = !!(marketStatus && ['for_sale', 'for_rent', 'not_listed'].includes(marketStatus));
    let countQuery: string;
    if (needsJoinForCount) {
      // Only replace the main SELECT ... FROM properties p section; don't match
      // nested FROM clauses inside subqueries such as NOT EXISTS.
      countQuery = query.replace(/^\s*SELECT[\s\S]*?FROM properties p/, 'SELECT COUNT(*) as total FROM properties p');
    } else {
      const wherePos = query.indexOf('WHERE 1=1');
      countQuery = 'SELECT COUNT(*) as total FROM properties p ' + query.substring(wherePos);
    }
    const countResult = await marieQuery<{ total: string }>(countQuery, params);
    total = parseInt(countResult.rows[0]?.total || '0');
  }

  // Add smart sorting: by suburb, then by street name, then by house number (numeric)
  // For addresses like "1/2 Barker Rise", we extract the first number (1) for sorting
  query += ` 
    ORDER BY 
      p.suburb ASC,
      REGEXP_REPLACE(p.address, '^[-0-9/A-Za-z]+\\s+', '') ASC,  -- Street name
      CASE 
        WHEN p.address ~ '^-?[0-9]+/' THEN CAST(REGEXP_REPLACE(p.address, '^-?([0-9]+)/.*', '\\1') AS INTEGER)
        WHEN p.address ~ '^-?[0-9]+[A-Za-z]?' THEN CAST(REGEXP_REPLACE(p.address, '^-?([0-9]+).*', '\\1') AS INTEGER)
        ELSE 999999
      END ASC,  -- Primary house number
      p.address ASC  -- Fallback for exact ordering
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;
  params.push(limit, offset);

  try {
    const result = await marieQuery<{
      id: string;
      address: string;
      suburb: string;
      city: string;
      region: string;
      bedrooms: string | null;
      bathrooms: string | null;
      garages: string | null;
      rv: string | null;
      last_sold_price: string | null;
      last_sold_date: string | null;
      build_year: string | null;
      land_area: string | null;
      floor_area: string | null;
      image_url: string;
      property_url: string;
      description: string | null;
      realestate_url: string | null;
      postcode: string | null;
      land_value: string | null;
      improvement_value: string | null;
      has_rental_history: boolean | null;
      is_currently_rented: boolean | null;
      status: string | null;
      property_history: string | null;
      normalized_address: string | null;
      address_fingerprint: string | null;
      land_area_numeric: string | null;
      property_type: string | null;
      sale_status: string | null;
      sale_status_source: string | null;
      sale_status_updated_at: string | null;
      estimated_value_low: string | null;
      estimated_value_high: string | null;
      suburb_median_price: string | null;
      suburb_median_rent: string | null;
      suburb_days_on_market: string | null;
      images: string | null;
      latitude: string | null;
      longitude: string | null;
      created_at: string | null;
      on_market_sale: boolean;
      sale_listing_status: string | null;
      sale_price: string | null;
      sale_agent: string | null;
      on_market_rent: boolean;
      rent_listing_status: string | null;
      rent_price: string | null;
      no_junk_mail: boolean;
    }>(query, params);

    let properties = result.rows.map(row => ({
      id: row.id,
      address: row.address,
      suburb: row.suburb,
      city: row.city,
      region: row.region,
      bedrooms: row.bedrooms !== null && row.bedrooms !== undefined ? Number(row.bedrooms) : null,
      bathrooms: row.bathrooms !== null && row.bathrooms !== undefined ? Number(row.bathrooms) : null,
      garages: row.garages !== null && row.garages !== undefined ? Number(row.garages) : null,
      rv: row.rv !== null && row.rv !== undefined ? Number(row.rv) : null,
      last_sold_price: row.last_sold_price !== null && row.last_sold_price !== undefined ? Number(row.last_sold_price) : null,
      last_sold_date: row.last_sold_date ?? "",
      build_year: row.build_year ? Number(row.build_year) : null,
      land_area: row.land_area !== null && row.land_area !== undefined && row.land_area !== '-' ? row.land_area : null,
      floor_area: row.floor_area ?? null,
      image_url: row.image_url,
      property_url: row.property_url,
      description: row.description ?? null,
      realestate_url: row.realestate_url,
      postcode: row.postcode ?? null,
      land_value: row.land_value !== null ? Number(row.land_value) : null,
      improvement_value: row.improvement_value !== null ? Number(row.improvement_value) : null,
      has_rental_history: row.has_rental_history === null ? null : row.has_rental_history === true,
      is_currently_rented: row.is_currently_rented === null ? null : row.is_currently_rented === true,
      status: row.status ?? null,
      property_history: row.property_history ?? null,
      normalized_address: row.normalized_address ?? null,
      address_fingerprint: row.address_fingerprint ?? null,
      land_area_numeric: row.land_area_numeric ?? null,
      property_type: row.property_type ?? null,
      sale_status: row.sale_status ?? null,
      sale_status_source: row.sale_status_source ?? null,
      sale_status_updated_at: row.sale_status_updated_at ?? null,
      estimated_value_low: row.estimated_value_low !== null ? Number(row.estimated_value_low) : null,
      estimated_value_high: row.estimated_value_high !== null ? Number(row.estimated_value_high) : null,
      suburb_median_price: row.suburb_median_price !== null ? Number(row.suburb_median_price) : null,
      suburb_median_rent: row.suburb_median_rent !== null ? Number(row.suburb_median_rent) : null,
      suburb_days_on_market: row.suburb_days_on_market !== null ? Number(row.suburb_days_on_market) : null,
      images: row.images !== null && row.images !== undefined ? row.images : null,
      latitude: row.latitude !== null ? Number(row.latitude) : null,
      longitude: row.longitude !== null ? Number(row.longitude) : null,
      no_junk_mail: row.no_junk_mail,
      created_at: row.created_at ?? null,
      on_market_sale: row.on_market_sale,
      sale_listing_status: row.sale_listing_status ?? null,
      sale_price: row.sale_price ?? null,
      sale_agent: row.sale_agent ?? null,
      on_market_rent: row.on_market_rent,
      rent_listing_status: row.rent_listing_status ?? null,
      rent_price: row.rent_price ?? null,
    }));

    try {
      const streetRows = properties.map(p => ({ id: p.id, latitude: p.latitude, longitude: p.longitude, image_url: p.image_url, address: p.address, suburb: p.suburb, city: p.city }));
      const resolved = await batchResolveStreetViews(streetRows);
      const urlMap = new Map(resolved.map(r => [r.id, r.image_url]));
      properties = properties.map(p => ({ ...p, image_url: urlMap.get(p.id) || p.image_url }));
    } catch {}

    return NextResponse.json({
      success: true,
      properties,
      pagination: {
        total: skipCount ? result.rows.length : total,
        page,
        limit,
        totalPages: skipCount ? Math.ceil(result.rows.length / limit) : Math.ceil(total / limit),
      },
    });
  } catch (error: unknown) {
    console.error('Error fetching properties:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch properties' },
      { status: 500 }
    );
  }
}

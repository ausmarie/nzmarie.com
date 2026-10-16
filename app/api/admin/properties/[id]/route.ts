import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query as marieQuery } from '@/lib/db';
import { isAdmin } from '@/lib/permissions';
import { invalidateStreetClustersForSuburb } from '@/lib/redis';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  const allowedColumns = [
    'address', 'suburb', 'city', 'region', 'postcode',
    'bedrooms', 'bathrooms', 'car_spaces',
    'year_built', 'floor_size', 'land_area', 'land_area_numeric',
    'last_sold_price', 'last_sold_date',
    'capital_value', 'land_value', 'improvement_value',
    'property_url', 'cover_image_url',
    'description', 'property_type',
    'status', 'sale_status',
    'has_rental_history', 'is_currently_rented',
    'estimated_value_low', 'estimated_value_high',
    'property_history',
    'suburb_median_price', 'suburb_median_rent', 'suburb_days_on_market',
    'no_junk_mail',
  ];

  const updates: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  for (const col of allowedColumns) {
    if (body[col] !== undefined) {
      updates.push(`${col} = $${idx}`);
      values.push(body[col] === '' ? null : body[col]);
      idx++;
    }
  }

  if (body.no_junk_mail !== undefined) {
    updates.push('no_junk_mail_updated_at = NOW()');
  }

  if (updates.length === 0) {
    return NextResponse.json({ success: false, error: 'No valid fields to update' }, { status: 400 });
  }

  values.push(id);
  const sql = `UPDATE properties SET ${updates.join(', ')} WHERE id = $${idx}`;

  try {
    await marieQuery(sql, values);

    // Refresh MV if no_junk_mail was updated so outreach queries see the latest value
    if (body.no_junk_mail !== undefined && process.env.USE_OUTREACH_MV === 'true') {
      marieQuery('REFRESH MATERIALIZED VIEW CONCURRENTLY outreach_enriched')
        .catch(err => console.error('MV refresh failed (non-critical):', err));
    }

    const updated = await marieQuery(
      `SELECT * FROM properties WHERE id = $1`,
      [id]
    );
    const row = updated.rows[0] as Record<string, unknown> | undefined;
    const suburbForCache = typeof row?.suburb === 'string' ? row.suburb : null;

    if (suburbForCache) {
      invalidateStreetClustersForSuburb(suburbForCache).catch(() => { });
    }

    return NextResponse.json({
      success: true,
      property: row ? {
        id: row['id'] as string,
        address: row['address'] as string | null,
        suburb: row['suburb'] as string | null,
        city: row['city'] as string | null,
        region: row['region'] as string | null,
        bedrooms: row['bedrooms'] !== null ? Number(row['bedrooms']) : null,
        bathrooms: row['bathrooms'] !== null ? Number(row['bathrooms']) : null,
        garages: row['car_spaces'] !== null ? Number(row['car_spaces']) : null,
        rv: row['capital_value'] !== null ? Number(row['capital_value']) : null,
        last_sold_price: row['last_sold_price'] !== null ? Number(row['last_sold_price']) : null,
        last_sold_date: (row['last_sold_date'] as string | null) ?? "",
        build_year: row['year_built'] ? Number(row['year_built']) : null,
        land_area: row['land_area'] !== null && row['land_area'] !== '-' ? (row['land_area'] as string | null) : null,
        floor_area: (row['floor_size'] as string | number | null) ?? null,
        image_url: (row['cover_image_url'] as string | null) || 'https://via.placeholder.com/400x300/e2e8f0/64748b?text=No+Image',
        property_url: row['property_url'] as string | null,
        description: (row['description'] as string | null) ?? null,
        realestate_url: row['realestate_url'] as string | null,
        postcode: row['postcode'] as string | null,
        land_value: row['land_value'] !== null ? Number(row['land_value']) : null,
        improvement_value: row['improvement_value'] !== null ? Number(row['improvement_value']) : null,
        has_rental_history: row['has_rental_history'] === null ? null : row['has_rental_history'] === true || row['has_rental_history'] === 't',
        is_currently_rented: row['is_currently_rented'] === null ? null : row['is_currently_rented'] === true || row['is_currently_rented'] === 't',
        status: row['status'] as string | null,
        property_history: row['property_history'] as string | null,
        normalized_address: row['normalized_address'] as string | null,
        address_fingerprint: row['address_fingerprint'] as string | null,
        land_area_numeric: row['land_area_numeric'] as number | null,
        property_type: row['property_type'] as string | null,
        sale_status: row['sale_status'] as string | null,
        sale_status_source: row['sale_status_source'] as string | null,
        sale_status_updated_at: row['sale_status_updated_at'] as string | null,
        estimated_value_low: row['estimated_value_low'] !== null ? Number(row['estimated_value_low']) : null,
        estimated_value_high: row['estimated_value_high'] !== null ? Number(row['estimated_value_high']) : null,
        suburb_median_price: row['suburb_median_price'] !== null ? Number(row['suburb_median_price']) : null,
        suburb_median_rent: row['suburb_median_rent'] !== null ? Number(row['suburb_median_rent']) : null,
        suburb_days_on_market: row['suburb_days_on_market'] !== null ? Number(row['suburb_days_on_market']) : null,
        images: row['images'] as unknown[] | null,
        latitude: row['latitude'] !== null ? Number(row['latitude']) : null,
        longitude: row['longitude'] !== null ? Number(row['longitude']) : null,
        created_at: row['created_at'] as string | null,
      } : null,
    });
  } catch (error: unknown) {
    console.error('Error updating property:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update property' },
      { status: 500 }
    );
  }
}

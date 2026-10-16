import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { marieDB, ensureOutreachTablesExist } from '@/lib/db';
import { isAdmin } from '@/lib/permissions';
import { invalidateStreetClustersForSuburb } from '@/lib/redis';

interface PropertyInput {
  louis_property_id: string;
  property_address: string;
  suburb: string;
  street?: string;
  city?: string;
  bedrooms?: number;
  bathrooms?: number;
  rv_value?: number;
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await ensureOutreachTablesExist();
    const { properties } = await request.json() as { properties: PropertyInput[] };

    if (!properties || properties.length === 0) {
      return NextResponse.json({ error: 'No properties provided' }, { status: 400 });
    }

    const affectedSuburbs = new Set<string>();

    const insertPromises = properties.map((property: PropertyInput) => {
      if (property.suburb) affectedSuburbs.add(property.suburb);
      const city = property.city ?? 'Auckland City';
      const region = 'Auckland';
      if (property.louis_property_id) {
        return (async () => {
          const dup = await marieDB.query(
            `SELECT id FROM outreach_properties WHERE louis_property_id = $1 LIMIT 1`,
            [property.louis_property_id]
          );
          if (dup.rows.length > 0) return { rows: [] };
          return marieDB.query(
            `INSERT INTO outreach_properties
             (louis_property_id, property_address, suburb, street, city, region,
              owner_name, property_type, campaign, status, selected_by, selected_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', $10, NOW())
             ON CONFLICT (property_address, campaign) DO NOTHING
             RETURNING id`,
            [
              property.louis_property_id || null,
              property.property_address,
              property.suburb,
              property.street ?? null,
              city,
              region,
              null,
              null,
              null,
              session.user.email,
            ]
          );
        })();
      }
      return marieDB.query(
        `INSERT INTO outreach_properties
         (louis_property_id, property_address, suburb, street, city, region,
          owner_name, property_type, campaign, status, selected_by, selected_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', $10, NOW())
         ON CONFLICT (property_address, campaign) DO NOTHING
         RETURNING id`,
        [
          property.louis_property_id || null,
          property.property_address,
          property.suburb,
          property.street ?? null,
          city,
          region,
          null,
          null,
          null,
          session.user.email,
        ]
      );
    });

    const results = await Promise.all(insertPromises);
    const successCount = results.filter(r => r.rows.length > 0).length;

    for (const suburb of affectedSuburbs) {
      invalidateStreetClustersForSuburb(suburb).catch(() => { });
    }

    return NextResponse.json({
      success: true,
      added: successCount,
      skipped: properties.length - successCount,
      message: `Added ${successCount} properties to outreach queue${
        successCount < properties.length
          ? ` (${properties.length - successCount} already existed)`
          : ''
      }`,
    });
  } catch (error) {
    console.error('Error adding properties to outreach:', error);
    return NextResponse.json({ error: 'Failed to add properties to outreach' }, { status: 500 });
  }
}

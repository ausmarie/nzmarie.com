import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/drizzle';
import { isAdmin } from '@/lib/permissions';
import { findLocationBySuburb } from '@/lib/geo-data';
import { sql, and, or, eq, ilike, desc, count } from 'drizzle-orm';
import { appraisalLeads } from '@/database/schema';

let hasLocationColumns: boolean | null = null;

async function checkLocationColumns(): Promise<boolean> {
  if (hasLocationColumns !== null) return hasLocationColumns;
  try {
    const result = await db.execute(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'appraisal_leads'
        AND column_name IN ('region', 'city')
    `);
    hasLocationColumns = result.rows.length === 2;
  } catch {
    hasLocationColumns = false;
  }
  return hasLocationColumns;
}

function hasMeaningfulLocationValue(value: string | null | undefined): value is string {
  if (!value) return false;
  return value.trim().toLowerCase() !== 'unknown';
}

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const region = searchParams.get('region');
  const city = searchParams.get('city');
  const suburb = searchParams.get('suburb');
  const status = searchParams.get('status');
  const priority = searchParams.get('priority');
  const search = searchParams.get('search');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = (page - 1) * limit;

  const useLocationColumns = await checkLocationColumns();

  try {
    const conditions: ReturnType<typeof eq>[] = [];

    if (useLocationColumns) {
      if (region) conditions.push(eq(appraisalLeads.region, region));
      if (city) conditions.push(eq(appraisalLeads.city, city));
    }

    if (suburb) {
      if (suburb === 'Other') {
        const suburbOr = or(eq(appraisalLeads.suburb, ''), sql`${appraisalLeads.suburb} IS NULL`);
        if (suburbOr) conditions.push(suburbOr);
      } else {
        conditions.push(eq(appraisalLeads.suburb, suburb));
      }
    }
    if (status) conditions.push(eq(appraisalLeads.contact_status, status));
    if (priority) conditions.push(eq(appraisalLeads.priority, priority));

    if (search) {
      const searchConditions = [
        ilike(appraisalLeads.client_name, `%${search}%`),
        ilike(appraisalLeads.email, `%${search}%`),
        ilike(appraisalLeads.phone, `%${search}%`),
        ilike(appraisalLeads.property_address, `%${search}%`),
        ilike(appraisalLeads.suburb, `%${search}%`),
      ];
      if (useLocationColumns) {
        searchConditions.push(ilike(appraisalLeads.region, `%${search}%`));
        searchConditions.push(ilike(appraisalLeads.city, `%${search}%`));
      }
      const searchOr = or(...searchConditions);
      if (searchOr) conditions.push(searchOr);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, countResult] = await Promise.all([
      db.select({
        id: appraisalLeads.id,
        client_name: appraisalLeads.client_name,
        email: appraisalLeads.email,
        phone: appraisalLeads.phone,
        property_address: appraisalLeads.property_address,
        suburb: appraisalLeads.suburb,
        region: appraisalLeads.region,
        city: appraisalLeads.city,
        contact_status: appraisalLeads.contact_status,
        priority: appraisalLeads.priority,
        created_at: appraisalLeads.created_at,
        next_follow_up_at: appraisalLeads.follow_up_at,
        agent_notes: appraisalLeads.agent_notes,
        timeline: appraisalLeads.timeline,
        motivation: appraisalLeads.motivation,
        languagePreference: appraisalLeads.language_preference,
        heardFrom: appraisalLeads.heard_from,
      }).from(appraisalLeads)
        .where(whereClause)
        .orderBy(desc(appraisalLeads.created_at))
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(appraisalLeads).where(whereClause),
    ]);

    const mappedRows = rows.map(row => {
      const fallbackLocation =
        !hasMeaningfulLocationValue(row.region) || !hasMeaningfulLocationValue(row.city)
          ? findLocationBySuburb(row.suburb || '')
          : null;
      return {
        ...row,
        region: useLocationColumns
          ? (hasMeaningfulLocationValue(row.region) ? row.region : fallbackLocation?.region || null)
          : null,
        city: useLocationColumns
          ? (hasMeaningfulLocationValue(row.city) ? row.city : fallbackLocation?.city || null)
          : null,
        suburb: row.suburb || 'Other',
      };
    });

    const total = countResult[0]?.total ?? 0;

    return NextResponse.json({
      data: mappedRows,
      locationStats: [],
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Error fetching bookings:', error);
    return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { marieDB } from '@/lib/db';
import { isAdmin } from '@/lib/permissions';

/**
 * POST /api/admin/outreach/check-duplicate
 * Check if an address already exists in the outreach system
 * Returns detailed information if duplicate found
 */
export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await marieDB.ensureOutreachTablesExist?.();
    const body = await request.json() as { address?: string; campaign?: string; louis_property_id?: string };
    const { address, campaign, louis_property_id } = body;

    if (!address || typeof address !== 'string') {
      return NextResponse.json(
        { error: 'Address is required' },
        { status: 400 }
      );
    }

    console.log(`[check-duplicate] Checking address: "${address}" in campaign: "${campaign}"`);

    // Prefer matching by louis_property_id when available (more reliable)
    let result;
    if (louis_property_id) {
      result = await marieDB.query(
        `SELECT id, property_address, suburb, city, region, campaign, status, sent_at, interacted_at, converted_at, created_at
         FROM outreach_properties WHERE louis_property_id = $1 LIMIT 1`,
        [louis_property_id.trim()]
      );
    } else {
      const normalizedAddress = address
        .toLowerCase()
        .replace(/,\s*new\s*zealand/g, '')
        .replace(/new\s*zealand/g, '')
        .replace(/\b\d{4}\b/g, '')
        .replace(/[^a-z0-9]/g, '');

      let query = `
        SELECT 
          id,
          property_address,
          suburb,
          city,
          region,
          campaign,
          status,
          sent_at,
          interacted_at,
          converted_at,
          created_at
        FROM outreach_properties
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
        ) = $1
      `;
      const params: unknown[] = [normalizedAddress];

      if (campaign) {
        query += ` AND campaign = $2`;
        params.push(campaign);
      }

      query += ` ORDER BY created_at DESC LIMIT 1`;

      result = await marieDB.query(query, params);
    }

    if (result.rows.length > 0) {
      const existing = result.rows[0];
      console.log(`[check-duplicate] Found duplicate: ${existing.property_address}`);
      return NextResponse.json({
        exists: true,
        duplicate: {
          id: existing.id,
          address: existing.property_address,
          suburb: existing.suburb,
          city: existing.city,
          region: existing.region,
          campaign: existing.campaign,
          status: existing.status,
          sent_at: existing.sent_at,
          interacted_at: existing.interacted_at,
          converted_at: existing.converted_at,
          created_at: existing.created_at,
        },
      });
    }

    console.log(`[check-duplicate] No duplicate found`);
    return NextResponse.json({
      exists: false,
      message: 'Address is available',
    });
  } catch (error) {
    console.error('Error checking duplicate:', error);
    return NextResponse.json(
      { error: 'Failed to check duplicate' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query as marieQuery } from '@/lib/db';
import { isSuperAdmin } from '@/lib/permissions';

const BUCKETS = ['0-3', '3-5', '5-10', '10-15', '15+', 'no_data'] as const;
type Bucket = typeof BUCKETS[number];

function getBucket(lastSoldDate: string | null): Bucket {
  if (!lastSoldDate) return 'no_data';
  const date = new Date(lastSoldDate);
  const now = new Date();
  const years = (now.getTime() - date.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  if (years <= 3) return '0-3';
  if (years <= 5) return '3-5';
  if (years <= 10) return '5-10';
  if (years <= 15) return '10-15';
  return '15+';
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.email || !isSuperAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const typeFilter = searchParams.get('type') || 'all';

  try {
    const conditions: string[] = [
      `re.city = 'North Shore City'`,
      `LOWER(re.status) IN ('for sale', 'under offer')`,
      `re.suburb IS NOT NULL`,
    ];
    const params: unknown[] = [];

    if (typeFilter === 'house') {
      conditions.push(`LOWER(re.property_type) IN ('house', 'standalone house')`);
    } else if (typeFilter === 'townhouse') {
      conditions.push(`LOWER(re.property_type) IN ('townhouse', 'unit', 'apartment')`);
    }

    const whereClause = conditions.join('\n  AND ');

    const result = await marieQuery<{
      suburb: string;
      address: string;
      last_sold_date: string | null;
    }>(
      `SELECT
        re.suburb,
        re.address,
        p.last_sold_date
      FROM real_estate re
      LEFT JOIN properties p
        ON LOWER(REGEXP_REPLACE(TRIM(SPLIT_PART(re.address, ',', 1)), '  +', ' ', 'g')) = LOWER(REGEXP_REPLACE(TRIM(p.address), '  +', ' ', 'g'))
        AND LOWER(REGEXP_REPLACE(TRIM(re.suburb), '  +', ' ', 'g')) = LOWER(REGEXP_REPLACE(TRIM(p.suburb), '  +', ' ', 'g'))
      WHERE
        ${whereClause}
      ORDER BY re.suburb`,
      params
    );

    const rows = result.rows;

    const suburbBuckets: Record<string, Record<Bucket, number>> = {};
    const suburbTotal: Record<string, number> = {};
    const northShoreBuckets: Record<Bucket, number> = { '0-3': 0, '3-5': 0, '5-10': 0, '10-15': 0, '15+': 0, 'no_data': 0 };
    let northShoreTotal = 0;

    for (const row of rows) {
      const sub = row.suburb || 'Unknown';
      if (!suburbBuckets[sub]) {
        suburbBuckets[sub] = { '0-3': 0, '3-5': 0, '5-10': 0, '10-15': 0, '15+': 0, 'no_data': 0 };
        suburbTotal[sub] = 0;
      }
      const bucket = getBucket(row.last_sold_date);
      suburbBuckets[sub][bucket]++;
      suburbTotal[sub]++;
      northShoreBuckets[bucket]++;
      northShoreTotal++;
    }

    const suburbData = Object.entries(suburbBuckets).map(([suburb, buckets]) => ({
      suburb,
      total: suburbTotal[suburb],
      buckets: BUCKETS.map(b => ({
        range: b,
        count: buckets[b],
        percentage: suburbTotal[suburb] > 0 ? Math.round((buckets[b] / suburbTotal[suburb]) * 100) : 0,
      })),
    }));

    suburbData.sort((a, b) => b.total - a.total);

    return NextResponse.json({
      success: true,
      suburbs: suburbData,
      northShore: {
        total: northShoreTotal,
        buckets: BUCKETS.map(b => ({
          range: b,
          count: northShoreBuckets[b],
          percentage: northShoreTotal > 0 ? Math.round((northShoreBuckets[b] / northShoreTotal) * 100) : 0,
        })),
      },
    });
  } catch (error: unknown) {
    console.error('Error fetching last-sold data:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch last-sold data' },
      { status: 500 }
    );
  }
}

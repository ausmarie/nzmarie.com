import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const queryParam = searchParams.get('q')?.trim();
  const city = searchParams.get('city')?.trim();

  if (!queryParam || queryParam.length < 2) {
    return NextResponse.json([]);
  }

  try {
    const params: unknown[] = [`%${queryParam}%`];
    let whereClause = 'address ILIKE $1';

    const CITY_TO_DB: Record<string, string> = {
      'Auckland': 'Auckland - City',
      'Auckland City': 'Auckland - City',
    };

    if (city) {
      const dbCity = CITY_TO_DB[city] || city;
      whereClause += ' AND city = $2';
      params.push(dbCity);
    }

    const sql = `
      SELECT DISTINCT id, address, suburb, city
      FROM properties
      WHERE ${whereClause}
      ORDER BY address
      LIMIT 10
    `;

    const result = await query(sql, params);
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Autocomplete route error:', error);
    return NextResponse.json([], { status: 500 });
  }
}

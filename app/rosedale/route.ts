import { NextResponse } from 'next/server';
import { marieDB } from '@/lib/db';

export async function GET(request: Request) {
  try {
    await marieDB.query(
      'UPDATE suburb_qr_codes SET scan_count = scan_count + 1 WHERE suburb = $1',
      ['rosedale']
    );
  } catch {
  }
  const redirectUrl = new URL('/', request.url);
  redirectUrl.searchParams.set('utm_source', 'qr');
  redirectUrl.searchParams.set('utm_campaign', 'rosedale');
  return NextResponse.redirect(redirectUrl);
}

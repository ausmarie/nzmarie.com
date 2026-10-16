import { NextResponse } from 'next/server';
import { after } from 'next/server';
import { marieDB } from '@/lib/db';
import { getClientIp } from '@/lib/campaign-tracker';

export async function GET(request: Request) {
  const redirectUrl = new URL('/', request.url);
  redirectUrl.searchParams.set('utm_source', 'business_card');
  redirectUrl.searchParams.set('utm_medium', 'qr');
  redirectUrl.searchParams.set('utm_campaign', 'business_card');

  const userAgent = request.headers.get('user-agent') || 'unknown';
  const ipAddress = getClientIp(request);

  after(async () => {
    try {
      await marieDB.ensureOutreachTablesExist?.();
      await marieDB.query(
        `INSERT INTO card_qr_scan_logs (source, user_agent, ip_address) VALUES ($1, $2, $3)`,
        ['card', userAgent, ipAddress]
      );
    } catch (err) {
      console.error('Failed to log business card QR scan:', err);
    }
  });

  return NextResponse.redirect(redirectUrl);
}

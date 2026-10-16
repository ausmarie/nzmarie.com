import { NextResponse } from 'next/server';
import { marieDB } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    await marieDB.ensureOutreachTablesExist?.();
    const { token } = await params;

    const result = await marieDB.query(
      `SELECT 
        oqt.id as token_id,
        oqt.outreach_property_id,
        op.property_address,
        op.suburb,
        op.status,
        op.campaign
      FROM outreach_qr_tokens oqt
      JOIN outreach_properties op ON op.id = oqt.outreach_property_id
      WHERE oqt.token = $1`,
      [token]
    );

    if (result.rows.length === 0) {
      return NextResponse.redirect(new URL('/', request.url));
    }

    const record = result.rows[0];

    await marieDB.query(
      `UPDATE outreach_qr_tokens 
       SET scanned_at = COALESCE(scanned_at, NOW()), 
           scan_count = scan_count + 1 
       WHERE id = $1`,
      [record.token_id]
    );

    if (record.status === 'sent') {
      await marieDB.query(
        `UPDATE outreach_properties 
         SET status = 'interacted', 
             interacted_at = NOW() 
         WHERE id = $1 AND status = 'sent'`,
        [record.outreach_property_id]
      );
    }

    const redirectUrl = new URL('/', request.url);
    redirectUrl.searchParams.set('address', record.property_address);
    redirectUrl.searchParams.set('suburb', record.suburb);
    redirectUrl.searchParams.set('utm_source', 'direct_mail');
    redirectUrl.searchParams.set('utm_campaign', record.campaign);

    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error('QR tracking error:', error);
    return NextResponse.redirect(new URL('/', request.url));
  }
}

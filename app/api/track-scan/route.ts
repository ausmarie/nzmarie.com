import { NextResponse } from 'next/server';
import { recordCampaignVisit, getClientIp } from '@/lib/campaign-tracker';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }

    const suburb = typeof body.suburb === 'string' ? body.suburb.trim() : '';
    const visitorId = typeof body.visitorId === 'string' ? body.visitorId : '';
    const ua = typeof body.ua === 'string' ? body.ua : request.headers.get('user-agent') || '';

    if (!suburb || !/^[a-z0-9-_]+$/i.test(suburb)) {
      return NextResponse.json({ error: 'Invalid suburb' }, { status: 400 });
    }

    const ip = getClientIp(request);

    await recordCampaignVisit({
      campaignKey: suburb,
      campaignName: suburb.replace(/[-_]/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
      ip,
      userAgent: ua,
      referrer: 'qr_scan',
      visitorId: visitorId || undefined,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to record scan via beacon:', error);
    return NextResponse.json({ error: 'Failed to record scan' }, { status: 500 });
  }
}

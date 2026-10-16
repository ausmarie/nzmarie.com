import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { query } from '@/lib/db';

const VALID_SECTIONS = new Set([
  'hero', 'about', 'appraisal', 'services',
  'property_listings', 'qualifications', 'contact', 'report_download',
]);

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }

    const section = typeof body.section === 'string' ? body.section.trim().toLowerCase() : '';
    const suburb = typeof body.suburb === 'string' ? body.suburb.trim() : '';
    const visitorId = typeof body.visitorId === 'string' ? body.visitorId : '';
    const isNewDevice = typeof body.isNewDevice === 'boolean' ? body.isNewDevice : false;

    if (!section || !VALID_SECTIONS.has(section)) {
      return NextResponse.json({ error: 'Invalid section' }, { status: 400 });
    }

    const visitorHash = visitorId
      ? createHash('sha256').update(`device:${visitorId}`).digest('hex')
      : createHash('sha256').update(`anon:${request.headers.get('user-agent') || 'unknown'}`).digest('hex');

    await query(
      `INSERT INTO section_view_logs (campaign_key, visitor_hash, section_name, is_new_device)
       VALUES ($1, $2, $3, $4)`,
      [suburb || null, visitorHash, section, isNewDevice]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to record section view:', error);
    return NextResponse.json({ error: 'Failed to record section view' }, { status: 500 });
  }
}

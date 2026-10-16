import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { marieDB } from '@/lib/db';
import { isAdmin } from '@/lib/permissions';

const KEY = 'default_outreach_campaign';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let campaign = '';
  try {
    const body = await request.json();
    campaign = typeof body?.campaign === 'string' ? body.campaign.trim() : '';
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!campaign) {
    return NextResponse.json({ error: 'campaign is required' }, { status: 400 });
  }

  try {
    await marieDB.ensureOutreachTablesExist?.();
    await marieDB.query(
      `INSERT INTO admin_settings (setting_key, setting_value, updated_at, updated_by)
       VALUES ($1, $2, NOW(), $3)
       ON CONFLICT (setting_key)
       DO UPDATE SET setting_value = $2, updated_at = NOW(), updated_by = $3`,
      [KEY, campaign, session.user.email]
    );
    return NextResponse.json({ success: true, campaign });
  } catch (error) {
    console.error('Error saving default campaign:', error);
    return NextResponse.json({ error: 'Failed to save default campaign' }, { status: 500 });
  }
}

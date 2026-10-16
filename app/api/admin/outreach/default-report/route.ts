import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { marieDB } from '@/lib/db';
import { isAdmin } from '@/lib/permissions';

const KEY_PREFIX = 'default_outreach_report_';

function getKey(quarter: string | null | undefined) {
  return quarter ? `${KEY_PREFIX}${quarter}` : 'default_outreach_report';
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const quarter = new URL(request.url).searchParams.get('quarter');

  try {
    await marieDB.ensureOutreachTablesExist?.();
    const result = await marieDB.query(
      `SELECT setting_value FROM admin_settings WHERE setting_key = $1 LIMIT 1`,
      [getKey(quarter)]
    );
    let rawValue = result?.rows?.[0]?.setting_value;
    if ((rawValue === null || rawValue === undefined || rawValue === '') && quarter) {
      const fallbackResult = await marieDB.query(
        `SELECT setting_value FROM admin_settings WHERE setting_key = $1 LIMIT 1`,
        ['default_outreach_report']
      );
      const fallbackValue = fallbackResult?.rows?.[0]?.setting_value;
      if (fallbackValue !== null && fallbackValue !== undefined && fallbackValue !== '') {
        try {
          const parsed = JSON.parse(fallbackValue) as { suburb?: unknown; label?: unknown };
          if (parsed?.label === quarter) {
            rawValue = fallbackValue;
          }
        } catch {
        }
      }
    }
    let defaultReport: { suburb: string; label: string } | null = null;
    if (rawValue !== null && rawValue !== undefined && rawValue !== '') {
      try {
        const parsed = JSON.parse(rawValue) as { suburb?: unknown; label?: unknown };
        if (
          typeof parsed.suburb === 'string' &&
          parsed.suburb &&
          typeof parsed.label === 'string' &&
          parsed.label
        ) {
          defaultReport = { suburb: parsed.suburb, label: parsed.label };
        }
      } catch {
      }
    }
    return NextResponse.json({ success: true, defaultReport });
  } catch (error) {
    console.error('Error reading default report:', error);
    return NextResponse.json({ success: true, defaultReport: null });
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let suburb = '';
  let label = '';
  let quarter = '';
  try {
    const body = await request.json();
    suburb = typeof body?.suburb === 'string' ? body.suburb.trim() : '';
    label = typeof body?.label === 'string' ? body.label.trim() : '';
    quarter = typeof body?.quarter === 'string' ? body.quarter.trim() : '';
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!suburb || !label) {
    return NextResponse.json({ error: 'suburb and label are required' }, { status: 400 });
  }

  const value = JSON.stringify({ suburb, label });

  try {
    await marieDB.ensureOutreachTablesExist?.();
    await marieDB.query(
      `INSERT INTO admin_settings (setting_key, setting_value, updated_at, updated_by)
       VALUES ($1, $2, NOW(), $3)
       ON CONFLICT (setting_key)
       DO UPDATE SET setting_value = $2, updated_at = NOW(), updated_by = $3`,
      [getKey(quarter), value, session.user.email]
    );
    if (quarter) {
      await marieDB.query(
        `INSERT INTO admin_settings (setting_key, setting_value, updated_at, updated_by)
         VALUES ('default_outreach_report', $1, NOW(), $2)
         ON CONFLICT (setting_key)
         DO UPDATE SET setting_value = $1, updated_at = NOW(), updated_by = $2`,
        [value, session.user.email]
      );
    }
    return NextResponse.json({ success: true, defaultReport: { suburb, label } });
  } catch (error) {
    console.error('Error saving default report:', error);
    return NextResponse.json({ error: 'Failed to save default report' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { marieDB } from '@/lib/db';
import { isAdmin } from '@/lib/permissions';
import { parseReportQuarter } from '@/lib/outreach-quarter';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const quarter = new URL(request.url).searchParams.get('quarter');
  const qi = parseReportQuarter(quarter);

  try {
    await marieDB.ensureOutreachTablesExist?.();

    const params: unknown[] = [];
    let sentClause: string;
    let unsentClause: string;
    let junkClause = '';

    if (qi) {
      params.push(qi.quarter, qi.year, qi.campaignPattern);      sentClause = `EXISTS (
        SELECT 1 FROM outreach_send_logs sl
        LEFT JOIN suburb_reports sr ON sl.suburb_report_id = sr.id
        WHERE sl.outreach_property_id = op.id
          AND (sl.suburb = op.suburb OR sr.suburb = op.suburb OR sl.suburb IS NULL)
          AND ((sr.quarter = $1 AND sr.year = $2) OR sl.campaign_key ~ $3 OR op.last_campaign ~ $3)
      )`;
      unsentClause = `NOT EXISTS (
        SELECT 1 FROM outreach_send_logs sl
        LEFT JOIN suburb_reports sr ON sl.suburb_report_id = sr.id
        WHERE sl.outreach_property_id = op.id
          AND (sl.suburb = op.suburb OR sr.suburb = op.suburb OR sl.suburb IS NULL)
          AND ((sr.quarter = $1 AND sr.year = $2) OR sl.campaign_key ~ $3 OR op.last_campaign ~ $3)
      )`;
      junkClause = `AND NOT EXISTS (
        SELECT 1 FROM properties p
        WHERE REPLACE(op.property_id::text, '-', '') = p.id
          AND p.no_junk_mail = true
      )`;
    } else {
      sentClause = `EXISTS (
        SELECT 1 FROM outreach_send_logs sl
        JOIN suburb_reports sr ON sl.suburb_report_id = sr.id
        WHERE sl.outreach_property_id = op.id
          AND sr.suburb = op.suburb
      )
      OR op.status = 'sent'
      OR COALESCE(op.total_send_count, 0) > 0
      OR op.last_sent_at IS NOT NULL
      OR op.sent_at IS NOT NULL`;
      unsentClause = `NOT EXISTS (
        SELECT 1 FROM outreach_send_logs sl
        JOIN suburb_reports sr ON sl.suburb_report_id = sr.id
        WHERE sl.outreach_property_id = op.id
          AND sr.suburb = op.suburb
      )
      AND COALESCE(op.total_send_count, 0) = 0
      AND op.last_sent_at IS NULL
      AND op.sent_at IS NULL
      AND op.status <> 'sent'`;
      junkClause = `AND NOT EXISTS (
        SELECT 1 FROM properties p
        WHERE REPLACE(op.property_id::text, '-', '') = p.id
          AND p.no_junk_mail = true
      )`;
    }

    const result = await marieDB.query(
      `SELECT
        op.suburb,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (
          WHERE (${sentClause})
        )::int AS sent,
        COUNT(*) FILTER (
          WHERE (${unsentClause})
          ${junkClause}
        )::int AS unsent
      FROM outreach_properties op
      WHERE op.suburb IS NOT NULL AND op.suburb <> ''
        AND op.status IN ('pending', 'sent')
      GROUP BY op.suburb`,
      params
    );

    const stats: Record<string, { total: number; sent: number; unsent: number }> = {};
    for (const row of result.rows as Record<string, unknown>[]) {
      stats[String(row.suburb)] = {
        total: Number(row.total),
        sent: Number(row.sent),
        unsent: Number(row.unsent),
      };
    }

    return NextResponse.json({ stats });
  } catch (error) {
    console.error('Error fetching suburb sent stats:', error);
    return NextResponse.json({ error: 'Failed to fetch suburb stats' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { marieDB } from '@/lib/db';
import { isAdmin } from '@/lib/permissions';
import { invalidateStreetClustersForSuburb } from '@/lib/redis';

// Forces the suburb segment of a campaign key (e.g. "2026_Q2_Fairview Heights")
// to match the property being sent, so sends are never logged under the wrong
// suburb's campaign. Keys without a suburb segment (e.g. "2026_Q2") are kept.
function campaignKeyForSuburb(campaignKey: string, suburb: string): string {
  const trimmed = campaignKey.trim();
  const parts = trimmed.split('_');
  if (parts.length >= 3) {
    const last = parts[parts.length - 1];
    if (last.trim().toLowerCase() !== suburb.trim().toLowerCase()) {
      return `${parts.slice(0, parts.length - 1).join('_')}_${suburb}`;
    }
  }
  return trimmed;
}

function extractQuarterKey(campaignKey: string): string | null {
  const match = campaignKey.match(/^(\d{4})[_-]([Qq][1-4])/);
  if (match) {
    return `${match[1]}-${match[2].toUpperCase()}`;
  }
  return null;
}

async function upsertQuarterStatus(
  propertyId: string,
  suburbReportId: string | null,
  suburb: string | null,
  campaignKey: string
) {
  const quarterKey = extractQuarterKey(campaignKey);
  if (!quarterKey || !suburb) return;

  const [yearStr, quarter] = quarterKey.split('-');
  const year = parseInt(yearStr, 10);
  if (!year) return;

  let reportId = suburbReportId;
  if (!reportId && suburb) {
    const reportResult = await marieDB.query(
      `SELECT id FROM suburb_reports WHERE suburb = $1 AND quarter = $2 AND year = $3 AND status = 'active' LIMIT 1`,
      [suburb, quarter, year]
    );
    if (reportResult.rows.length > 0) {
      reportId = reportResult.rows[0].id;
    }
  }

  if (!reportId) return;

  await marieDB.query(
    `INSERT INTO outreach_property_quarter_status 
     (outreach_property_id, suburb_report_id, suburb, quarter, year, status, sent_count, first_sent_at, last_sent_at, campaign_keys)
     VALUES ($1, $2, $3, $4, $5, 'sent', 1, NOW(), NOW(), ARRAY[$6])
     ON CONFLICT (outreach_property_id, suburb_report_id) DO UPDATE SET
       status = CASE 
         WHEN outreach_property_quarter_status.sent_count = 0 THEN 'sent'
         ELSE outreach_property_quarter_status.status
       END,
       sent_count = outreach_property_quarter_status.sent_count + 1,
       last_sent_at = NOW(),
       campaign_keys = array_append(outreach_property_quarter_status.campaign_keys, $6),
       updated_at = NOW()
     WHERE outreach_property_quarter_status.outreach_property_id = $1
       AND outreach_property_quarter_status.suburb_report_id = $2`,
    [
      propertyId,
      reportId,
      suburb,
      quarter,
      year,
      campaignKey,
    ]
  );
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await marieDB.ensureOutreachTablesExist?.();
    const body = await request.json() as {
      property_ids?: string[];
      suburb_report_id?: string;
      report_title?: string;
      campaign_key?: string;
      notes?: string;
    };

    const {
      property_ids,
      suburb_report_id,
      report_title = 'Quarterly Market Report',
      campaign_key = '2026_Q2',
      notes,
    } = body;

    if (!property_ids || !Array.isArray(property_ids) || property_ids.length === 0) {
      return NextResponse.json(
        { error: 'property_ids array is required' },
        { status: 400 }
      );
    }

    const propertiesResult = await marieDB.query(
      `SELECT id, suburb FROM outreach_properties WHERE id = ANY($1::uuid[])`,
      [property_ids]
    );

    if (propertiesResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'No matching properties found' },
        { status: 404 }
      );
    }

    const sendUser = session.user.email;
    const insertedLogs = [];
    const affectedSuburbs = new Set<string>();

    for (const prop of propertiesResult.rows) {
      if (prop.suburb) {
        affectedSuburbs.add(prop.suburb);
      }
      const normalizedKey = campaignKeyForSuburb(campaign_key, prop.suburb);
      const logRes = await marieDB.query(
        `INSERT INTO outreach_send_logs (
          outreach_property_id,
          suburb_report_id,
          report_title,
          campaign_key,
          suburb,
          sent_at,
          sent_by,
          notes
        ) VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7)
        RETURNING *`,
        [
          prop.id,
          suburb_report_id || null,
          report_title,
          normalizedKey,
          prop.suburb,
          sendUser,
          notes || null,
        ]
      );

      await marieDB.query(
        `UPDATE outreach_properties
         SET status = CASE WHEN status = 'pending' THEN 'sent' ELSE status END,
             total_send_count = COALESCE(total_send_count, 0) + 1,
             last_sent_at = NOW(),
             last_campaign = $1,
             sent_at = NOW(),
             sent_by = $2
         WHERE id = $3`,
        [normalizedKey, sendUser, prop.id]
      );

      // Upsert quarter-aware status
      await upsertQuarterStatus(prop.id, suburb_report_id || null, prop.suburb, normalizedKey);

      insertedLogs.push(logRes.rows[0]);
    }

    // Invalidate street-clusters cache for all affected suburbs
    for (const suburb of affectedSuburbs) {
      invalidateStreetClustersForSuburb(suburb).catch(() => { });
    }

    // Refresh quarter materialized views asynchronously
    Promise.all([
      marieDB.query('REFRESH MATERIALIZED VIEW mv_suburb_quarter_summary'),
      marieDB.query('REFRESH MATERIALIZED VIEW mv_quarter_overview'),
      marieDB.query('REFRESH MATERIALIZED VIEW mv_dispatch_timeline'),
    ]).catch(err => console.error('Quarter MV refresh failed (non-critical):', err));

    if (process.env.USE_OUTREACH_MV === 'true') {
      marieDB.query('REFRESH MATERIALIZED VIEW CONCURRENTLY outreach_enriched')
        .catch(err => console.error('MV refresh failed (non-critical):', err));
    }

    return NextResponse.json({
      success: true,
      message: `Successfully logged sending for ${insertedLogs.length} properties`,
      count: insertedLogs.length,
      logs: insertedLogs,
    });
  } catch (error) {
    console.error('Error logging outreach send:', error);
    return NextResponse.json(
      { error: 'Failed to record send log' },
      { status: 500 }
    );
  }
}

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

function extractQuarterInfo(campaignKey: string): { quarter: string; year: number } | null {
  const match = campaignKey.match(/^(\d{4})[_-]([Qq][1-4])/);
  if (!match) return null;
  const year = parseInt(match[1], 10);
  if (!year) return null;
  return { quarter: match[2].toUpperCase(), year };
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
    const properties = propertiesResult.rows as Array<{ id: string; suburb: string | null }>;
    const propertyIds = properties.map((property) => property.id);
    const campaignKeys = properties.map((property) =>
      campaignKeyForSuburb(campaign_key, property.suburb || '')
    );
    const suburbs = properties.map((property) => property.suburb);
    const affectedSuburbs = new Set(suburbs.filter((suburb): suburb is string => Boolean(suburb)));

    const logResult = await marieDB.query(
      `INSERT INTO outreach_send_logs (
        outreach_property_id,
        suburb_report_id,
        report_title,
        campaign_key,
        suburb,
        sent_at,
        sent_by,
        notes
      )
      SELECT
        t.outreach_property_id,
        $2::uuid,
        $3,
        t.campaign_key,
        t.suburb,
        NOW(),
        $4,
        $5
      FROM unnest($1::uuid[], $6::text[], $7::text[])
        AS t(outreach_property_id, campaign_key, suburb)
      RETURNING *`,
      [
        propertyIds,
        suburb_report_id || null,
        report_title,
        sendUser,
        notes || null,
        campaignKeys,
        suburbs,
      ]
    );
    const insertedLogs = logResult.rows;

    await marieDB.query(
      `UPDATE outreach_properties AS op
       SET status = CASE WHEN op.status = 'pending' THEN 'sent' ELSE op.status END,
           total_send_count = COALESCE(op.total_send_count, 0) + 1,
           last_sent_at = NOW(),
           last_campaign = t.campaign_key,
           sent_at = NOW(),
           sent_by = $2
       FROM unnest($1::uuid[], $3::text[]) AS t(id, campaign_key)
       WHERE op.id = t.id`,
      [propertyIds, sendUser, campaignKeys]
    );

    const quarterInfo = extractQuarterInfo(campaign_key);
    if (quarterInfo) {
      let reportBySuburb = new Map<string, string>();
      if (!suburb_report_id) {
        const reportSuburbs = [...new Set(affectedSuburbs)];
        if (reportSuburbs.length > 0) {
          const reportResult = await marieDB.query(
            `SELECT id, suburb
             FROM suburb_reports
             WHERE status = 'active' AND quarter = $1 AND year = $2 AND suburb = ANY($3::text[])`,
            [quarterInfo.quarter, quarterInfo.year, reportSuburbs]
          );
          reportBySuburb = new Map(
            (reportResult.rows as Array<{ id: string; suburb: string }>).map((report) => [
              report.suburb,
              report.id,
            ])
          );
        }
      }

      const quarterRows = properties
        .map((property, index) => ({
          id: property.id,
          reportId: suburb_report_id || (property.suburb ? reportBySuburb.get(property.suburb) : undefined),
          suburb: property.suburb,
          campaignKey: campaignKeys[index],
        }))
        .filter(
          (row): row is { id: string; reportId: string; suburb: string; campaignKey: string } =>
            Boolean(row.reportId && row.suburb)
        );

      if (quarterRows.length > 0) {
        await marieDB.query(
          `INSERT INTO outreach_property_quarter_status
            (outreach_property_id, suburb_report_id, suburb, quarter, year, status, sent_count, first_sent_at, last_sent_at, campaign_keys)
           SELECT
             t.outreach_property_id,
             t.suburb_report_id,
             t.suburb,
             $3,
             $4,
             'sent',
             1,
             NOW(),
             NOW(),
             ARRAY[t.campaign_key]
           FROM unnest($1::uuid[], $2::uuid[], $5::text[], $6::text[])
             AS t(outreach_property_id, suburb_report_id, suburb, campaign_key)
           ON CONFLICT (outreach_property_id, suburb_report_id) DO UPDATE SET
             status = CASE
               WHEN outreach_property_quarter_status.sent_count = 0 THEN 'sent'
               ELSE outreach_property_quarter_status.status
             END,
             sent_count = outreach_property_quarter_status.sent_count + 1,
             last_sent_at = NOW(),
             campaign_keys = array_append(
               COALESCE(outreach_property_quarter_status.campaign_keys, ARRAY[]::text[]),
               EXCLUDED.campaign_keys[1]
             ),
             updated_at = NOW()`,
          [
            quarterRows.map((row) => row.id),
            quarterRows.map((row) => row.reportId),
            quarterInfo.quarter,
            quarterInfo.year,
            quarterRows.map((row) => row.suburb),
            quarterRows.map((row) => row.campaignKey),
          ]
        );
      }
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

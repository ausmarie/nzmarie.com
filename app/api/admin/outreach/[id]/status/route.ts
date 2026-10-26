import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { marieDB } from '@/lib/db';
import { isAdmin } from '@/lib/permissions';
import { invalidateDashboardStatsCache, invalidateStreetClustersForSuburb } from '@/lib/redis';

export async function PATCH(
  _request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const session = await auth();

  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await _request.json() as {
      status: string;
      return_to_pending?: boolean;
      report_quarter?: string;
    };
    const { status, return_to_pending: returnToPending } = body;

    const validStatuses = ['liked', 'pending', 'sent', 'interacted', 'converted'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    let targetQuarter: { year: number; quarter: string } | null = null;
    if (status === 'pending' && returnToPending) {
      const quarterMatch = body.report_quarter?.match(/^(\d{4})-(Q[1-4])$/);
      if (quarterMatch) {
        targetQuarter = { year: Number(quarterMatch[1]), quarter: quarterMatch[2] };
      } else if (body.report_quarter) {
        return NextResponse.json({ error: 'Invalid report quarter' }, { status: 400 });
      }
    }

    await marieDB.ensureOutreachTablesExist?.();
    if (status === 'pending' && returnToPending && !targetQuarter) {
      const latestSentQuarter = await marieDB.query(
        `SELECT year, quarter
         FROM (
           SELECT q.year, q.quarter, q.last_sent_at AS activity_at
           FROM outreach_property_quarter_status q
           WHERE q.outreach_property_id = $1
             AND q.status IN ('sent', 'partial')
           UNION ALL
           SELECT sr.year, sr.quarter, sl.sent_at AS activity_at
           FROM outreach_send_logs sl
           JOIN suburb_reports sr ON sr.id = sl.suburb_report_id
           WHERE sl.outreach_property_id = $1
             AND sr.quarter ~ '^Q[1-4]$'
         ) sent_quarters
         ORDER BY year DESC, quarter DESC, activity_at DESC NULLS LAST
         LIMIT 1`,
        [params.id]
      );
      const latest = latestSentQuarter.rows[0] as { year?: number; quarter?: string } | undefined;
      if (latest?.year && latest.quarter) {
        targetQuarter = { year: Number(latest.year), quarter: latest.quarter };
      }
      if (!targetQuarter) {
        return NextResponse.json(
          { error: 'No quarterly send history found for this address' },
          { status: 409 }
        );
      }
    }

    const result = await marieDB.query(
      `UPDATE outreach_properties
       SET status = $1,
           total_send_count = CASE WHEN $1 = 'pending' THEN 0 ELSE total_send_count END,
           last_sent_at = CASE WHEN $1 = 'pending' THEN NULL ELSE last_sent_at END,
           last_campaign = CASE WHEN $1 = 'pending' THEN NULL ELSE last_campaign END,
           sent_at = CASE WHEN $1 = 'pending' THEN NULL ELSE sent_at END,
           sent_by = CASE WHEN $1 = 'pending' THEN NULL ELSE sent_by END,
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [status, params.id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    // When rolling back to pending, clear send fields but KEEP send logs
    // so quarter filtering still works correctly. The status field will be 'pending'
    // but the send log preserves the quarter/campaign association.
    if (status === 'pending' && returnToPending && targetQuarter) {
      await marieDB.query(
        `UPDATE outreach_property_quarter_status
         SET status = 'pending',
             sent_count = 0,
             first_sent_at = NULL,
             last_sent_at = NULL
         WHERE outreach_property_id = $1
           AND year = $2
           AND quarter = $3`,
        [params.id, targetQuarter.year, targetQuarter.quarter]
      );

      // Rebuild missing quarter rows from immutable send history. This also
      // repairs quarter status rows removed by the former all-quarter DELETE.
      await marieDB.query(
        `WITH logged_reports AS (
           SELECT
             sr.id AS suburb_report_id,
             sr.suburb,
             sr.quarter,
             sr.year,
             ARRAY_AGG(DISTINCT sl.campaign_key)
               FILTER (WHERE sl.campaign_key IS NOT NULL) AS campaign_keys
           FROM outreach_send_logs sl
           JOIN suburb_reports sr ON sr.id = sl.suburb_report_id
           WHERE sl.outreach_property_id = $1
             AND sr.year = $2
             AND sr.quarter = $3
           GROUP BY sr.id, sr.suburb, sr.quarter, sr.year
         ),
         fallback_report AS (
           SELECT sr.id, sr.suburb, sr.quarter, sr.year, ARRAY[]::text[] AS campaign_keys
           FROM suburb_reports sr
           JOIN outreach_properties op ON op.id = $1 AND op.suburb = sr.suburb
           WHERE sr.year = $2
             AND sr.quarter = $3
             AND sr.status = 'active'
             AND NOT EXISTS (
               SELECT 1
               FROM outreach_property_quarter_status existing
               WHERE existing.outreach_property_id = $1
                 AND existing.year = $2
                 AND existing.quarter = $3
             )
           ORDER BY sr.uploaded_at DESC
           LIMIT 1
         ),
         target_reports AS (
           SELECT * FROM logged_reports
           UNION ALL
           SELECT * FROM fallback_report
           WHERE NOT EXISTS (SELECT 1 FROM logged_reports)
         )
         INSERT INTO outreach_property_quarter_status
           (outreach_property_id, suburb_report_id, suburb, quarter, year, status,
            sent_count, first_sent_at, last_sent_at, campaign_keys)
         SELECT $1, suburb_report_id, suburb, quarter, year, 'pending',
                0, NULL, NULL, COALESCE(campaign_keys, ARRAY[]::text[])
         FROM target_reports
         ON CONFLICT (outreach_property_id, suburb_report_id) DO UPDATE
         SET status = 'pending',
             sent_count = 0,
             first_sent_at = NULL,
             last_sent_at = NULL`,
        [params.id, targetQuarter.year, targetQuarter.quarter]
      );

      const quarterViews = [
        'mv_suburb_quarter_summary',
        'mv_quarter_overview',
        'mv_dispatch_timeline',
      ];
      for (const view of quarterViews) {
        try {
          await marieDB.query(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${view}`);
        } catch (error) {
          console.error(`Quarter status refresh failed for ${view}:`, error);
        }
      }
    }

    // Invalidate street-clusters cache for this suburb
    const suburban = result.rows[0]?.suburb;
    if (suburban) {
      await invalidateStreetClustersForSuburb(suburban);
    }
    await invalidateDashboardStatsCache();

    if (process.env.USE_OUTREACH_MV === 'true') {
      marieDB.query('REFRESH MATERIALIZED VIEW CONCURRENTLY outreach_enriched')
        .catch(err => console.error('MV refresh failed (non-critical):', err));
    }

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error updating status:', error);
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
  }
}

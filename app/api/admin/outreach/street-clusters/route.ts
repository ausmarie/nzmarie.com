import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { marieDB } from '@/lib/db';
import { isAdmin } from '@/lib/permissions';
import { buildOutreachFilter } from '@/lib/outreach-filter';
import { parseReportQuarter } from '@/lib/outreach-quarter';
import { buildStreetSummaries, toOrderable, AddressRow } from '@/lib/outreach-streets';
import { orderStreetsGreedily } from '@/lib/street-ordering';
import { splitOrderedStreets, StreetPoint } from '@/lib/street-clustering';
import {
  reorderStreetClustersForStart,
  StreetClusterPayload,
} from '@/lib/street-cluster-reorder';
import {
  streetClustersKey,
  getStreetClustersFromCache,
  setStreetClustersInCache,
} from '@/lib/redis';

const STREET_ORDER_KEY_PREFIX = 'outreach_street_order:';

function parseStreetOrder(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.filter((s): s is string => typeof s === 'string' && s.trim().length > 0);
    }
  } catch {
    // ignore malformed values
  }
  return [];
}

/**
 * GET /api/admin/outreach/street-clusters
 * Returns streets in a suburb ordered by nearest walking distance
 * (greedy nearest-neighbor from the minimum house number address of
 * each street), split into budget-sized runs for the "Today's Run" planner.
 *
 * Query params:
 *   - suburb: suburb to plan (required)
 *   - radius: kept for API compatibility (no longer used for ordering)
 *   - budget: run budget - number of addresses per run (default 20)
 *   - start_street: optional street to start the route from (defaults to the
 *     street with the globally smallest house number)
 *   - status: which status to count (default 'pending')
 *   - sent_status: 'all' | 'sent' | 'unsent'
 *   - report_quarter: optional quarter filter, e.g. '2026-Q2'
 */
export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const suburb = searchParams.get('suburb');
  const radius = Math.min(
    2000,
    Math.max(100, parseInt(searchParams.get('radius') || '500', 10) || 500)
  );
  const budget = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get('budget') || '20', 10) || 20)
  );
  const status = searchParams.get('status') || 'pending';
  const sentStatus = (searchParams.get('sent_status') || 'all') as 'all' | 'unsent' | 'sent';
  const reportQuarter = searchParams.get('report_quarter');
  const startStreet = searchParams.get('start_street') || '';
  const includeAddressCoords = (searchParams.get('address_coords') || 'false') === 'true';

  if (!suburb) {
    return NextResponse.json({ error: 'Missing suburb parameter' }, { status: 400 });
  }

  try {
    await marieDB.ensureOutreachTablesExist?.();

    // ── Cache lookup (Upstash, TTL 30 min) ────────────────────────────────────
    // start_street is intentionally excluded from the key: changing the start
    // only reorders the existing streets, it doesn't change pending counts.
    // We still serve cached data but it will be reordered client-side if needed.
    let cacheKey = streetClustersKey(suburb, status, sentStatus, reportQuarter ?? null, budget);
    if (includeAddressCoords) cacheKey = `${cacheKey}:coords`;
    const cached = await getStreetClustersFromCache<StreetClusterPayload>(cacheKey);
    if (cached) {
      // start_street is intentionally excluded from the cache key (changing the
      // start only reorders the existing streets, it doesn't change pending
      // counts), so re-apply the requested start to the cached order here.
      if (startStreet) {
        return NextResponse.json(reorderStreetClustersForStart(cached, startStreet));
      }
      return NextResponse.json(cached);
    }

    // ── Cache miss — compute from DB ──────────────────────────────────────────
    const qi = parseReportQuarter(reportQuarter);
    const { sql: where, params } = buildOutreachFilter({
      suburb,
      status,
      sentStatus,
      reportQuarter,
    });

    const { rows: addressRowsRaw } = await marieDB.query(
      `
      SELECT op.id AS id, op.street, op.house_number, op.property_address,
             p.latitude AS lat, p.longitude AS lng, p.no_junk_mail AS no_junk_mail,
             op.sent_at, op.last_sent_at, op.total_send_count, op.status, op.last_campaign
      FROM outreach_properties op
      LEFT JOIN properties p ON REPLACE(op.property_id::text, '-', '') = p.id
      WHERE ${where}
      ORDER BY op.street ASC, op.house_number ASC NULLS LAST, op.property_address ASC
      `,
      params
    );

    const addressRows: AddressRow[] = (addressRowsRaw as Record<string, unknown>[]).map((r) => ({
      id: r.id == null ? null : String(r.id),
      street: String(r.street ?? ''),
      house_number: r.house_number == null ? null : (Number(r.house_number) || String(r.house_number)),
      property_address: String(r.property_address ?? ''),
      lat: r.lat == null ? null : (Number(r.lat) || null),
      lng: r.lng == null ? null : (Number(r.lng) || null),
      no_junk_mail: Boolean(r.no_junk_mail),
      status: r.status == null ? null : String(r.status),
      sent: qi
        ? false
        : Boolean(
            Number(r.total_send_count) > 0 ||
            r.last_sent_at != null ||
            r.sent_at != null ||
            r.status === 'sent'
          ),
    }));

    if ((qi || includeAddressCoords) && addressRows.length > 0) {
      try {
        const ids = addressRows.map((r) => r.id).filter(Boolean);
        if (ids.length > 0) {
          const sendParams: (string | number | string[])[] = [ids as string[], suburb];
          let sendSql = `SELECT DISTINCT sl.outreach_property_id FROM outreach_send_logs sl LEFT JOIN suburb_reports sr ON sl.suburb_report_id = sr.id WHERE sl.outreach_property_id = ANY($1) AND (sl.suburb = $2 OR sr.suburb = $2 OR sl.suburb IS NULL)`;
          if (qi) {
            sendSql += ` AND ((sr.quarter = $3 AND sr.year = $4) OR sl.campaign_key ~ $5)`;
            sendParams.push(qi.quarter, qi.year, qi.campaignPattern);
          }
          const { rows: sentRows } = await marieDB.query(sendSql, sendParams);
          const sentSet = new Set(sentRows.map((r: { outreach_property_id: unknown }) => String(r.outreach_property_id)));
          const quarterRe = qi ? new RegExp(qi.campaignPattern) : null;
          for (let i = 0; i < addressRows.length; i++) {
            const ar = addressRows[i];
            const rawObj = (addressRowsRaw as Record<string, unknown>[])[i];
            if (qi) {
              const lastCampaign = rawObj && rawObj.last_campaign != null ? String(rawObj.last_campaign) : '';
              const quarterSent = Boolean(ar.id && (sentSet.has(ar.id) || (quarterRe && quarterRe.test(lastCampaign))));
              ar.sent = quarterSent;
              ar.status = quarterSent ? 'sent' : 'pending';
            } else {
              const opSent = Boolean(
                rawObj && (
                  Number(rawObj.total_send_count) > 0 ||
                  rawObj.last_sent_at != null ||
                  rawObj.sent_at != null ||
                  rawObj.status === 'sent'
                )
              );
              if (ar.id && (sentSet.has(ar.id) || opSent)) {
                ar.sent = true;
                ar.status = 'sent';
              }
            }
          }
        }
      } catch (e) {
        console.warn('Failed to fetch send-log flags for address_coords:', e);
      }
    }

    const summaries = buildStreetSummaries(addressRows as AddressRow[], suburb, includeAddressCoords);

    const storedOrder = await marieDB.query(
      `SELECT setting_value FROM admin_settings WHERE setting_key = $1 LIMIT 1`,
      [`${STREET_ORDER_KEY_PREFIX}${suburb}`]
    );
    const savedOrder = parseStreetOrder(storedOrder?.rows?.[0]?.setting_value ?? null);
    const streetNames = new Set(summaries.map((s) => s.street));
    const validOrder = savedOrder.filter((s) => streetNames.has(s));

    let orderedSummaries = summaries;
    if (validOrder.length > 0) {
      const orderIndex = new Map<string, number>();
      validOrder.forEach((name, i) => orderIndex.set(name, i));
      orderedSummaries = [...summaries].sort((a, b) => {
        const ia = orderIndex.get(a.street);
        const ib = orderIndex.get(b.street);
        if (ia !== undefined && ib !== undefined) return ia - ib;
        if (ia !== undefined) return -1;
        if (ib !== undefined) return 1;
        return a.street.localeCompare(b.street, undefined, { sensitivity: 'base' });
      });
    } else {
      const order = orderStreetsGreedily(summaries.map(toOrderable), startStreet || undefined);
      const orderIndex = new Map(order.map((name, i) => [name, i]));
      orderedSummaries = [...summaries].sort(
        (a, b) => (orderIndex.get(a.street) ?? 0) - (orderIndex.get(b.street) ?? 0)
      );
    }

    const streetPoints: StreetPoint[] = orderedSummaries.map((s) => ({
      street: s.street,
      suburb,
      lat: s.anchorLat ?? 0,
      lng: s.anchorLng ?? 0,
      anchorLat: s.anchorLat,
      anchorLng: s.anchorLng,
      pendingCount: s.address_count,
      addresses: s.addresses,
      addressCoords: includeAddressCoords ? s.addressCoords : undefined,
    }));

    const groups = [
      {
        groupId: 1,
        streets: streetPoints,
        totalPending: orderedSummaries.reduce((sum, s) => sum + s.address_count, 0),
        extentMeters: 0,
      },
    ];
    const runs = splitOrderedStreets(streetPoints, budget);

    const noAnchorStreets = summaries.filter((s) => s.anchorLat == null || s.anchorLng == null);

    const runsPayload = runs.map((run, i) => {
      const runId = i + 1;
      for (const g of run) {
        for (const s of g.streets) s.runId = runId;
      }
      return {
        runId,
        groups: run,
        totalPending: run.reduce((s, g) => s + g.totalPending, 0),
        streetCount: run.reduce((s, g) => s + g.streets.length, 0),
      };
    });

    // Sync runId back to the top-level streetPoints so coordsData.groups
    // passed to NativeMarkerManager has correct runId on each street.
    const streetRunMap = new Map<string, number>();
    for (const rp of runsPayload) {
      for (const g of rp.groups) {
        for (const s of g.streets) {
          streetRunMap.set(s.street, rp.runId);
        }
      }
    }
    for (const s of streetPoints) {
      const rid = streetRunMap.get(s.street);
      if (rid != null) s.runId = rid;
    }

    const responsePayload = {
      success: true,
      radius,
      budget,
      suburb,
      groups,
      runs: runsPayload,
      unclusteredStreets: noAnchorStreets.map((s) => ({
        street: s.street,
        has_coords: s.has_coords,
      })),
      startStreet: orderedSummaries[0]?.street ?? null,
      allStreets: summaries
        .map((s) => ({ street: s.street, count: s.address_count }))
        .sort((a, b) => a.street.localeCompare(b.street, undefined, { sensitivity: 'base' })),
      manualOrder: validOrder.length > 0,
      manualOrderCount: validOrder.length,
    };

    // Write to cache asynchronously — don't block the response
    setStreetClustersInCache(cacheKey, responsePayload).catch(() => { });

    return NextResponse.json(responsePayload);
  } catch (error) {
    console.error('Error fetching street clusters:', error);
    return NextResponse.json({ error: 'Failed to fetch street clusters' }, { status: 500 });
  }
}

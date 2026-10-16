import { parseHouseNumber, orderStreetsGreedily, OrderableStreet } from './street-ordering';
import { splitOrderedStreets, StreetPoint } from './street-clustering';

export interface StreetClusterPoi {
  street: string;
  suburb: string;
  lat: number;
  lng: number;
  pendingCount: number;
  addresses?: string[];
}

export interface StreetClusterRunGroup {
  groupId: number;
  streets: StreetPoint[];
  totalPending: number;
  extentMeters: number;
}

export interface StreetClusterRun {
  runId: number;
  groups: StreetClusterRunGroup[];
  totalPending: number;
  streetCount: number;
}

export interface StreetClusterPayload {
  suburb?: string;
  budget?: number;
  startStreet?: string | null;
  manualOrder?: boolean;
  manualOrderCount?: number;
  groups?: StreetClusterRunGroup[];
  runs?: StreetClusterRun[];
  unclusteredStreets?: { street: string; has_coords: boolean }[];
  allStreets?: { street: string; count: number }[];
}

/**
 * Re-orders a cached street-clusters payload so the delivery route begins at
 * the requested start street.
 *
 * The street-clusters cache key intentionally excludes `start_street` (changing
 * the start only reorders existing streets, it doesn't change pending counts),
 * so a cache hit may carry the order computed for a *different* start. This
 * helper reconstructs the anchor information from the cached street points and
 * re-runs the greedy nearest-neighbour ordering, then re-splits the streets
 * into budget-sized runs so Run 1 starts at the chosen street.
 *
 * Returns the payload unchanged when:
 *  - no start street was requested
 *  - a manual order is in effect (the start selector is disabled UI-wise)
 *  - the cached order already begins with the requested street
 *  - the payload contains no usable street data
 */
export function reorderStreetClustersForStart(
  payload: StreetClusterPayload,
  startStreet: string | null | undefined
): StreetClusterPayload {
  const start = (startStreet ?? '').trim();
  if (!start) return payload;
  if (payload.manualOrder) return payload;
  if (payload.startStreet === start) return payload;

  const streetPoints: StreetPoint[] =
    payload.groups?.[0]?.streets ??
    (payload.runs ?? []).flatMap((r) => r.groups).flatMap((g) => g.streets) ??
    [];

  if (streetPoints.length === 0) return payload;

  // Payload street points store lat=0/lng=0 for streets that had no anchor
  // when the payload was built. unclusteredStreets lists exactly those streets,
  // so we can faithfully restore the anchor state before re-ordering.
  const nonAnchored = new Set(
    (payload.unclusteredStreets ?? [])
      .map((u) => u.street)
      .filter((s): s is string => Boolean(s))
  );

  const orderables: OrderableStreet[] = streetPoints.map((s) => ({
    street: s.street,
    minHouseNumber: parseHouseNumber(s.addresses?.[0] ?? null),
    anchorLat: nonAnchored.has(s.street) ? null : (s.lat ?? null),
    anchorLng: nonAnchored.has(s.street) ? null : (s.lng ?? null),
  }));

  const orderedNames = orderStreetsGreedily(orderables, start);
  const orderIndex = new Map(orderedNames.map((name, i) => [name, i]));
  const orderedPoints = [...streetPoints].sort(
    (a, b) => (orderIndex.get(a.street) ?? 0) - (orderIndex.get(b.street) ?? 0)
  );

  const budget = payload.budget && payload.budget > 0 ? payload.budget : 20;
  const runs = splitOrderedStreets(orderedPoints, budget);

  return {
    ...payload,
    // Keep the master street group in sync so the property list / card view
    // cluster ordering matches the Run 1 order shown in Today's Run.
    groups: [
      {
        groupId: 1,
        streets: orderedPoints,
        totalPending: orderedPoints.reduce((sum, s) => sum + s.pendingCount, 0),
        extentMeters: 0,
      },
    ],
    runs: runs.map((run, i) => ({
      runId: i + 1,
      groups: run,
      totalPending: run.reduce((s, g) => s + g.totalPending, 0),
      streetCount: run.reduce((s, g) => s + g.streets.length, 0),
    })),
    startStreet: orderedPoints[0]?.street ?? payload.startStreet ?? null,
  };
}
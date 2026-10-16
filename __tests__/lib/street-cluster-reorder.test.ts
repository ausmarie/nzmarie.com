import { describe, it, expect } from 'vitest';
import {
  reorderStreetClustersForStart,
  StreetClusterPayload,
} from '../../lib/street-cluster-reorder';

function point(street: string, lat: number, lng: number, pendingCount = 1, base = 1) {
  return {
    street,
    suburb: 'Torbay',
    lat,
    lng,
    pendingCount,
    addresses: [`${base} ${street}`],
  };
}

function payload(opts?: Partial<StreetClusterPayload>): StreetClusterPayload {
  return {
    suburb: 'Torbay',
    budget: 30,
    startStreet: 'Alpha Street',
    manualOrder: false,
    manualOrderCount: 0,
    groups: [
      {
        groupId: 1,
        streets: [point('Alpha Street', -36.6958, 174.7453), point('Beta Street', -36.6959, 174.7454), point('Zeta Street', -36.7, 174.75)],
        totalPending: 3,
        extentMeters: 0,
      },
    ],
    runs: [
      {
        runId: 1,
        groups: [
          {
            groupId: 1,
            streets: [point('Alpha Street', -36.6958, 174.7453), point('Beta Street', -36.6959, 174.7454), point('Zeta Street', -36.7, 174.75)],
            totalPending: 3,
            extentMeters: 0,
          },
        ],
        totalPending: 3,
        streetCount: 3,
      },
    ],
    unclusteredStreets: [],
    allStreets: [
      { street: 'Alpha Street', count: 1 },
      { street: 'Beta Street', count: 1 },
      { street: 'Zeta Street', count: 1 },
    ],
    ...opts,
  };
}

describe('reorderStreetClustersForStart', () => {
  it('returns the payload unchanged when no start street is requested', () => {
    const p = payload();
    expect(reorderStreetClustersForStart(p, '')).toBe(p);
    expect(reorderStreetClustersForStart(p, undefined)).toBe(p);
    expect(reorderStreetClustersForStart(p, '   ')).toBe(p);
  });

  it('returns the payload unchanged when a manual order is in effect', () => {
    const p = payload({ manualOrder: true });
    expect(reorderStreetClustersForStart(p, 'Zeta Street')).toBe(p);
  });

  it('returns the payload unchanged when the cached order already starts at the requested street', () => {
    const p = payload({ startStreet: 'Alpha Street' });
    expect(reorderStreetClustersForStart(p, 'Alpha Street')).toBe(p);
  });

  it('returns the payload unchanged when it has no street data', () => {
    const p = payload({ groups: [], runs: [], startStreet: null });
    expect(reorderStreetClustersForStart(p, 'Zeta Street')).toBe(p);
  });

  it('re-orders runs so Run 1 starts at the requested street (cache-hit reorder)', () => {
    const p = payload();
    const reordered = reorderStreetClustersForStart(p, 'Zeta Street');

    const run1Streets = reordered.runs![0].groups[0].streets;
    expect(run1Streets[0].street).toBe('Zeta Street');
    expect(reordered.startStreet).toBe('Zeta Street');
    // No streets lost or duplicated.
    const names = run1Streets.map((s) => s.street).sort();
    expect(names).toEqual(['Alpha Street', 'Beta Street', 'Zeta Street']);
  });

  it('keeps non-anchored (no coordinate) streets last in the re-ordered route', () => {
    const p = payload({
      groups: [
        {
          groupId: 1,
          streets: [
            point('Alpha Street', -36.6958, 174.7453),
            point('Beta Street', -36.6959, 174.7454),
            point('NoCoord Street', 0, 0),
          ],
          totalPending: 3,
          extentMeters: 0,
        },
      ],
      unclusteredStreets: [{ street: 'NoCoord Street', has_coords: false }],
    });

    const reordered = reorderStreetClustersForStart(p, 'Beta Street');
    const names = reordered.runs![0].groups[0].streets.map((s) => s.street);
    expect(names[0]).toBe('Beta Street');
    expect(names[names.length - 1]).toBe('NoCoord Street');
  });

  it('re-splits the re-ordered streets into budget-sized runs', () => {
    const streets = [
      point('Alpha Street', -36.6958, 174.7453),
      point('Beta Street', -36.6959, 174.7454),
      point('Gamma Street', -36.696, 174.7455),
      point('Zeta Street', -36.7, 174.75),
    ];
    const p = payload({ budget: 2, groups: [{ groupId: 1, streets, totalPending: 4, extentMeters: 0 }] });

    const reordered = reorderStreetClustersForStart(p, 'Zeta Street');
    expect(reordered.runs!.length).toBe(2);
    expect(reordered.runs![0].groups[0].streets[0].street).toBe('Zeta Street');
    // Each run holds up to `budget` addresses (pendingCount = 1 per street here).
    expect(reordered.runs![0].groups[0].streets.reduce((s, st) => s + st.pendingCount, 0)).toBe(2);
  });

  it('updates the master groups list to match the re-ordered route', () => {
    const p = payload();
    const reordered = reorderStreetClustersForStart(p, 'Zeta Street');
    expect(reordered.groups![0].streets[0].street).toBe('Zeta Street');
  });
});
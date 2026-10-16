import { describe, it, expect } from 'vitest';
import {
  haversineMeters,
  clusterStreets,
  splitRuns,
  splitOrderedStreets,
  StreetPoint,
  ClusterGroup,
} from '../../lib/street-clustering';

// Torbay area reference point
const BASE = { lat: -36.6958, lng: 174.7453 };

function street(name: string, lat: number, lng: number, pendingCount: number): StreetPoint {
  return { street: name, suburb: 'Torbay', lat, lng, pendingCount };
}

// Roughly 100m north/south at Torbay latitude
function offsetNorth(latOffset: number): number {
  return BASE.lat + latOffset * (0.0009 / 100);
}
function offsetEast(lngOffset: number): number {
  return BASE.lng + lngOffset * (0.0011 / 100);
}

describe('haversineMeters', () => {
  it('returns 0 for identical points', () => {
    expect(haversineMeters(BASE.lat, BASE.lng, BASE.lat, BASE.lng)).toBeCloseTo(0, 6);
  });

  it('returns ~111km for 1 degree of latitude', () => {
    const d = haversineMeters(BASE.lat, BASE.lng, BASE.lat + 1, BASE.lng);
    expect(d).toBeGreaterThan(110000);
    expect(d).toBeLessThan(112000);
  });

  it('is symmetric', () => {
    const a = haversineMeters(BASE.lat, BASE.lng, BASE.lat + 0.01, BASE.lng + 0.01);
    const b = haversineMeters(BASE.lat + 0.01, BASE.lng + 0.01, BASE.lat, BASE.lng);
    expect(a).toBeCloseTo(b, 3);
  });
});

describe('clusterStreets (star clustering)', () => {
  it('returns empty array for no streets', () => {
    expect(clusterStreets([], 500)).toEqual([]);
  });

  it('clusters close streets into one group', () => {
    const points = [
      street('A', offsetNorth(0), offsetEast(0), 5),
      street('B', offsetNorth(150), offsetEast(0), 5),
      street('C', offsetNorth(-150), offsetEast(0), 5),
    ];
    const groups = clusterStreets(points, 500);
    expect(groups).toHaveLength(1);
    expect(groups[0].streets).toHaveLength(3);
    expect(groups[0].totalPending).toBe(15);
  });

  it('separates distant streets into different groups', () => {
    const points = [
      street('Far North', offsetNorth(0), offsetEast(0), 5),
      street('Far South', offsetNorth(3000), offsetEast(0), 5),
    ];
    const groups = clusterStreets(points, 500);
    expect(groups).toHaveLength(2);
  });

  it('prevents chaining: middle street does not bridge two clusters', () => {
    // Input order: C at 800m is the seed. B at 400m is within 500m of the
    // seed C, so joins C. A at 0m is 800m from seed C, so stays alone.
    // Without star logic the whole set would chain into a single group.
    const points = [
      street('C', offsetNorth(800), offsetEast(0), 5),
      street('A', offsetNorth(0), offsetEast(0), 5),
      street('B', offsetNorth(400), offsetEast(0), 5),
    ];
    const groups = clusterStreets(points, 500);
    expect(groups).toHaveLength(2);
    const gC = groups.find((g) => g.streets.some((s) => s.street === 'C'))!;
    expect(gC.streets.map((s) => s.street).sort()).toEqual(['B', 'C']);
    const gA = groups.find((g) => g.streets.some((s) => s.street === 'A'))!;
    expect(gA.streets.map((s) => s.street)).toEqual(['A']);
  });

  it('sorts streets within a group alphabetically', () => {
    const points = [
      street('Zulu', offsetNorth(100), offsetEast(0), 1),
      street('Alpha', offsetNorth(0), offsetEast(0), 1),
      street('Mike', offsetNorth(50), offsetEast(0), 1),
    ];
    const groups = clusterStreets(points, 500);
    expect(groups[0].streets.map((s) => s.street)).toEqual(['Alpha', 'Mike', 'Zulu']);
  });

  it('computes a positive extentMeters for multi-street groups', () => {
    const groups = clusterStreets(
      [
        street('A', offsetNorth(0), offsetEast(0), 1),
        street('B', offsetNorth(300), offsetEast(0), 1),
      ],
      500
    );
    expect(groups[0].extentMeters).toBeGreaterThan(0);
  });

  it('single street group has zero extent', () => {
    const groups = clusterStreets([street('Lonely', offsetNorth(0), offsetEast(0), 3)], 500);
    expect(groups[0].extentMeters).toBe(0);
  });
});

describe('splitRuns', () => {
  function makeGroup(groupId: number, entries: Array<[string, number]>): ClusterGroup {
    const streets = entries.map(([name, count]) => street(name, offsetNorth(0), offsetEast(0), count));
    return {
      groupId,
      streets,
      totalPending: streets.reduce((s, st) => s + st.pendingCount, 0),
      extentMeters: 100,
    };
  }

  it('returns empty for no groups', () => {
    expect(splitRuns([], 20)).toEqual([]);
  });

  it('groups small streets into a run under budget', () => {
    const groups = [makeGroup(1, [['A', 8], ['B', 7]])];
    const runs = splitRuns(groups, 20);
    expect(runs).toHaveLength(1);
    expect(runs[0][0].streets).toHaveLength(2);
  });

  it('splits an oversized group into multiple runs', () => {
    const groups = [makeGroup(1, [['A', 10], ['B', 10], ['C', 10]])];
    const runs = splitRuns(groups, 20);
    expect(runs).toHaveLength(2);
    const totals = runs.map((r) => r.reduce((s, g) => s + g.totalPending, 0));
    expect(totals[0]).toBe(20);
    expect(totals[1]).toBe(10);
  });

  it('gives a street exceeding budget its own run', () => {
    const groups = [makeGroup(1, [['Big', 30], ['Small', 5]])];
    const runs = splitRuns(groups, 20);
    expect(runs).toHaveLength(2);
    // Big street alone, then Small street alone.
    expect(runs[0][0].streets.map((s) => s.street)).toEqual(['Big']);
    expect(runs[1][0].streets.map((s) => s.street)).toEqual(['Small']);
  });

  it('merges across groups to reach budget', () => {
    const groups = [
      makeGroup(1, [['A', 12]]),
      makeGroup(2, [['B', 6]]),
    ];
    const runs = splitRuns(groups, 20);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toHaveLength(2); // one chunk from each group
  });

  it('keeps run order geographically grouped (group chunks adjacent)', () => {
    const groups = [
      makeGroup(1, [['A', 5]]),
      makeGroup(2, [['B', 5]]),
      makeGroup(3, [['C', 5]]),
    ];
    const runs = splitRuns(groups, 20);
    expect(runs).toHaveLength(1);
    const streets = runs[0].flatMap((g) => g.streets.map((s) => s.street));
    expect(streets).toEqual(['A', 'B', 'C']);
  });
});

describe('splitOrderedStreets', () => {
  function ordered(name: string, count: number): StreetPoint {
    return street(name, offsetNorth(0), offsetEast(0), count);
  }

  it('returns empty for no streets', () => {
    expect(splitOrderedStreets([], 20)).toEqual([]);
  });

  it('keeps the given order and splits by budget', () => {
    const runs = splitOrderedStreets(
      [ordered('Gamma', 5), ordered('Alpha', 5), ordered('Beta', 5)],
      12
    );
    expect(runs).toHaveLength(2);
    expect(runs[0][0].streets.map((s) => s.street)).toEqual(['Gamma', 'Alpha']);
    expect(runs[1][0].streets.map((s) => s.street)).toEqual(['Beta']);
  });

  it('emits each run as a single group chunk', () => {
    const runs = splitOrderedStreets([ordered('A', 3), ordered('B', 4)], 20);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toHaveLength(1);
    expect(runs[0][0].totalPending).toBe(7);
  });

  it('gives an oversized street its own run', () => {
    const runs = splitOrderedStreets([ordered('Big', 30), ordered('Small', 5)], 20);
    expect(runs).toHaveLength(2);
    expect(runs[0][0].streets.map((s) => s.street)).toEqual(['Big']);
    expect(runs[1][0].streets.map((s) => s.street)).toEqual(['Small']);
  });
});

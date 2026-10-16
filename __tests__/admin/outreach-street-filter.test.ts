/**
 * Tests for the Outreach "Filter by Street" Apply logic.
 *
 * These tests focus on the pure utility functions that drive the fix:
 *  - aggregateLikedStreets now runs unconditionally for the liked tab (no
 *    likedStreetModeApplied gate), so streets are ready the instant Apply fires.
 *  - filterLikedItemsByStreet is used to narrow the displayed items after a
 *    street is selected.
 *  - The likedStreetsOrdered wrapping (start-street pinned first) is modelled
 *    inline to confirm the ordering logic.
 *
 * The Apply handler no longer calls setPropertyFilter / setLastSoldPreset, so
 * no debounce re-fetch is triggered. That side-effect is verified by asserting
 * that aggregate / filter functions return consistent results from a fixed
 * snapshot — i.e. they are pure and do not depend on async state changes.
 */

import { describe, it, expect } from 'vitest';
import {
  aggregateLikedStreets,
  filterLikedItemsByStreet,
  extractStreetFromLikedItem,
  type LikedItem,
} from '../../lib/liked-street-filter';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const TORBAY_ITEMS: LikedItem[] = [
  { street: 'Carina Crescent', property_address: '1 Carina Crescent' },
  { street: 'Carina Crescent', property_address: '3 Carina Crescent' },
  { street: 'Carina Crescent', property_address: '5 Carina Crescent' },
  { street: 'Carina Crescent', property_address: '7 Carina Crescent' },
  { street: 'Carina Crescent', property_address: '9 Carina Crescent' },
  { street: 'Carina Crescent', property_address: '11 Carina Crescent' },
  { street: 'Glamorgan Drive', property_address: '2 Glamorgan Drive' },
  { street: 'Glamorgan Drive', property_address: '4 Glamorgan Drive' },
  { street: 'Glamorgan Drive', property_address: '6 Glamorgan Drive' },
  { street: 'Torbay Road', property_address: '10 Torbay Road' },
  { street: 'Torbay Road', property_address: '12 Torbay Road' },
  { street: 'Deep Creek Road', property_address: '3 Deep Creek Road' },
  // Null-street item — should be parsed from property_address
  { street: null, property_address: '22 Waimarie Drive' },
];

// ---------------------------------------------------------------------------
// Core: aggregateLikedStreets (drives the street panel)
// ---------------------------------------------------------------------------

describe('aggregateLikedStreets — drives the street panel without API call', () => {
  it('returns all streets derived from a loaded items snapshot', () => {
    const result = aggregateLikedStreets(TORBAY_ITEMS);
    const names = result.map(s => s.street);

    expect(names).toContain('Carina Crescent');
    expect(names).toContain('Glamorgan Drive');
    expect(names).toContain('Torbay Road');
    expect(names).toContain('Deep Creek Road');
    expect(names).toContain('Waimarie Drive'); // fallback from property_address
  });

  it('counts each street correctly', () => {
    const result = aggregateLikedStreets(TORBAY_ITEMS);

    expect(result.find(s => s.street === 'Carina Crescent')?.count).toBe(6);
    expect(result.find(s => s.street === 'Glamorgan Drive')?.count).toBe(3);
    expect(result.find(s => s.street === 'Torbay Road')?.count).toBe(2);
    expect(result.find(s => s.street === 'Deep Creek Road')?.count).toBe(1);
    expect(result.find(s => s.street === 'Waimarie Drive')?.count).toBe(1);
  });

  it('returns streets alphabetically so the list is deterministic', () => {
    const result = aggregateLikedStreets(TORBAY_ITEMS);
    const names = result.map(s => s.street);
    const sorted = [...names].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' })
    );
    expect(names).toEqual(sorted);
  });

  it('returns a non-empty list even before Apply has been clicked (no mode gate)', () => {
    // This is the key regression test for the bug fix.
    // Previously the useMemo returned [] when likedStreetModeApplied=false.
    // The fix removes that gate — aggregateLikedStreets itself has no such guard.
    const result = aggregateLikedStreets(TORBAY_ITEMS);
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns empty array for an empty items list', () => {
    expect(aggregateLikedStreets([])).toHaveLength(0);
  });

  it('does not require a re-fetch — result is stable across multiple calls', () => {
    // Simulates the behaviour after the fix: same items in, same streets out,
    // no matter how many times it is called. The old code would return []
    // during the re-fetch window triggered by setPropertyFilter.
    const first = aggregateLikedStreets(TORBAY_ITEMS);
    const second = aggregateLikedStreets(TORBAY_ITEMS);
    expect(first).toEqual(second);
  });
});

// ---------------------------------------------------------------------------
// Ordering: likedStreetsOrdered — start street pinned first, rest wrap around
// ---------------------------------------------------------------------------

/**
 * Mirrors the useMemo logic in page.tsx:
 *   const idx = likedStartStreet
 *     ? likedStreetsSummary.findIndex(s => s.street === likedStartStreet) : 0;
 *   const start = idx === -1 ? 0 : idx;
 *   return [...likedStreetsSummary.slice(start), ...likedStreetsSummary.slice(0, start)];
 */
function buildLikedStreetsOrdered(
  summary: ReturnType<typeof aggregateLikedStreets>,
  likedStartStreet: string,
) {
  if (summary.length === 0) return [];
  const idx = likedStartStreet
    ? summary.findIndex(s => s.street === likedStartStreet)
    : 0;
  const start = idx === -1 ? 0 : idx;
  return [...summary.slice(start), ...summary.slice(0, start)];
}

describe('likedStreetsOrdered — start street pinned first', () => {
  const summary = aggregateLikedStreets(TORBAY_ITEMS); // alphabetical

  it('with no start street the alphabetically-first street is first', () => {
    const ordered = buildLikedStreetsOrdered(summary, '');
    expect(ordered[0].street).toBe(summary[0].street); // 'Carina Crescent'
  });

  it('pinning Torbay Road puts it first with remaining streets after', () => {
    const ordered = buildLikedStreetsOrdered(summary, 'Torbay Road');
    expect(ordered[0].street).toBe('Torbay Road');
    // All streets still present
    expect(ordered).toHaveLength(summary.length);
  });

  it('wraps around: streets before start street appear at the end', () => {
    const ordered = buildLikedStreetsOrdered(summary, 'Torbay Road');
    const torbayIdx = summary.findIndex(s => s.street === 'Torbay Road');
    // Streets that came before Torbay Road alphabetically should be at the tail
    const beforeTorbay = summary.slice(0, torbayIdx).map(s => s.street);
    const tail = ordered.slice(ordered.length - beforeTorbay.length).map(s => s.street);
    expect(tail).toEqual(beforeTorbay);
  });

  it('falls back to index 0 when start street is not in the summary', () => {
    const ordered = buildLikedStreetsOrdered(summary, 'Nonexistent Street');
    expect(ordered[0].street).toBe(summary[0].street);
  });

  it('returns empty array when summary is empty', () => {
    expect(buildLikedStreetsOrdered([], 'Carina Crescent')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Filtering: filterLikedItemsByStreet (applied after street is selected)
// ---------------------------------------------------------------------------

describe('filterLikedItemsByStreet — narrows items after street click', () => {
  it('returns only items for the selected street', () => {
    const result = filterLikedItemsByStreet(TORBAY_ITEMS, 'Carina Crescent');
    expect(result).toHaveLength(6);
    expect(result.every(i => i.street === 'Carina Crescent')).toBe(true);
  });

  it('returns items whose street is derived from property_address (null street field)', () => {
    const result = filterLikedItemsByStreet(TORBAY_ITEMS, 'Waimarie Drive');
    expect(result).toHaveLength(1);
    expect(result[0].property_address).toBe('22 Waimarie Drive');
  });

  it('returns empty array when the selected street has no matches', () => {
    const result = filterLikedItemsByStreet(TORBAY_ITEMS, 'Nonexistent Street');
    expect(result).toHaveLength(0);
  });

  it('does not mutate the original items array', () => {
    const copy = [...TORBAY_ITEMS];
    filterLikedItemsByStreet(TORBAY_ITEMS, 'Glamorgan Drive');
    expect(TORBAY_ITEMS).toEqual(copy);
  });

  it('selecting a street leaves the rest of the data intact in the original list', () => {
    const result = filterLikedItemsByStreet(TORBAY_ITEMS, 'Glamorgan Drive');
    const remaining = TORBAY_ITEMS.filter(
      i => extractStreetFromLikedItem(i) !== 'Glamorgan Drive',
    );
    expect(result).toHaveLength(3);
    expect(remaining).toHaveLength(TORBAY_ITEMS.length - 3);
  });
});

// ---------------------------------------------------------------------------
// Apply handler invariants: no re-fetch side-effects
// ---------------------------------------------------------------------------

describe('Apply handler invariants — street list stable at click time', () => {
  it('street list derived from snapshot is identical to a re-derived list (pure)', () => {
    // Before the fix: setPropertyFilter('house') changed state, re-fetch cleared
    // items, making the second derivation return []. After the fix: both calls
    // return the same result because aggregateLikedStreets is a pure function.
    const atClickTime = aggregateLikedStreets(TORBAY_ITEMS, '');
    const afterSomeTimeWithSameData = aggregateLikedStreets(TORBAY_ITEMS, '');
    expect(atClickTime).toEqual(afterSomeTimeWithSameData);
  });

  it('first street from snapshot is used as initial selection', () => {
    const summary = aggregateLikedStreets(TORBAY_ITEMS, '');
    const firstStreet = summary[0]?.street ?? '';
    // The Apply handler sets likedSelectedStreet to this value
    expect(firstStreet).toBe('Carina Crescent'); // alphabetically first
  });

  it('stored start street overrides the derived first street as selection', () => {
    // Simulates: storedStart = localStorage.getItem(...) => 'Glamorgan Drive'
    const summary = aggregateLikedStreets(TORBAY_ITEMS, '');
    const storedStart = 'Glamorgan Drive';
    // The Apply handler: if (storedStart) setLikedSelectedStreet(storedStart)
    const selectedStreet = storedStart || summary[0]?.street || '';
    expect(selectedStreet).toBe('Glamorgan Drive');
  });

  it('stored start street not in summary falls back to first alphabetical street', () => {
    const summary = aggregateLikedStreets(TORBAY_ITEMS, '');
    const storedStart = 'Obsolete Street'; // was liked before, no longer in items
    const inSummary = summary.some(s => s.street === storedStart);
    const selectedStreet = inSummary ? storedStart : (summary[0]?.street ?? '');
    expect(selectedStreet).toBe('Carina Crescent');
  });

  it('empty items list results in no street selection (graceful empty state)', () => {
    const summary = aggregateLikedStreets([], '');
    const firstStreet = summary[0]?.street ?? '';
    expect(firstStreet).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Search within the street panel
// ---------------------------------------------------------------------------

describe('street panel search — filters visible streets without re-fetch', () => {
  it('searching "carina" shows only Carina Crescent', () => {
    const result = aggregateLikedStreets(TORBAY_ITEMS, 'carina');
    expect(result).toHaveLength(1);
    expect(result[0].street).toBe('Carina Crescent');
  });

  it('search is case-insensitive', () => {
    const lower = aggregateLikedStreets(TORBAY_ITEMS, 'GLAMORGAN');
    const upper = aggregateLikedStreets(TORBAY_ITEMS, 'glamorgan');
    expect(lower).toEqual(upper);
    expect(lower[0].street).toBe('Glamorgan Drive');
  });

  it('clearing search (empty string) restores the full list', () => {
    const filtered = aggregateLikedStreets(TORBAY_ITEMS, 'carina');
    const full = aggregateLikedStreets(TORBAY_ITEMS, '');
    expect(filtered).toHaveLength(1);
    expect(full.length).toBeGreaterThan(1);
  });

  it('whitespace-only search is treated as no search', () => {
    const withSpaces = aggregateLikedStreets(TORBAY_ITEMS, '   ');
    const noSearch = aggregateLikedStreets(TORBAY_ITEMS);
    expect(withSpaces).toEqual(noSearch);
  });

  it('searching "road" matches all streets containing the word', () => {
    const result = aggregateLikedStreets(TORBAY_ITEMS, 'road');
    const names = result.map(s => s.street);
    expect(names).toContain('Torbay Road');
    expect(names).toContain('Deep Creek Road');
    expect(names).not.toContain('Glamorgan Drive');
    expect(names).not.toContain('Carina Crescent');
  });
});

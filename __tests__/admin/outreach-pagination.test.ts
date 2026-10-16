/**
 * Unit tests for the Classic Pages pagination display logic in
 * app/admin/outreach/page.tsx.
 *
 * The page has two subtle differences from properties/page.tsx:
 *   1. totalPages uses displayPagination (classicPagination | pagination) rather
 *      than a dedicated classicData object — it's the same stabilisation pattern.
 *   2. The Displaying text has an extra Liked-Street mode branch:
 *      - Classic (no liked-street filter) → "Displaying X to Y of Z properties"
 *      - Liked-street filter active       → "Displaying 1 to N of M properties"
 *   3. The bottom pagination bar (two positions in JSX) uses the same stableTotal.
 *
 * All calculations are extracted as plain TypeScript functions that mirror the
 * page's render logic exactly. Tests run without jsdom / React.
 */

import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Constants (mirrored from page.tsx)
// ---------------------------------------------------------------------------
const CARD_PAGE_SIZE = 9;
const LIST_PAGE_SIZE = 18;

// ---------------------------------------------------------------------------
// Type mirrors
// ---------------------------------------------------------------------------
interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ---------------------------------------------------------------------------
// Pure helpers extracted from outreach/page.tsx render body
// ---------------------------------------------------------------------------

/**
 * Mirrors the lastValidTotalRef + stableDisplayTotal logic:
 *   const rawDisplayTotal = displayPagination?.total || 0;
 *   if (rawDisplayTotal > 0) lastValidTotalRef.current = rawDisplayTotal;
 *   const stableDisplayTotal = rawDisplayTotal > 0 ? rawDisplayTotal : lastValidTotalRef.current;
 */
function computeStableDisplayTotal(
  displayPagination: PaginationMeta | null | undefined,
  lastValidRef: number,
): [stableTotal: number, nextRef: number] {
  const rawDisplayTotal = displayPagination?.total || 0;
  const nextRef = rawDisplayTotal > 0 ? rawDisplayTotal : lastValidRef;
  const stableTotal = rawDisplayTotal > 0 ? rawDisplayTotal : lastValidRef;
  return [stableTotal, nextRef];
}

/** Mirrors: Math.max(1, Math.ceil(stableDisplayTotal / pageSize)) */
function computeTotalPages(stableDisplayTotal: number, pageSize: number): number {
  return Math.max(1, Math.ceil(stableDisplayTotal / pageSize));
}

/**
 * Mirrors the outreach Displaying text with its three branches:
 *   isClassic && !(likedStreetModeApplied && likedSelectedStreet)
 *     → "Displaying X to Y of Z properties"  (Classic, no liked-street)
 *   else
 *     → "Displaying 1 to N of M properties"  (Infinite or Liked-Street mode)
 */
function computeDisplayingText(opts: {
  isClassic: boolean;
  likedStreetModeApplied: boolean;
  likedSelectedStreet: string;
  currentPage: number;
  pageSize: number;
  stableDisplayTotal: number;
  likedStreetDisplayCount: number;
  likedStreetTotalCount: number;
}): string {
  const {
    isClassic, likedStreetModeApplied, likedSelectedStreet,
    currentPage, pageSize, stableDisplayTotal,
    likedStreetDisplayCount, likedStreetTotalCount,
  } = opts;

  if (isClassic && !(likedStreetModeApplied && likedSelectedStreet)) {
    const from = Math.max(1, (currentPage - 1) * pageSize + 1);
    const to = Math.min(currentPage * pageSize, stableDisplayTotal);
    return `Displaying ${from} to ${to} of ${stableDisplayTotal} properties`;
  }
  return `Displaying 1 to ${likedStreetDisplayCount} of ${likedStreetTotalCount} properties`;
}

/** Mirrors the bottom pagination bar counter: "X–Y of Z" */
function computeBottomPaginationText(
  currentPage: number,
  pageSize: number,
  stableDisplayTotal: number,
): string {
  const from = Math.max(1, (currentPage - 1) * pageSize + 1);
  const to = Math.min(currentPage * pageSize, stableDisplayTotal);
  return `${from}–${to} of ${stableDisplayTotal}`;
}

// ---------------------------------------------------------------------------
// 1. computeStableDisplayTotal — core bug-fix logic
// ---------------------------------------------------------------------------
describe('computeStableDisplayTotal — prevents zero-flicker', () => {
  it('returns pagination total when it is > 0', () => {
    const pag: PaginationMeta = { page: 1, limit: 9, total: 50, totalPages: 6 };
    const [stable, ref] = computeStableDisplayTotal(pag, 0);
    expect(stable).toBe(50);
    expect(ref).toBe(50);
  });

  it('falls back to lastValidRef when pagination is null (loading)', () => {
    const [stable, ref] = computeStableDisplayTotal(null, 50);
    expect(stable).toBe(50);
    expect(ref).toBe(50);
  });

  it('falls back to lastValidRef when pagination.total is 0', () => {
    const pag: PaginationMeta = { page: 2, limit: 9, total: 0, totalPages: 0 };
    const [stable, ref] = computeStableDisplayTotal(pag, 50);
    expect(stable).toBe(50);
    expect(ref).toBe(50);
  });

  it('returns 0 on very first render (both raw and ref are 0)', () => {
    const [stable, ref] = computeStableDisplayTotal(null, 0);
    expect(stable).toBe(0);
    expect(ref).toBe(0);
  });

  it('updates ref when fresh data arrives after transition', () => {
    // Initial render: pagination arrives with total=72
    const [, ref1] = computeStableDisplayTotal({ page: 1, limit: 9, total: 72, totalPages: 8 }, 0);
    // Transition: null pagination
    const [stable2, ref2] = computeStableDisplayTotal(null, ref1);
    expect(stable2).toBe(72);
    expect(ref2).toBe(72);
    // Data restored
    const [stable3, ref3] = computeStableDisplayTotal({ page: 2, limit: 9, total: 72, totalPages: 8 }, ref2);
    expect(stable3).toBe(72);
    expect(ref3).toBe(72);
  });

  it('chains correctly across multiple page transitions', () => {
    let ref = 0;
    // Load page 1
    let stable: number;
    [stable, ref] = computeStableDisplayTotal({ page: 1, limit: 9, total: 63, totalPages: 7 }, ref);
    expect(stable).toBe(63);
    // Transition to page 2
    [stable, ref] = computeStableDisplayTotal(null, ref);
    expect(stable).toBe(63);
    // Page 2 arrives
    [stable, ref] = computeStableDisplayTotal({ page: 2, limit: 9, total: 63, totalPages: 7 }, ref);
    expect(stable).toBe(63);
    // Transition to page 3
    [stable, ref] = computeStableDisplayTotal(null, ref);
    expect(stable).toBe(63);
    expect(ref).toBe(63);
  });
});

// ---------------------------------------------------------------------------
// 2. computeTotalPages
// ---------------------------------------------------------------------------
describe('computeTotalPages — page count with stableTotal', () => {
  it('cards mode: 9 items per page', () => {
    expect(computeTotalPages(9, CARD_PAGE_SIZE)).toBe(1);
    expect(computeTotalPages(10, CARD_PAGE_SIZE)).toBe(2);
    expect(computeTotalPages(72, CARD_PAGE_SIZE)).toBe(8);
    expect(computeTotalPages(73, CARD_PAGE_SIZE)).toBe(9);
  });

  it('list mode: 18 items per page', () => {
    expect(computeTotalPages(18, LIST_PAGE_SIZE)).toBe(1);
    expect(computeTotalPages(19, LIST_PAGE_SIZE)).toBe(2);
    expect(computeTotalPages(90, LIST_PAGE_SIZE)).toBe(5);
  });

  it('always at least 1 page even when stableTotal is 0', () => {
    expect(computeTotalPages(0, CARD_PAGE_SIZE)).toBe(1);
    expect(computeTotalPages(0, LIST_PAGE_SIZE)).toBe(1);
  });

  it('never returns 1 when stableTotal from previous page is 72', () => {
    // Bug: rawTotal=0, lastValidRef=72, stableTotal=72, pages=8 (not 1)
    const [stable] = computeStableDisplayTotal(null, 72);
    expect(computeTotalPages(stable, CARD_PAGE_SIZE)).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// 3. computeDisplayingText — top banner Displaying string
// ---------------------------------------------------------------------------
describe('computeDisplayingText — top banner display text', () => {
  describe('Classic mode, no liked-street filter', () => {
    it('page 1 of 72 cards → "Displaying 1 to 9 of 72 properties"', () => {
      expect(computeDisplayingText({
        isClassic: true, likedStreetModeApplied: false, likedSelectedStreet: '',
        currentPage: 1, pageSize: CARD_PAGE_SIZE, stableDisplayTotal: 72,
        likedStreetDisplayCount: 0, likedStreetTotalCount: 0,
      })).toBe('Displaying 1 to 9 of 72 properties');
    });

    it('page 2 of 72 cards → "Displaying 10 to 18 of 72 properties"', () => {
      expect(computeDisplayingText({
        isClassic: true, likedStreetModeApplied: false, likedSelectedStreet: '',
        currentPage: 2, pageSize: CARD_PAGE_SIZE, stableDisplayTotal: 72,
        likedStreetDisplayCount: 0, likedStreetTotalCount: 0,
      })).toBe('Displaying 10 to 18 of 72 properties');
    });

    it('does NOT produce "Displaying 10 to 0 of 0" when stable total is used', () => {
      const [stableDisplayTotal] = computeStableDisplayTotal(null, 72);
      const text = computeDisplayingText({
        isClassic: true, likedStreetModeApplied: false, likedSelectedStreet: '',
        currentPage: 2, pageSize: CARD_PAGE_SIZE, stableDisplayTotal,
        likedStreetDisplayCount: 0, likedStreetTotalCount: 0,
      });
      expect(text).toBe('Displaying 10 to 18 of 72 properties');
      expect(text).not.toContain('to 0 of 0');
    });

    it('partial last page: total=74, page 9 → "Displaying 73 to 74 of 74 properties"', () => {
      expect(computeDisplayingText({
        isClassic: true, likedStreetModeApplied: false, likedSelectedStreet: '',
        currentPage: 9, pageSize: CARD_PAGE_SIZE, stableDisplayTotal: 74,
        likedStreetDisplayCount: 0, likedStreetTotalCount: 0,
      })).toBe('Displaying 73 to 74 of 74 properties');
    });

    it('list mode page 1 of 100 → "Displaying 1 to 18 of 100 properties"', () => {
      expect(computeDisplayingText({
        isClassic: true, likedStreetModeApplied: false, likedSelectedStreet: '',
        currentPage: 1, pageSize: LIST_PAGE_SIZE, stableDisplayTotal: 100,
        likedStreetDisplayCount: 0, likedStreetTotalCount: 0,
      })).toBe('Displaying 1 to 18 of 100 properties');
    });
  });

  describe('Liked-street mode active', () => {
    it('uses likedStreetDisplayCount / likedStreetTotalCount regardless of isClassic', () => {
      // When both likedStreetModeApplied=true and likedSelectedStreet is set,
      // the display falls through to the else branch.
      expect(computeDisplayingText({
        isClassic: true, likedStreetModeApplied: true, likedSelectedStreet: 'Carina Crescent',
        currentPage: 1, pageSize: CARD_PAGE_SIZE, stableDisplayTotal: 72,
        likedStreetDisplayCount: 6, likedStreetTotalCount: 6,
      })).toBe('Displaying 1 to 6 of 6 properties');
    });

    it('classic=false also uses liked counts', () => {
      expect(computeDisplayingText({
        isClassic: false, likedStreetModeApplied: true, likedSelectedStreet: 'Glamorgan Drive',
        currentPage: 1, pageSize: CARD_PAGE_SIZE, stableDisplayTotal: 72,
        likedStreetDisplayCount: 3, likedStreetTotalCount: 3,
      })).toBe('Displaying 1 to 3 of 3 properties');
    });

    it('likedStreetModeApplied=true but no street selected → still classic range', () => {
      // likedStreetModeApplied=true but likedSelectedStreet='' → condition is false
      expect(computeDisplayingText({
        isClassic: true, likedStreetModeApplied: true, likedSelectedStreet: '',
        currentPage: 1, pageSize: CARD_PAGE_SIZE, stableDisplayTotal: 72,
        likedStreetDisplayCount: 0, likedStreetTotalCount: 0,
      })).toBe('Displaying 1 to 9 of 72 properties');
    });
  });

  describe('Infinite Scroll mode', () => {
    it('classic=false → uses likedStreetDisplayCount / likedStreetTotalCount', () => {
      // In infinite mode (isClassic=false, no liked-street), the else branch
      // shows "Displaying 1 to N of M" using the loaded-count values.
      expect(computeDisplayingText({
        isClassic: false, likedStreetModeApplied: false, likedSelectedStreet: '',
        currentPage: 1, pageSize: CARD_PAGE_SIZE, stableDisplayTotal: 72,
        likedStreetDisplayCount: 27, likedStreetTotalCount: 72,
      })).toBe('Displaying 1 to 27 of 72 properties');
    });
  });
});

// ---------------------------------------------------------------------------
// 4. computeBottomPaginationText — bottom bar "X–Y of Z" counter
// ---------------------------------------------------------------------------
describe('computeBottomPaginationText — bottom pagination bar', () => {
  it('page 1, 9/page, 72 total → "1–9 of 72"', () => {
    expect(computeBottomPaginationText(1, CARD_PAGE_SIZE, 72)).toBe('1–9 of 72');
  });

  it('page 2, 9/page, 72 total → "10–18 of 72"', () => {
    expect(computeBottomPaginationText(2, CARD_PAGE_SIZE, 72)).toBe('10–18 of 72');
  });

  it('last page (page 8, 9/page, 72 total) → "64–72 of 72"', () => {
    expect(computeBottomPaginationText(8, CARD_PAGE_SIZE, 72)).toBe('64–72 of 72');
  });

  it('partial last page → clamps to total', () => {
    expect(computeBottomPaginationText(9, CARD_PAGE_SIZE, 74)).toBe('73–74 of 74');
  });

  it('stable total prevents "10–0 of 0" during transition', () => {
    const [stableTotal] = computeStableDisplayTotal(null, 72);
    expect(computeBottomPaginationText(2, CARD_PAGE_SIZE, stableTotal)).toBe('10–18 of 72');
  });

  it('list mode page 2 of 100 → "19–36 of 100"', () => {
    expect(computeBottomPaginationText(2, LIST_PAGE_SIZE, 100)).toBe('19–36 of 100');
  });
});

// ---------------------------------------------------------------------------
// 5. Full transition simulation
// ---------------------------------------------------------------------------
describe('Full transition simulation — outreach Classic Pages', () => {
  it('Liked tab, page 1 → 2 transition stays correct', () => {
    let ref = 0;

    // Page 1 loads: 63 total liked properties, cards mode
    const pag1: PaginationMeta = { page: 1, limit: 9, total: 63, totalPages: 7 };
    let [stable, nextRef] = computeStableDisplayTotal(pag1, ref);
    ref = nextRef;
    expect(computeTotalPages(stable, CARD_PAGE_SIZE)).toBe(7);
    expect(computeDisplayingText({
      isClassic: true, likedStreetModeApplied: false, likedSelectedStreet: '',
      currentPage: 1, pageSize: CARD_PAGE_SIZE, stableDisplayTotal: stable,
      likedStreetDisplayCount: 9, likedStreetTotalCount: 63,
    })).toBe('Displaying 1 to 9 of 63 properties');

    // Transition: user clicks page 2, classicPagination temporarily null
    [stable, nextRef] = computeStableDisplayTotal(null, ref);
    ref = nextRef;
    // BUG: without fix → "Displaying 10 to 0 of 0", "Page 2 of 1"
    // FIX: stable=63, totalPages=7
    expect(stable).toBe(63);
    expect(computeTotalPages(stable, CARD_PAGE_SIZE)).toBe(7);
    expect(computeDisplayingText({
      isClassic: true, likedStreetModeApplied: false, likedSelectedStreet: '',
      currentPage: 2, pageSize: CARD_PAGE_SIZE, stableDisplayTotal: stable,
      likedStreetDisplayCount: 9, likedStreetTotalCount: 63,
    })).toBe('Displaying 10 to 18 of 63 properties');

    // Page 2 data arrives
    const pag2: PaginationMeta = { page: 2, limit: 9, total: 63, totalPages: 7 };
    [stable, nextRef] = computeStableDisplayTotal(pag2, ref);
    ref = nextRef;
    expect(stable).toBe(63);
    expect(computeDisplayingText({
      isClassic: true, likedStreetModeApplied: false, likedSelectedStreet: '',
      currentPage: 2, pageSize: CARD_PAGE_SIZE, stableDisplayTotal: stable,
      likedStreetDisplayCount: 9, likedStreetTotalCount: 63,
    })).toBe('Displaying 10 to 18 of 63 properties');
  });

  it('Cards → List viewMode switch: totalPages stays stable', () => {
    let ref = 0;

    // Cards mode, total=63
    let [stable, nextRef] = computeStableDisplayTotal(
      { page: 1, limit: 9, total: 63, totalPages: 7 }, ref,
    );
    ref = nextRef;
    expect(computeTotalPages(stable, CARD_PAGE_SIZE)).toBe(7);

    // Switch to List mode → refetch fires, pagination null temporarily
    [stable, nextRef] = computeStableDisplayTotal(null, ref);
    ref = nextRef;
    // List mode uses LIST_PAGE_SIZE=18; stableTotal=63 so pages=4 (not 1)
    expect(computeTotalPages(stable, LIST_PAGE_SIZE)).toBe(4); // ceil(63/18)
    expect(stable).toBe(63);

    // List page 1 data arrives
    [stable] = computeStableDisplayTotal(
      { page: 1, limit: 18, total: 63, totalPages: 4 }, ref,
    );
    expect(computeTotalPages(stable, LIST_PAGE_SIZE)).toBe(4);
    expect(computeDisplayingText({
      isClassic: true, likedStreetModeApplied: false, likedSelectedStreet: '',
      currentPage: 1, pageSize: LIST_PAGE_SIZE, stableDisplayTotal: stable,
      likedStreetDisplayCount: 18, likedStreetTotalCount: 63,
    })).toBe('Displaying 1 to 18 of 63 properties');
  });
});

// ---------------------------------------------------------------------------
// 6. Edge cases
// ---------------------------------------------------------------------------
describe('Edge cases', () => {
  it('single pending item shows correctly', () => {
    const [stable] = computeStableDisplayTotal(
      { page: 1, limit: 9, total: 1, totalPages: 1 }, 0,
    );
    expect(computeDisplayingText({
      isClassic: true, likedStreetModeApplied: false, likedSelectedStreet: '',
      currentPage: 1, pageSize: CARD_PAGE_SIZE, stableDisplayTotal: stable,
      likedStreetDisplayCount: 1, likedStreetTotalCount: 1,
    })).toBe('Displaying 1 to 1 of 1 properties');
  });

  it('exactly CARD_PAGE_SIZE items: page 1 is also last page', () => {
    const [stable] = computeStableDisplayTotal(
      { page: 1, limit: 9, total: 9, totalPages: 1 }, 0,
    );
    expect(computeTotalPages(stable, CARD_PAGE_SIZE)).toBe(1);
    expect(computeBottomPaginationText(1, CARD_PAGE_SIZE, stable)).toBe('1–9 of 9');
  });

  it('switching tabs clears lastValidRef to 0 effectively (new filter key)', () => {
    // When tab changes, filter key changes → new request → new cache miss.
    // The ref starting at 0 means the first render still shows 0 briefly,
    // which is acceptable (it is loading). Once data arrives, it stabilises.
    const [stable] = computeStableDisplayTotal(null, 0);
    expect(stable).toBe(0);
    // After data arrives
    const [stable2] = computeStableDisplayTotal(
      { page: 1, limit: 9, total: 45, totalPages: 5 }, stable,
    );
    expect(stable2).toBe(45);
  });
});

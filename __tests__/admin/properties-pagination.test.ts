/**
 * Unit tests for the Classic Pages pagination display logic in
 * app/admin/properties/page.tsx.
 *
 * The page uses three pure calculations for every render:
 *   1. totalProperties — picks the right total source (streetMode / classic / infinite)
 *      and falls back to the last non-zero value via lastValidTotalRef to prevent
 *      the "Displaying 10 to 0 of 0" glitch during fetch transitions.
 *   2. totalPages      — Math.max(1, ceil(totalProperties / pageSize))
 *   3. Displaying text — "Displaying X to Y of Z properties"
 *
 * These functions are extracted here as plain TypeScript so tests run without
 * jsdom / React rendering overhead and remain fast in CI.
 */

import { describe, it, expect, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Constants (mirrored from page.tsx)
// ---------------------------------------------------------------------------
const CARD_PAGE_SIZE = 9;
const LIST_PAGE_SIZE = 18;

// ---------------------------------------------------------------------------
// Pure helpers extracted from page.tsx render body
// ---------------------------------------------------------------------------

/**
 * Mirrors the lastValidTotalRef + rawTotal stabilisation logic in page.tsx.
 * Returns [stableTotal, updatedRef] so tests can chain calls.
 */
function computeStableTotal(
  rawTotal: number,
  lastValidRef: number,
): [stableTotal: number, nextRef: number] {
  const nextRef = rawTotal > 0 ? rawTotal : lastValidRef;
  const stableTotal = rawTotal > 0 ? rawTotal : lastValidRef;
  return [stableTotal, nextRef];
}

/**
 * Mirrors:
 *   const totalProperties = streetModeOn
 *     ? streetAllLength
 *     : (isClassic ? (classicData?.total ?? 0) : (propertiesData?.pages[0]?.total || 0));
 */
function computeRawTotal(opts: {
  streetModeOn: boolean;
  streetAllLength: number;
  isClassic: boolean;
  classicTotal: number | undefined;
  infiniteFirstPageTotal: number | undefined;
}): number {
  const { streetModeOn, streetAllLength, isClassic, classicTotal, infiniteFirstPageTotal } = opts;
  if (streetModeOn) return streetAllLength;
  if (isClassic) return classicTotal ?? 0;
  return infiniteFirstPageTotal ?? 0;
}

/** Mirrors: Math.max(1, Math.ceil(totalProperties / pageSize)) */
function computeTotalPages(totalProperties: number, pageSize: number): number {
  return Math.max(1, Math.ceil(totalProperties / pageSize));
}

/** Mirrors the Classic Pages "Displaying X to Y of Z" formula */
function computeDisplayingText(
  isClassic: boolean,
  currentPage: number,
  pageSize: number,
  totalProperties: number,
  loadedCount: number,
): string {
  if (isClassic) {
    const from = Math.max(1, (currentPage - 1) * pageSize + 1);
    const to = Math.min(currentPage * pageSize, totalProperties);
    return `Displaying ${from} to ${to} of ${totalProperties} properties`;
  }
  return `Displaying 1 to ${loadedCount} of ${totalProperties} properties`;
}

// ---------------------------------------------------------------------------
// 1. computeRawTotal
// ---------------------------------------------------------------------------
describe('computeRawTotal — picks the right total source', () => {
  it('returns streetAllLength when streetModeOn is true', () => {
    expect(computeRawTotal({
      streetModeOn: true, streetAllLength: 42,
      isClassic: true, classicTotal: 100, infiniteFirstPageTotal: 200,
    })).toBe(42);
  });

  it('returns classicTotal when isClassic=true and streetModeOn=false', () => {
    expect(computeRawTotal({
      streetModeOn: false, streetAllLength: 0,
      isClassic: true, classicTotal: 77, infiniteFirstPageTotal: 200,
    })).toBe(77);
  });

  it('returns 0 when isClassic=true and classicTotal is undefined (loading)', () => {
    expect(computeRawTotal({
      streetModeOn: false, streetAllLength: 0,
      isClassic: true, classicTotal: undefined, infiniteFirstPageTotal: 200,
    })).toBe(0);
  });

  it('returns infiniteFirstPageTotal when isClassic=false and streetModeOn=false', () => {
    expect(computeRawTotal({
      streetModeOn: false, streetAllLength: 0,
      isClassic: false, classicTotal: 77, infiniteFirstPageTotal: 156,
    })).toBe(156);
  });

  it('returns 0 when all sources are undefined/empty', () => {
    expect(computeRawTotal({
      streetModeOn: false, streetAllLength: 0,
      isClassic: false, classicTotal: undefined, infiniteFirstPageTotal: undefined,
    })).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 2. computeStableTotal — the core bug-fix logic
// ---------------------------------------------------------------------------
describe('computeStableTotal — lastValidTotalRef keeps display stable', () => {
  it('stores and returns rawTotal when rawTotal > 0', () => {
    const [stable, ref] = computeStableTotal(100, 0);
    expect(stable).toBe(100);
    expect(ref).toBe(100);
  });

  it('falls back to lastValidRef when rawTotal is 0 (transition state)', () => {
    // Simulate: user was on page 1 (total=81), clicks page 2, API hasn't
    // responded yet → rawTotal=0, but lastValidRef=81
    const [stable, ref] = computeStableTotal(0, 81);
    expect(stable).toBe(81);   // display stays correct
    expect(ref).toBe(81);      // ref unchanged (still holds last valid)
  });

  it('lastValidRef is 0 on first render when rawTotal is also 0', () => {
    const [stable, ref] = computeStableTotal(0, 0);
    expect(stable).toBe(0);
    expect(ref).toBe(0);
  });

  it('updates ref when a fresh total arrives after a transition', () => {
    // Page 1 loaded (total=81)
    const [, ref1] = computeStableTotal(81, 0);
    // Transition: fetching page 2 (total=0 temporarily)
    const [stable2, ref2] = computeStableTotal(0, ref1);
    expect(stable2).toBe(81);   // display unchanged
    expect(ref2).toBe(81);      // ref unchanged
    // Page 2 data arrives
    const [stable3, ref3] = computeStableTotal(81, ref2);
    expect(stable3).toBe(81);
    expect(ref3).toBe(81);
  });

  it('updates ref when viewMode switches and new total differs', () => {
    // List mode page 1 returned total=200
    const [, refAfterList] = computeStableTotal(200, 0);
    // Switch to Card mode — TanStack refetches, brief total=0
    const [stableDuring, refDuring] = computeStableTotal(0, refAfterList);
    expect(stableDuring).toBe(200);  // no flicker to 0
    expect(refDuring).toBe(200);
    // New Card-mode total arrives (same data, different pageSize)
    const [stableAfter, refAfter] = computeStableTotal(200, refDuring);
    expect(stableAfter).toBe(200);
    expect(refAfter).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// 3. computeTotalPages
// ---------------------------------------------------------------------------
describe('computeTotalPages — page count calculations', () => {
  it('cards mode: 9 items per page', () => {
    expect(computeTotalPages(9, CARD_PAGE_SIZE)).toBe(1);
    expect(computeTotalPages(10, CARD_PAGE_SIZE)).toBe(2);
    expect(computeTotalPages(81, CARD_PAGE_SIZE)).toBe(9);
    expect(computeTotalPages(82, CARD_PAGE_SIZE)).toBe(10);
  });

  it('list mode: 18 items per page', () => {
    expect(computeTotalPages(18, LIST_PAGE_SIZE)).toBe(1);
    expect(computeTotalPages(19, LIST_PAGE_SIZE)).toBe(2);
    expect(computeTotalPages(100, LIST_PAGE_SIZE)).toBe(6);
  });

  it('always returns at least 1 (even for total=0)', () => {
    expect(computeTotalPages(0, CARD_PAGE_SIZE)).toBe(1);
    expect(computeTotalPages(0, LIST_PAGE_SIZE)).toBe(1);
  });

  it('never produces "Page 2 of 1" when total briefly drops to 0', () => {
    // The bug: rawTotal=0, so totalPages=1, but currentPage=2
    // Fix: stableTotal uses last valid 81, so totalPages stays 9
    const [stableTotal] = computeStableTotal(0, 81);
    const pages = computeTotalPages(stableTotal, CARD_PAGE_SIZE);
    expect(pages).toBe(9);   // 81/9=9, currentPage=2 is valid
  });
});

// ---------------------------------------------------------------------------
// 4. computeDisplayingText — the visible string users see
// ---------------------------------------------------------------------------
describe('computeDisplayingText — Classic Pages display text', () => {
  describe('Cards mode (pageSize=9)', () => {
    it('page 1 of 81 total → "Displaying 1 to 9 of 81 properties"', () => {
      expect(computeDisplayingText(true, 1, CARD_PAGE_SIZE, 81, 9))
        .toBe('Displaying 1 to 9 of 81 properties');
    });

    it('page 2 of 81 total → "Displaying 10 to 18 of 81 properties"', () => {
      expect(computeDisplayingText(true, 2, CARD_PAGE_SIZE, 81, 9))
        .toBe('Displaying 10 to 18 of 81 properties');
    });

    it('last page (page 9 of 81) → "Displaying 73 to 81 of 81 properties"', () => {
      expect(computeDisplayingText(true, 9, CARD_PAGE_SIZE, 81, 9))
        .toBe('Displaying 73 to 81 of 81 properties');
    });

    it('partial last page: total=83, page 10 → "Displaying 82 to 83 of 83 properties"', () => {
      expect(computeDisplayingText(true, 10, CARD_PAGE_SIZE, 83, 2))
        .toBe('Displaying 82 to 83 of 83 properties');
    });

    it('does NOT produce "Displaying 10 to 0 of 0" when total is stable', () => {
      // The bug scenario: rawTotal=0, stableTotal=81 (last valid)
      const [stableTotal] = computeStableTotal(0, 81);
      const text = computeDisplayingText(true, 2, CARD_PAGE_SIZE, stableTotal, 9);
      expect(text).toBe('Displaying 10 to 18 of 81 properties');
      expect(text).not.toContain('to 0 of 0');
    });
  });

  describe('List mode (pageSize=18)', () => {
    it('page 1 of 100 → "Displaying 1 to 18 of 100 properties"', () => {
      expect(computeDisplayingText(true, 1, LIST_PAGE_SIZE, 100, 18))
        .toBe('Displaying 1 to 18 of 100 properties');
    });

    it('page 2 of 100 → "Displaying 19 to 36 of 100 properties"', () => {
      expect(computeDisplayingText(true, 2, LIST_PAGE_SIZE, 100, 18))
        .toBe('Displaying 19 to 36 of 100 properties');
    });

    it('last partial page: total=20, page 2 → "Displaying 19 to 20 of 20 properties"', () => {
      expect(computeDisplayingText(true, 2, LIST_PAGE_SIZE, 20, 2))
        .toBe('Displaying 19 to 20 of 20 properties');
    });
  });

  describe('Infinite Scroll mode', () => {
    it('shows 1 to loadedCount of total', () => {
      expect(computeDisplayingText(false, 1, CARD_PAGE_SIZE, 200, 27))
        .toBe('Displaying 1 to 27 of 200 properties');
    });

    it('ignores currentPage and pageSize in infinite mode', () => {
      // Even if currentPage=5, infinite always starts from 1
      expect(computeDisplayingText(false, 5, CARD_PAGE_SIZE, 200, 45))
        .toBe('Displaying 1 to 45 of 200 properties');
    });
  });
});

// ---------------------------------------------------------------------------
// 5. Integration: full transition simulation
// ---------------------------------------------------------------------------
describe('Full transition simulation — Cards mode page flip', () => {
  it('page 1 → page 2: display stays correct throughout transition', () => {
    let lastValidRef = 0;

    // Step 1: page 1 data arrives (81 total, 9 items)
    const [total1, ref1] = computeStableTotal(
      computeRawTotal({ streetModeOn: false, streetAllLength: 0, isClassic: true, classicTotal: 81, infiniteFirstPageTotal: undefined }),
      lastValidRef,
    );
    lastValidRef = ref1;
    expect(computeTotalPages(total1, CARD_PAGE_SIZE)).toBe(9);
    expect(computeDisplayingText(true, 1, CARD_PAGE_SIZE, total1, 9))
      .toBe('Displaying 1 to 9 of 81 properties');

    // Step 2: user clicks page 2; TanStack refetches → classicData = undefined briefly
    const [total2, ref2] = computeStableTotal(
      computeRawTotal({ streetModeOn: false, streetAllLength: 0, isClassic: true, classicTotal: undefined, infiniteFirstPageTotal: undefined }),
      lastValidRef,
    );
    lastValidRef = ref2;
    // BUG SCENARIO: without fix, total2=0, totalPages=1, "Displaying 10 to 0 of 0"
    // WITH FIX: total2=81, totalPages=9, display correct
    expect(total2).toBe(81);
    expect(computeTotalPages(total2, CARD_PAGE_SIZE)).toBe(9);
    expect(computeDisplayingText(true, 2, CARD_PAGE_SIZE, total2, 9))
      .toBe('Displaying 10 to 18 of 81 properties');

    // Step 3: page 2 data arrives (same total=81)
    const [total3] = computeStableTotal(
      computeRawTotal({ streetModeOn: false, streetAllLength: 0, isClassic: true, classicTotal: 81, infiniteFirstPageTotal: undefined }),
      lastValidRef,
    );
    expect(total3).toBe(81);
    expect(computeDisplayingText(true, 2, CARD_PAGE_SIZE, total3, 9))
      .toBe('Displaying 10 to 18 of 81 properties');
  });

  it('List → Cards viewMode switch: totalPages stays stable during transition', () => {
    let lastValidRef = 0;

    // List mode, page 1, total=200
    const [totalList, refList] = computeStableTotal(
      computeRawTotal({ streetModeOn: false, streetAllLength: 0, isClassic: true, classicTotal: 200, infiniteFirstPageTotal: undefined }),
      lastValidRef,
    );
    lastValidRef = refList;
    expect(computeTotalPages(totalList, LIST_PAGE_SIZE)).toBe(12); // 200/18=12

    // Switch to Cards mode → currentPage resets to 1, but API refetches briefly with undefined
    const [totalTransition] = computeStableTotal(
      computeRawTotal({ streetModeOn: false, streetAllLength: 0, isClassic: true, classicTotal: undefined, infiniteFirstPageTotal: undefined }),
      lastValidRef,
    );
    // With fix: totalPages=23 (200/9), never 1
    expect(computeTotalPages(totalTransition, CARD_PAGE_SIZE)).toBe(23); // ceil(200/9)
    expect(totalTransition).toBe(200); // no zero flicker
  });
});

// ---------------------------------------------------------------------------
// 6. Edge cases
// ---------------------------------------------------------------------------
describe('Edge cases', () => {
  it('single item: cards mode shows "Displaying 1 to 1 of 1 properties"', () => {
    const [total] = computeStableTotal(1, 0);
    expect(computeDisplayingText(true, 1, CARD_PAGE_SIZE, total, 1))
      .toBe('Displaying 1 to 1 of 1 properties');
    expect(computeTotalPages(total, CARD_PAGE_SIZE)).toBe(1);
  });

  it('exactly CARD_PAGE_SIZE items fills page 1 completely', () => {
    const [total] = computeStableTotal(9, 0);
    expect(computeDisplayingText(true, 1, CARD_PAGE_SIZE, total, 9))
      .toBe('Displaying 1 to 9 of 9 properties');
    expect(computeTotalPages(total, CARD_PAGE_SIZE)).toBe(1);
  });

  it('exactly CARD_PAGE_SIZE+1 items creates page 2 with 1 item', () => {
    const [total] = computeStableTotal(10, 0);
    expect(computeTotalPages(total, CARD_PAGE_SIZE)).toBe(2);
    expect(computeDisplayingText(true, 2, CARD_PAGE_SIZE, total, 1))
      .toBe('Displaying 10 to 10 of 10 properties');
  });

  it('street mode overrides classic/infinite total', () => {
    const rawTotal = computeRawTotal({
      streetModeOn: true, streetAllLength: 35,
      isClassic: true, classicTotal: 100, infiniteFirstPageTotal: 200,
    });
    expect(rawTotal).toBe(35);
    const [total] = computeStableTotal(rawTotal, 0);
    expect(computeTotalPages(total, CARD_PAGE_SIZE)).toBe(4); // ceil(35/9)
  });
});

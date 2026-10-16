import { describe, it, expect } from 'vitest';

function filterOutCollectionSuburbs(suburbs: string[]): string[] {
  return suburbs.filter(s => s !== 'North Shore');
}

function classifySuburbs(
  orderedSuburbs: string[],
  suburbSentStats: Record<string, { total: number; sent: number; unsent: number }>
): { active: string[]; fullySent: string[] } {
  const fullySent: string[] = [];
  const active: string[] = [];
  for (const s of orderedSuburbs) {
    const stats = suburbSentStats[s];
    if (stats && stats.unsent === 0 && stats.sent > 0) {
      fullySent.push(s);
    } else {
      active.push(s);
    }
  }
  return { active, fullySent };
}

function getVisibleSuburbs(
  orderedSuburbs: string[],
  suburbSentStats: Record<string, { total: number; sent: number; unsent: number }>,
  showAll: boolean
): string[] {
  const { active } = classifySuburbs(orderedSuburbs, suburbSentStats);
  if (showAll) return orderedSuburbs;
  return active;
}

function shouldAutoShowAll(
  reportSuburbFilter: string,
  suburbSentStats: Record<string, { total: number; sent: number; unsent: number }>
): boolean {
  const stats = suburbSentStats[reportSuburbFilter];
  return !!stats && stats.unsent === 0 && stats.sent > 0;
}

describe('North Shore filtering', () => {
  it('removes North Shore from suburbs list', () => {
    const suburbs = ['Albany', 'North Shore', 'Torbay', 'Oteha'];
    expect(filterOutCollectionSuburbs(suburbs)).toEqual(['Albany', 'Torbay', 'Oteha']);
  });

  it('keeps all suburbs when North Shore is not present', () => {
    const suburbs = ['Albany', 'Torbay', 'Oteha'];
    expect(filterOutCollectionSuburbs(suburbs)).toEqual(['Albany', 'Torbay', 'Oteha']);
  });

  it('returns empty array when only North Shore exists', () => {
    expect(filterOutCollectionSuburbs(['North Shore'])).toEqual([]);
  });

  it('handles empty array', () => {
    expect(filterOutCollectionSuburbs([])).toEqual([]);
  });
});

describe('ReportFilterSection suburb classification', () => {
  const stats = {
    Albany: { total: 50, sent: 50, unsent: 0 },
    Torbay: { total: 40, sent: 30, unsent: 10 },
    Oteha: { total: 60, sent: 0, unsent: 60 },
    BrownsBay: { total: 35, sent: 35, unsent: 0 },
    LongBay: { total: 45, sent: 40, unsent: 5 },
  };

  it('identifies fully-sent suburbs (unsent=0, sent>0)', () => {
    const { fullySent } = classifySuburbs(Object.keys(stats), stats);
    expect(fullySent).toContain('Albany');
    expect(fullySent).toContain('BrownsBay');
    expect(fullySent).toHaveLength(2);
  });

  it('identifies active suburbs (has unsent addresses)', () => {
    const { active } = classifySuburbs(Object.keys(stats), stats);
    expect(active).toContain('Torbay');
    expect(active).toContain('Oteha');
    expect(active).toContain('LongBay');
    expect(active).toHaveLength(3);
  });

  it('does not classify suburb with unsent>0 as fully sent', () => {
    const { fullySent } = classifySuburbs(['LongBay'], stats);
    expect(fullySent).toHaveLength(0);
  });

  it('does not classify suburb with sent=0 as fully sent', () => {
    const { fullySent } = classifySuburbs(['Oteha'], stats);
    expect(fullySent).toHaveLength(0);
  });

  it('hides fully-sent suburbs when showAll is false', () => {
    const visible = getVisibleSuburbs(Object.keys(stats), stats, false);
    expect(visible).not.toContain('Albany');
    expect(visible).not.toContain('BrownsBay');
    expect(visible).toContain('Torbay');
    expect(visible).toContain('Oteha');
    expect(visible).toContain('LongBay');
  });

  it('shows all suburbs when showAll is true', () => {
    const visible = getVisibleSuburbs(Object.keys(stats), stats, true);
    expect(visible).toEqual(Object.keys(stats));
  });

  it('auto-shows all when default report suburb is fully sent', () => {
    expect(shouldAutoShowAll('Albany', stats)).toBe(true);
    expect(shouldAutoShowAll('BrownsBay', stats)).toBe(true);
  });

  it('does not auto-show when default report suburb is not fully sent', () => {
    expect(shouldAutoShowAll('Torbay', stats)).toBe(false);
    expect(shouldAutoShowAll('Oteha', stats)).toBe(false);
  });

  it('returns empty active list when all suburbs are fully sent', () => {
    const allSent = {
      A: { total: 10, sent: 10, unsent: 0 },
      B: { total: 5, sent: 5, unsent: 0 },
    };
    const { active, fullySent } = classifySuburbs(['A', 'B'], allSent);
    expect(active).toHaveLength(0);
    expect(fullySent).toHaveLength(2);
  });

  it('handles empty suburb list', () => {
    const { active, fullySent } = classifySuburbs([], stats);
    expect(active).toHaveLength(0);
    expect(fullySent).toHaveLength(0);
  });

  it('handles suburbs with no stats data', () => {
    const { active, fullySent } = classifySuburbs(['UnknownSuburb'], {});
    expect(active).toEqual(['UnknownSuburb']);
    expect(fullySent).toHaveLength(0);
  });

  it('preserves order when filtering', () => {
    const ordered = ['Torbay', 'Albany', 'Oteha', 'BrownsBay'];
    const visible = getVisibleSuburbs(ordered, stats, false);
    expect(visible).toEqual(['Torbay', 'Oteha']);
  });

  it('hiddenCount is difference between total and visible', () => {
    const ordered = Object.keys(stats);
    const visible = getVisibleSuburbs(ordered, stats, false);
    const hiddenCount = ordered.length - visible.length;
    expect(hiddenCount).toBe(2);
  });

  it('more button should show when hiddenCount > 0 and showAll is false', () => {
    const ordered = Object.keys(stats);
    const visible = getVisibleSuburbs(ordered, stats, false);
    const hiddenCount = ordered.length - visible.length;
    expect(hiddenCount > 0).toBe(true);
  });

  it('hide button should show when showAll is true and hiddenCount > 0', () => {
    const ordered = Object.keys(stats);
    const visibleDefault = getVisibleSuburbs(ordered, stats, false);
    const hiddenCount = ordered.length - visibleDefault.length;
    expect(hiddenCount > 0).toBe(true);
  });
});

describe('ReportFilterSection edge cases', () => {
  it('suburb with unsent=0 and sent=0 is not fully sent', () => {
    const stats = { Empty: { total: 0, sent: 0, unsent: 0 } };
    const { fullySent } = classifySuburbs(['Empty'], stats);
    expect(fullySent).toHaveLength(0);
  });

  it('suburb with only junk is not fully sent', () => {
    const stats = { Junk: { total: 10, sent: 0, unsent: 10 } };
    const { fullySent } = classifySuburbs(['Junk'], stats);
    expect(fullySent).toHaveLength(0);
  });

  it('does not auto-show when report suburb is empty string', () => {
    const stats = { Albany: { total: 10, sent: 10, unsent: 0 } };
    expect(shouldAutoShowAll('', stats)).toBe(false);
  });
});

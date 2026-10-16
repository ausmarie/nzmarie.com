import { describe, it, expect } from 'vitest';
import { SUBURB_PRIORITY_ORDER } from '@/lib/suburb-order';

interface SuburbDispatch {
  suburb: string;
  sent_count: number;
  junk_count: number;
  unsent_count: number;
  total_count: number;
  first_sent_at?: string;
  last_sent_at?: string;
}

function sortSuburbDispatchTimeline(suburbs: SuburbDispatch[]): SuburbDispatch[] {
  const mergedMap = new Map<string, SuburbDispatch>();
  for (const s of suburbs) {
    const key = s.suburb;
    const existing = mergedMap.get(key);
    if (!existing) {
      mergedMap.set(key, { ...s, suburb: key });
    } else {
      existing.sent_count += s.sent_count;
      existing.junk_count += s.junk_count;
      existing.unsent_count += s.unsent_count;
      existing.total_count += s.total_count;
      if (s.first_sent_at) {
        if (!existing.first_sent_at || s.first_sent_at < existing.first_sent_at) {
          existing.first_sent_at = s.first_sent_at;
        }
      }
      if (s.last_sent_at) {
        if (!existing.last_sent_at || s.last_sent_at > existing.last_sent_at) {
          existing.last_sent_at = s.last_sent_at;
        }
      }
    }
  }

  const merged = Array.from(mergedMap.values())
    .filter((s) => s.sent_count > 0 || s.junk_count > 0 || s.total_count > 0);

  const sentSuburbs = merged
    .filter((s) => s.sent_count > 0)
    .sort((a, b) => {
      const ta = a.last_sent_at ? new Date(a.last_sent_at).getTime() : 0;
      const tb = b.last_sent_at ? new Date(b.last_sent_at).getTime() : 0;
      return tb - ta;
    });

  const unsentSuburbs = merged
    .filter((s) => s.sent_count === 0)
    .sort((a, b) => {
      const stripQuarter = (name: string) => name.replace(/-Q\d-\d{4}$/i, '').trim();
      const ia = SUBURB_PRIORITY_ORDER.indexOf(stripQuarter(a.suburb) as (typeof SUBURB_PRIORITY_ORDER)[number]);
      const ib = SUBURB_PRIORITY_ORDER.indexOf(stripQuarter(b.suburb) as (typeof SUBURB_PRIORITY_ORDER)[number]);
      const rankA = ia === -1 ? SUBURB_PRIORITY_ORDER.length : ia;
      const rankB = ib === -1 ? SUBURB_PRIORITY_ORDER.length : ib;
      return rankA - rankB;
    });

  return [...sentSuburbs, ...unsentSuburbs];
}

describe('SuburbDispatchTimeline sorting', () => {
  it('sorts sent suburbs by last_sent_at descending', () => {
    const input: SuburbDispatch[] = [
      { suburb: 'Albany', sent_count: 10, junk_count: 0, unsent_count: 0, total_count: 10, last_sent_at: '2026-09-01' },
      { suburb: 'Torbay', sent_count: 20, junk_count: 0, unsent_count: 0, total_count: 20, last_sent_at: '2026-09-10' },
      { suburb: 'Oteha', sent_count: 15, junk_count: 0, unsent_count: 0, total_count: 15, last_sent_at: '2026-09-05' },
    ];
    const result = sortSuburbDispatchTimeline(input);
    expect(result.map(s => s.suburb)).toEqual(['Torbay', 'Oteha', 'Albany']);
  });

  it('sorts unsent suburbs by SUBURB_PRIORITY_ORDER', () => {
    const input: SuburbDispatch[] = [
      { suburb: 'Albany', sent_count: 0, junk_count: 0, unsent_count: 10, total_count: 10 },
      { suburb: 'Northcross', sent_count: 0, junk_count: 0, unsent_count: 5, total_count: 5 },
      { suburb: 'Torbay', sent_count: 0, junk_count: 0, unsent_count: 8, total_count: 8 },
    ];
    const result = sortSuburbDispatchTimeline(input);
    expect(result.map(s => s.suburb)).toEqual(['Northcross', 'Torbay', 'Albany']);
  });

  it('sorts unsent suburbs with quarter suffix by SUBURB_PRIORITY_ORDER', () => {
    const input: SuburbDispatch[] = [
      { suburb: 'Albany-Q3-2026', sent_count: 0, junk_count: 0, unsent_count: 10, total_count: 10 },
      { suburb: 'Northcross-Q3-2026', sent_count: 0, junk_count: 0, unsent_count: 5, total_count: 5 },
      { suburb: 'Torbay-Q3-2026', sent_count: 0, junk_count: 0, unsent_count: 8, total_count: 8 },
    ];
    const result = sortSuburbDispatchTimeline(input);
    expect(result.map(s => s.suburb)).toEqual(['Northcross-Q3-2026', 'Torbay-Q3-2026', 'Albany-Q3-2026']);
  });

  it('places sent suburbs before unsent suburbs', () => {
    const input: SuburbDispatch[] = [
      { suburb: 'Northcross', sent_count: 0, junk_count: 0, unsent_count: 5, total_count: 5 },
      { suburb: 'Torbay', sent_count: 20, junk_count: 0, unsent_count: 0, total_count: 20, last_sent_at: '2026-09-10' },
    ];
    const result = sortSuburbDispatchTimeline(input);
    expect(result.map(s => s.suburb)).toEqual(['Torbay', 'Northcross']);
  });

  it('handles mixed sent and unsent suburbs correctly', () => {
    const input: SuburbDispatch[] = [
      { suburb: 'Albany-Q3-2026', sent_count: 0, junk_count: 0, unsent_count: 10, total_count: 10 },
      { suburb: 'Torbay-Q3-2026', sent_count: 20, junk_count: 0, unsent_count: 0, total_count: 20, last_sent_at: '2026-09-10' },
      { suburb: 'Northcross-Q3-2026', sent_count: 0, junk_count: 0, unsent_count: 5, total_count: 5 },
      { suburb: 'Oteha-Q3-2026', sent_count: 15, junk_count: 0, unsent_count: 0, total_count: 15, last_sent_at: '2026-09-05' },
    ];
    const result = sortSuburbDispatchTimeline(input);
    expect(result.map(s => s.suburb)).toEqual(['Torbay-Q3-2026', 'Oteha-Q3-2026', 'Northcross-Q3-2026', 'Albany-Q3-2026']);
  });

  it('merges duplicate suburb entries', () => {
    const input: SuburbDispatch[] = [
      { suburb: 'Torbay', sent_count: 10, junk_count: 0, unsent_count: 0, total_count: 10, last_sent_at: '2026-09-01' },
      { suburb: 'Torbay', sent_count: 5, junk_count: 0, unsent_count: 0, total_count: 5, last_sent_at: '2026-09-10' },
    ];
    const result = sortSuburbDispatchTimeline(input);
    expect(result).toHaveLength(1);
    expect(result[0].sent_count).toBe(15);
    expect(result[0].last_sent_at).toBe('2026-09-10');
  });

  it('handles unknown suburbs in unsent group', () => {
    const input: SuburbDispatch[] = [
      { suburb: 'UnknownSuburb', sent_count: 0, junk_count: 0, unsent_count: 5, total_count: 5 },
      { suburb: 'Northcross', sent_count: 0, junk_count: 0, unsent_count: 3, total_count: 3 },
    ];
    const result = sortSuburbDispatchTimeline(input);
    expect(result.map(s => s.suburb)).toEqual(['Northcross', 'UnknownSuburb']);
  });

  it('returns empty array for empty input', () => {
    expect(sortSuburbDispatchTimeline([])).toEqual([]);
  });
});

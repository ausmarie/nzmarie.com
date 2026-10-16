import { describe, it, expect } from 'vitest';

interface SentSummaryItem {
  suburb: string;
  sent_count: number;
}

function sortBySentCountDesc(suburbs: SentSummaryItem[]): SentSummaryItem[] {
  return [...suburbs].sort((a, b) => b.sent_count - a.sent_count);
}

describe('Total Sent cards sorting', () => {
  it('sorts suburbs by sent_count descending', () => {
    const input: SentSummaryItem[] = [
      { suburb: 'Albany', sent_count: 100 },
      { suburb: 'Torbay', sent_count: 300 },
      { suburb: 'Browns Bay', sent_count: 200 },
    ];
    const result = sortBySentCountDesc(input);
    expect(result.map(s => s.suburb)).toEqual(['Torbay', 'Browns Bay', 'Albany']);
  });

  it('places highest sent_count first', () => {
    const input: SentSummaryItem[] = [
      { suburb: 'A', sent_count: 1 },
      { suburb: 'B', sent_count: 5 },
      { suburb: 'C', sent_count: 3 },
    ];
    const result = sortBySentCountDesc(input);
    expect(result.map(s => s.suburb)).toEqual(['B', 'C', 'A']);
  });

  it('handles ties by preserving original order (stable sort)', () => {
    const input: SentSummaryItem[] = [
      { suburb: 'Albany', sent_count: 100 },
      { suburb: 'Torbay', sent_count: 100 },
      { suburb: 'Browns Bay', sent_count: 100 },
    ];
    const result = sortBySentCountDesc(input);
    expect(result.map(s => s.suburb)).toEqual(['Albany', 'Torbay', 'Browns Bay']);
  });

  it('handles single suburb', () => {
    const input: SentSummaryItem[] = [{ suburb: 'Torbay', sent_count: 50 }];
    const result = sortBySentCountDesc(input);
    expect(result.map(s => s.suburb)).toEqual(['Torbay']);
  });

  it('returns empty array for empty input', () => {
    expect(sortBySentCountDesc([])).toEqual([]);
  });

  it('does not mutate original array', () => {
    const input: SentSummaryItem[] = [
      { suburb: 'A', sent_count: 10 },
      { suburb: 'B', sent_count: 5 },
    ];
    const original = [...input];
    sortBySentCountDesc(input);
    expect(input).toEqual(original);
  });

  it('handles mixed large and small counts', () => {
    const input: SentSummaryItem[] = [
      { suburb: 'Northcross', sent_count: 0 },
      { suburb: 'Torbay', sent_count: 999 },
      { suburb: 'Oteha', sent_count: 1 },
      { suburb: 'Fairview Heights', sent_count: 500 },
    ];
    const result = sortBySentCountDesc(input);
    expect(result.map(s => s.suburb)).toEqual(['Torbay', 'Fairview Heights', 'Oteha', 'Northcross']);
  });
});

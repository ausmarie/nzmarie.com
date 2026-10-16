import { describe, it, expect } from 'vitest';
import { sortSuburbs, SUBURB_PRIORITY_ORDER } from '@/lib/suburb-order';

describe('sortSuburbs', () => {
  it('sorts known suburbs in priority order', () => {
    const input = ['Albany', 'Northcross', 'Oteha', 'Torbay'];
    expect(sortSuburbs(input)).toEqual(['Northcross', 'Oteha', 'Torbay', 'Albany']);
  });

  it('places unknown suburbs alphabetically after known ones', () => {
    const input = ['Zanzibar', 'Oteha', 'Amherst', 'Northcross'];
    expect(sortSuburbs(input)).toEqual(['Northcross', 'Oteha', 'Amherst', 'Zanzibar']);
  });

  it('handles a list of only unknown suburbs in alphabetical order', () => {
    const input = ['Wellington', 'Queenstown', 'Hamilton'];
    expect(sortSuburbs(input)).toEqual(['Hamilton', 'Queenstown', 'Wellington']);
  });

  it('handles a list of only known suburbs in correct priority order', () => {
    const input = ['Birkenhead', 'Waiake', 'Fairview Heights'];
    expect(sortSuburbs(input)).toEqual(['Fairview Heights', 'Waiake', 'Birkenhead']);
  });

  it('returns an empty array for empty input', () => {
    expect(sortSuburbs([])).toEqual([]);
  });

  it('does not mutate the original array', () => {
    const input = ['Torbay', 'Oteha'];
    const copy = [...input];
    sortSuburbs(input);
    expect(input).toEqual(copy);
  });

  it('handles duplicates without throwing', () => {
    const input = ['Oteha', 'Oteha', 'Torbay'];
    const result = sortSuburbs(input);
    expect(result[0]).toBe('Oteha');
    expect(result[1]).toBe('Oteha');
    expect(result[2]).toBe('Torbay');
  });

  it('places the full fallback list in priority order', () => {
    const fallback = ['Oteha', 'Northcross', 'Albany', 'Browns Bay', 'Torbay'];
    expect(sortSuburbs(fallback)).toEqual(['Northcross', 'Oteha', 'Torbay', 'Browns Bay', 'Albany']);
  });

  it('SUBURB_PRIORITY_ORDER starts with Northcross', () => {
    expect(SUBURB_PRIORITY_ORDER[0]).toBe('Northcross');
  });

  it('SUBURB_PRIORITY_ORDER contains 39 entries with no duplicates', () => {
    expect(SUBURB_PRIORITY_ORDER.length).toBe(39);
    expect(new Set(SUBURB_PRIORITY_ORDER).size).toBe(39);
  });

  it('places Narrow Neck between Bayswater and Devonport', () => {
    expect(SUBURB_PRIORITY_ORDER.indexOf('Narrow Neck')).toBe(SUBURB_PRIORITY_ORDER.indexOf('Bayswater') + 1);
    expect(SUBURB_PRIORITY_ORDER.indexOf('Devonport')).toBe(SUBURB_PRIORITY_ORDER.indexOf('Narrow Neck') + 1);
  });

  it('places Long Bay immediately after Browns Bay', () => {
    expect(SUBURB_PRIORITY_ORDER.indexOf('Long Bay')).toBe(SUBURB_PRIORITY_ORDER.indexOf('Browns Bay') + 1);
    expect(sortSuburbs(['Albany', 'Long Bay', 'Browns Bay', 'Pinehill'])).toEqual(['Browns Bay', 'Long Bay', 'Pinehill', 'Albany']);
  });
});

import { describe, it, expect } from 'vitest';
import {
  extractStreetFromLikedItem,
  aggregateLikedStreets,
  filterLikedItemsByStreet,
  type LikedItem,
} from '../../lib/liked-street-filter';

describe('extractStreetFromLikedItem', () => {
  it('returns the street field when present and non-empty', () => {
    const item: LikedItem = { street: 'Glamorgan Drive', property_address: '5 Glamorgan Drive' };
    expect(extractStreetFromLikedItem(item)).toBe('Glamorgan Drive');
  });

  it('trims whitespace from the street field', () => {
    const item: LikedItem = { street: '  Torbay Road  ', property_address: '10 Torbay Road' };
    expect(extractStreetFromLikedItem(item)).toBe('Torbay Road');
  });

  it('falls back to property_address when street is null', () => {
    const item: LikedItem = { street: null, property_address: '12 Deep Creek Road' };
    expect(extractStreetFromLikedItem(item)).toBe('Deep Creek Road');
  });

  it('falls back to property_address when street is undefined', () => {
    const item: LikedItem = { property_address: '3 Waimarie Drive' };
    expect(extractStreetFromLikedItem(item)).toBe('Waimarie Drive');
  });

  it('falls back to property_address when street is empty string', () => {
    const item: LikedItem = { street: '', property_address: '7 Oteha Valley Road' };
    expect(extractStreetFromLikedItem(item)).toBe('Oteha Valley Road');
  });

  it('strips unit prefix before falling back (e.g. 2/45 Smith Street)', () => {
    const item: LikedItem = { street: null, property_address: '2/45 Smith Street' };
    expect(extractStreetFromLikedItem(item)).toBe('Smith Street');
  });

  it('strips plain house number before falling back', () => {
    const item: LikedItem = { street: null, property_address: '100 Showgrounds Road' };
    expect(extractStreetFromLikedItem(item)).toBe('Showgrounds Road');
  });

  it('strips house number with letter suffix (e.g. 12A King Street)', () => {
    const item: LikedItem = { street: null, property_address: '12A King Street' };
    expect(extractStreetFromLikedItem(item)).toBe('King Street');
  });

  it('returns Unknown Street when address has no street name part', () => {
    const item: LikedItem = { street: null, property_address: '' };
    expect(extractStreetFromLikedItem(item)).toBe('Unknown Street');
  });
});

describe('aggregateLikedStreets', () => {
  const items: LikedItem[] = [
    { street: 'Glamorgan Drive', property_address: '5 Glamorgan Drive' },
    { street: 'Glamorgan Drive', property_address: '7 Glamorgan Drive' },
    { street: 'Glamorgan Drive', property_address: '9 Glamorgan Drive' },
    { street: 'Torbay Road', property_address: '10 Torbay Road' },
    { street: 'Torbay Road', property_address: '12 Torbay Road' },
    { street: 'Deep Creek Road', property_address: '3 Deep Creek Road' },
    { street: null, property_address: '22 Waimarie Drive' },
  ];

  it('returns an empty array for an empty list', () => {
    expect(aggregateLikedStreets([])).toEqual([]);
  });

  it('counts addresses per street correctly', () => {
    const result = aggregateLikedStreets(items);
    const glamorgan = result.find(s => s.street === 'Glamorgan Drive');
    const torbay = result.find(s => s.street === 'Torbay Road');
    const deep = result.find(s => s.street === 'Deep Creek Road');
    const waimarie = result.find(s => s.street === 'Waimarie Drive');

    expect(glamorgan?.count).toBe(3);
    expect(torbay?.count).toBe(2);
    expect(deep?.count).toBe(1);
    expect(waimarie?.count).toBe(1);
  });

  it('returns streets sorted alphabetically', () => {
    const result = aggregateLikedStreets(items);
    const names = result.map(s => s.street);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })));
  });

  it('excludes Unknown Street entries', () => {
    const withUnknown: LikedItem[] = [
      { street: null, property_address: '' },
      { street: 'Alpha Road', property_address: '1 Alpha Road' },
    ];
    const result = aggregateLikedStreets(withUnknown);
    expect(result.every(s => s.street !== 'Unknown Street')).toBe(true);
    expect(result).toHaveLength(1);
    expect(result[0].street).toBe('Alpha Road');
  });

  it('falls back to property_address for items with null street', () => {
    const result = aggregateLikedStreets(items);
    const waimarie = result.find(s => s.street === 'Waimarie Drive');
    expect(waimarie).toBeDefined();
    expect(waimarie?.count).toBe(1);
  });

  it('filters by search term (case-insensitive)', () => {
    const result = aggregateLikedStreets(items, 'torbay');
    expect(result).toHaveLength(1);
    expect(result[0].street).toBe('Torbay Road');
  });

  it('returns empty array when search term matches nothing', () => {
    const result = aggregateLikedStreets(items, 'zzznomatch');
    expect(result).toHaveLength(0);
  });

  it('search with whitespace-only string returns all streets', () => {
    const result = aggregateLikedStreets(items, '   ');
    expect(result.length).toBeGreaterThan(0);
    expect(result).toEqual(aggregateLikedStreets(items));
  });

  it('partial search matches multiple streets', () => {
    const result = aggregateLikedStreets(items, 'road');
    const names = result.map(s => s.street);
    expect(names).toContain('Torbay Road');
    expect(names).toContain('Deep Creek Road');
    expect(names).not.toContain('Glamorgan Drive');
  });
});

describe('filterLikedItemsByStreet', () => {
  const items: LikedItem[] = [
    { street: 'Glamorgan Drive', property_address: '5 Glamorgan Drive' },
    { street: 'Glamorgan Drive', property_address: '7 Glamorgan Drive' },
    { street: 'Torbay Road', property_address: '10 Torbay Road' },
    { street: null, property_address: '22 Waimarie Drive' },
  ];

  it('returns only items matching the selected street', () => {
    const result = filterLikedItemsByStreet(items, 'Glamorgan Drive');
    expect(result).toHaveLength(2);
    expect(result.every(i => i.street === 'Glamorgan Drive')).toBe(true);
  });

  it('returns empty array when no items match', () => {
    const result = filterLikedItemsByStreet(items, 'Nonexistent Street');
    expect(result).toHaveLength(0);
  });

  it('matches items using the fallback address extraction', () => {
    const result = filterLikedItemsByStreet(items, 'Waimarie Drive');
    expect(result).toHaveLength(1);
    expect(result[0].property_address).toBe('22 Waimarie Drive');
  });

  it('returns empty array for empty input', () => {
    expect(filterLikedItemsByStreet([], 'Glamorgan Drive')).toHaveLength(0);
  });

  it('does not mutate the original array', () => {
    const original = [...items];
    filterLikedItemsByStreet(items, 'Glamorgan Drive');
    expect(items).toEqual(original);
  });
});

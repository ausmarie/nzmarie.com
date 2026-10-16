import { describe, it, expect } from 'vitest';
import { parseHouseNumber, orderStreetsGreedily, extractStreetNameFromAddress, OrderableStreet } from '../../lib/street-ordering';

function street(name: string, house: number | null, lat: number, lng: number): OrderableStreet {
  return {
    street: name,
    minHouseNumber: house,
    anchorLat: house == null ? null : lat,
    anchorLng: house == null ? null : lng,
  };
}

describe('parseHouseNumber', () => {
  it('parses plain house numbers', () => {
    expect(parseHouseNumber('12 Kowhai Street')).toBe(12);
    expect(parseHouseNumber('12A Kowhai Street')).toBe(12);
    expect(parseHouseNumber('123-129 Main Rd')).toBe(123);
  });

  it('treats unit addresses by their actual street number', () => {
    expect(parseHouseNumber('2/45 Smith Street')).toBe(45);
  });

  it('returns null for addresses without a leading number', () => {
    expect(parseHouseNumber('Flat 3/5 X Street')).toBeNull();
    expect(parseHouseNumber('')).toBeNull();
  });
});

describe('extractStreetNameFromAddress', () => {
  it('strips plain house numbers and units', () => {
    expect(extractStreetNameFromAddress('100 Showgrounds Road')).toBe('Showgrounds Road');
    expect(extractStreetNameFromAddress('12A King Street')).toBe('King Street');
  });

  it('handles unit ranges and multiple house-number tokens', () => {
    expect(extractStreetNameFromAddress('2a/1 Rock Road')).toBe('Rock Road');
    expect(extractStreetNameFromAddress('1/3-5 Rock Isle Road')).toBe('Rock Isle Road');
    expect(extractStreetNameFromAddress('1/10 12 Moa Street')).toBe('Moa Street');
    expect(extractStreetNameFromAddress('1/1 5 Gleanor Avenue')).toBe('Gleanor Avenue');
    expect(extractStreetNameFromAddress('1 10A Baird Street')).toBe('Baird Street');
  });

  it('returns Unknown Street for unit-only numbers, not a street', () => {
    expect(extractStreetNameFromAddress('1/22a')).toBe('Unknown Street');
    expect(extractStreetNameFromAddress('3/2a')).toBe('Unknown Street');
    expect(extractStreetNameFromAddress('5/2a')).toBe('Unknown Street');
    expect(extractStreetNameFromAddress('1/1')).toBe('Unknown Street');
    expect(extractStreetNameFromAddress('2/10 12')).toBe('Unknown Street');
  });

  it('returns the address when there is no leading house number', () => {
    expect(extractStreetNameFromAddress('Marine Parade')).toBe('Marine Parade');
  });
});

describe('orderStreetsGreedily', () => {
  it('returns empty for no streets', () => {
    expect(orderStreetsGreedily([])).toEqual([]);
  });

  it('starts at the globally smallest house number street', () => {
    const result = orderStreetsGreedily([
      street('Gamma', 5, -36.7, 174.74),
      street('Alpha', 1, -36.6958, 174.7453),
      street('Beta', 2, -36.6959, 174.7454),
    ]);
    expect(result[0]).toBe('Alpha');
  });

  it('walks nearest streets in order and appends no-anchor streets last', () => {
    const result = orderStreetsGreedily([
      street('Zulu Road', 9, -36.71, 174.74),
      street('Alpha', 1, -36.6958, 174.7453),
      street('Beta', 2, -36.6959, 174.7454),
      street('NoCoord', null, 0, 0),
    ]);
    // Alpha starts (smallest house number), then Beta is nearest, then Zulu,
    // then the no-coordinate street appended at the end.
    expect(result).toEqual(['Alpha', 'Beta', 'Zulu Road', 'NoCoord']);
  });

  it('ties house numbers by alphabetical street name', () => {
    const result = orderStreetsGreedily([
      street('Beta', 1, -36.6962, 174.7456),
      street('Alpha', 1, -36.6958, 174.7453),
    ]);
    expect(result).toEqual(['Alpha', 'Beta']);
  });

  it('starts from the requested street when startStreet is provided', () => {
    const result = orderStreetsGreedily(
      [
        street('Gamma', 5, -36.7, 174.74),
        street('Alpha', 1, -36.6958, 174.7453),
        street('Beta', 2, -36.6959, 174.7454),
      ],
      'Beta'
    );
    expect(result[0]).toBe('Beta');
    // Alpha (nearest to Beta) comes next, then Gamma.
    expect(result).toEqual(['Beta', 'Alpha', 'Gamma']);
  });

  it('falls back to the smallest house number street when startStreet is unknown', () => {
    const result = orderStreetsGreedily(
      [
        street('Gamma', 5, -36.7, 174.74),
        street('Alpha', 1, -36.6958, 174.7453),
        street('Beta', 2, -36.6959, 174.7454),
      ],
      'Does Not Exist'
    );
    expect(result[0]).toBe('Alpha');
  });

  it('ignores startStreet when it has no anchor coordinates', () => {
    const result = orderStreetsGreedily(
      [
        street('Alpha', 1, -36.6958, 174.7453),
        street('Beta', 2, -36.6959, 174.7454),
        street('NoCoord', null, 0, 0),
      ],
      'NoCoord'
    );
    // NoCoord has no anchor so the default start (Alpha) is used; NoCoord appended last.
    expect(result).toEqual(['Alpha', 'Beta', 'NoCoord']);
  });

  it('appends all streets alphabetically when none have anchors', () => {
    const result = orderStreetsGreedily([
      street('Beta', null, 0, 0),
      street('Alpha', null, 0, 0),
    ]);
    expect(result).toEqual(['Alpha', 'Beta']);
  });
});

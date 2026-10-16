import { haversineMeters } from './street-clustering';

export interface OrderableStreet {
  street: string;
  minHouseNumber: number | null;
  anchorLat: number | null;
  anchorLng: number | null;
}

export function parseHouseNumber(address: string | null | undefined): number | null {
  const clean = (address ?? '').trim();
  const unit = clean.match(/^(\d+)\/(\d+)/);
  if (unit) return parseInt(unit[2], 10);
  const num = clean.match(/^(\d+)/);
  return num ? parseInt(num[1], 10) : null;
}

export function extractStreetNameFromAddress(address: string): string {
  let s = (address || '').trim();

  // Remove trailing bare numbers that are clearly rubbish (e.g. stray coordinates).
  s = s.replace(/\s+[0-9]+$/, '');

  // Strip a leading unit + house-number prefix, e.g. "1/12A ", "1/3-5 ", "12B ".
  s = s.replace(/^[0-9]+[A-Za-z]?(?:[-/][0-9]+[A-Za-z]?)*\s+/, '');

  // Some addresses put the real house number one token in ("1 10A Baird Street"),
  // so drop a leading numeric token that still remains.
  s = s.replace(/^[0-9]+[0-9A-Za-z]*\s*/, '').trim();

  // A real street name is alphabetic text. Numbers-only or unit-only strings like
  // "5/2a", "1/1", "12" are house numbers, not streets.
  if (!/[A-Za-z]{2}/.test(s)) {
    return 'Unknown Street';
  }
  // Street names never contain a unit separator like "2/10 12".
  // A street never contains a unit separator like "2/5 12".
  if (/\d+\/\d+/.test(s)) {
    return 'Unknown Street';
  }

  return s.trim() || 'Unknown Street';
}

export function extractStreetPrefixSql(): string {
  return `(^[0-9]+[A-Za-z]?([-/][0-9]+[A-Za-z]?)*[[:space:]]+|^[0-9]+[0-9A-Za-z]*[[:space:]])`;
}

export function orderStreetsGreedily(streets: OrderableStreet[], startStreet?: string): string[] {
  const anchored = streets.filter((s) => s.anchorLat != null && s.anchorLng != null);
  const noAnchor = streets
    .filter((s) => s.anchorLat == null || s.anchorLng == null)
    .sort((a, b) => a.street.localeCompare(b.street, undefined, { sensitivity: 'base' }));

  if (anchored.length === 0) {
    return noAnchor.map((s) => s.street);
  }

  const requested = startStreet
    ? anchored.find((s) => s.street === startStreet)
    : undefined;

  let current = requested ?? anchored.reduce((best, s) => {
    const bh = best.minHouseNumber ?? Infinity;
    const sh = s.minHouseNumber ?? Infinity;
    if (sh < bh) return s;
    if (sh === bh) {
      return s.street.localeCompare(best.street, undefined, { sensitivity: 'base' }) < 0 ? s : best;
    }
    return best;
  });

  const ordered = [current];
  const remaining = anchored.filter((s) => s !== current);

  while (remaining.length > 0) {
    let next = remaining[0];
    let best = Infinity;
    for (const candidate of remaining) {
      const d = haversineMeters(
        current.anchorLat!,
        current.anchorLng!,
        candidate.anchorLat!,
        candidate.anchorLng!
      );
      if (d < best) {
        best = d;
        next = candidate;
      }
    }
    ordered.push(next);
    remaining.splice(remaining.indexOf(next), 1);
    current = next;
  }

  return [...ordered.map((s) => s.street), ...noAnchor.map((s) => s.street)];
}

export interface LikedItem {
  street?: string | null;
  property_address: string;
}

export interface StreetCount {
  street: string;
  count: number;
}

export function extractStreetFromLikedItem(item: LikedItem): string {
  if (item.street?.trim()) return item.street.trim();
  let s = item.property_address.replace(/^-?\d+\//, '');
  s = s.replace(/^-?\d+[A-Za-z]?\s*/, '');
  return s.trim() || 'Unknown Street';
}

export function aggregateLikedStreets(
  items: LikedItem[],
  search?: string,
): StreetCount[] {
  const streetMap = new Map<string, number>();
  for (const item of items) {
    const streetVal = extractStreetFromLikedItem(item);
    if (streetVal && streetVal !== 'Unknown Street') {
      streetMap.set(streetVal, (streetMap.get(streetVal) ?? 0) + 1);
    }
  }

  const all: StreetCount[] = [...streetMap.entries()]
    .map(([street, count]) => ({ street, count }))
    .sort((a, b) => a.street.localeCompare(b.street, undefined, { sensitivity: 'base' }));

  if (search?.trim()) {
    const q = search.trim().toLowerCase();
    return all.filter(s => s.street.toLowerCase().includes(q));
  }
  return all;
}

export function filterLikedItemsByStreet<T extends LikedItem>(
  items: T[],
  selectedStreet: string,
): T[] {
  return items.filter(item => extractStreetFromLikedItem(item) === selectedStreet);
}

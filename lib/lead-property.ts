import { marieDB } from '@/lib/db';

function toUuid(id: string): string | null {
  const hex = id.trim();
  if (/^[0-9a-fA-F]{32}$/.test(hex)) {
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  return null;
}

export function normalizePropertyStreetAddress(address: string | null | undefined): string {
  return address?.split(',')[0].trim().replace(/\s+/g, ' ') ?? '';
}

export async function matchPropertyIdByAddress(
  address: string | null | undefined,
  suburb: string | null | undefined
): Promise<string | null> {
  if (!address?.trim()) return null;
  const street = normalizePropertyStreetAddress(address);
  if (!street) return null;

  try {
    const sub = suburb?.trim();
    if (sub) {
      const bySuburb = await marieDB.query(
        `SELECT id FROM properties
         WHERE LOWER(REGEXP_REPLACE(TRIM(SPLIT_PART(address, ',', 1)), '[[:space:]]+', ' ', 'g')) = LOWER($1)
           AND LOWER(REGEXP_REPLACE(TRIM(suburb), '[[:space:]]+', ' ', 'g')) = LOWER($2)
         LIMIT 1`,
        [street, sub]
      );
      if (bySuburb.rows.length > 0) return toUuid(String(bySuburb.rows[0].id));
    }

    const streetOnly = await marieDB.query(
      `SELECT id FROM properties
       WHERE LOWER(REGEXP_REPLACE(TRIM(SPLIT_PART(address, ',', 1)), '[[:space:]]+', ' ', 'g')) = LOWER($1)`,
      [street]
    );
    if (streetOnly.rows.length === 1) {
      return toUuid(String(streetOnly.rows[0].id));
    }
    return null;
  } catch (err) {
    console.error('Failed to match property for lead:', err);
    return null;
  }
}

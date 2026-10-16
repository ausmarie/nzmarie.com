/**
 * Address Parser Utility
 *
 * Extracts suburb information from full New Zealand addresses.
 * NOTE: For three-tier location data (Region > City > Suburb), use lib/geo-data.ts
 * This file is kept for backward compatibility with existing code.
 */

import { getAllSuburbs, findLocationBySuburb } from './geo-data';

/**
 * All known NZ suburbs (derived from geo-data for single source of truth).
 * Kept as a const array for backward compatibility with SuburbFilter and downloads API.
 */
export const NZ_SUBURBS = getAllSuburbs() as string[];

export type Suburb = string;

/**
 * Extract suburb from full address string.
 *
 * Examples:
 * - "12 Queen Street, Albany, Auckland" → "Albany"
 * - "5 Beach Road, Takapuna" → "Takapuna"
 * - "Unit 3, 45 Main St, Browns Bay, Auckland 0630" → "Browns Bay"
 */
export function extractSuburb(fullAddress: string): string | null {
  if (!fullAddress || typeof fullAddress !== 'string') {
    return null;
  }

  const normalized = fullAddress.trim();

  // Check each address part against all known suburbs
  for (const suburb of NZ_SUBURBS) {
    const regex = new RegExp(`\\b${suburb.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (regex.test(normalized)) {
      return suburb;
    }
  }

  // Fallback: try second-to-last comma-separated part
  const parts = normalized.split(',').map(s => s.trim());
  if (parts.length >= 2) {
    const potentialSuburb = parts[parts.length - 2];
    const match = NZ_SUBURBS.find(
      s => s.toLowerCase() === potentialSuburb.toLowerCase()
    );
    if (match) return match;
  }

  return null;
}

/**
 * Extract full location (region, city, suburb) from an address string.
 * Returns null if no known suburb is found.
 */
export function extractLocation(fullAddress: string): {
  region: string;
  city: string;
  suburb: string;
} | null {
  const suburb = extractSuburb(fullAddress);
  if (!suburb) return null;
  return findLocationBySuburb(suburb);
}

/**
 * Check if a string is a valid suburb
 */
export function isValidSuburb(value: unknown): value is string {
  return typeof value === 'string' && NZ_SUBURBS.includes(value);
}

/**
 * Get suburb options for dropdown (all suburbs, flat list)
 */
export function getSuburbOptions(): { value: string; label: string }[] {
  return NZ_SUBURBS.map(suburb => ({ value: suburb, label: suburb }));
}

/**
 * Validate and normalize suburb input
 */
export function normalizeSuburb(input: string): string | null {
  if (!input || typeof input !== 'string') return null;
  const normalized = input.trim();
  return NZ_SUBURBS.find(s => s.toLowerCase() === normalized.toLowerCase()) ?? null;
}

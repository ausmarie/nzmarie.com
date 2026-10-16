import type { StreetSummary } from './outreach-streets';

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour — L1 in-process cache, backed by 30-day Upstash L2

interface SuburbCache {
  summaries: StreetSummary[];
  alphaFirst: string;
  expireAt: number;
}

const cache = new Map<string, SuburbCache>();

export function getFromCache(suburb: string): { summaries: StreetSummary[]; alphaFirst: string } | null {
  const entry = cache.get(suburb.toLowerCase());
  if (entry && Date.now() < entry.expireAt) {
    return { summaries: entry.summaries, alphaFirst: entry.alphaFirst };
  }
  return null;
}

export function setInCache(suburb: string, summaries: StreetSummary[], alphaFirst: string): void {
  cache.set(suburb.toLowerCase(), { summaries, alphaFirst, expireAt: Date.now() + CACHE_TTL_MS });
}

export function deleteFromCache(suburb: string): void {
  cache.delete(suburb.toLowerCase());
}

export function clearCache(): void {
  cache.clear();
}

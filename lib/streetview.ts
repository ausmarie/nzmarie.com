import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';
import { uploadToR2, isR2Mock } from '@/lib/r2-storage';
import { getStreetViewCachedUrl, setStreetViewCachedUrl, getStreetViewFail, setStreetViewFail, acquireStreetViewLock, releaseStreetViewLock } from '@/lib/redis';

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || 'a128bb5285b94a778d4b098fbd8266f1';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || 'mock-r2-access-key-id';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || 'mock-r2-secret-access-key';
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'nzmarie-reports';
const R2_ENDPOINT = process.env.R2_ENDPOINT || `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
const R2_PUBLIC_DOMAIN = process.env.R2_PUBLIC_DOMAIN || 'https://reports.nzmarie.com';
function getGoogleKey(): string {
  return process.env.GOOGLE_MAPS_SERVER_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
}

const s3Client = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

export function isR2StreetViewUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.startsWith(R2_PUBLIC_DOMAIN) && url.includes('/streetview/');
}

export function isGoogleStreetViewUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.includes('maps.googleapis.com/maps/api/streetview');
}

export function isPlaceholderUrl(url: string | null | undefined): boolean {
  if (!url) return true;
  return url.includes('no-photo-available') || url.includes('via.placeholder.com') || url.includes('No+Image');
}

export function streetViewR2Key(propertyId: string): string {
  return `streetview/${propertyId}.jpg`;
}

export function streetViewR2Url(propertyId: string): string {
  return `${R2_PUBLIC_DOMAIN}/${streetViewR2Key(propertyId)}`;
}

async function headR2Exists(key: string): Promise<boolean> {
  if (isR2Mock) return false;
  try {
    await s3Client.send(new HeadObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function fetchGoogleStreetView(lat: number, lng: number): Promise<Buffer | null> {
  const key = getGoogleKey();
  if (!key) return null;
  const url = `https://maps.googleapis.com/maps/api/streetview?size=640x480&location=${lat},${lng}&key=${key}&return_error_code=true`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('image')) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 5000) return null;
    return buf;
  } catch {
    return null;
  }
}

async function hasStreetViewPanorama(lat: number, lng: number): Promise<boolean> {
  const key = getGoogleKey();
  if (!key) return false;
  const url = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${lat},${lng}&key=${key}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return false;
    const data = (await res.json()) as { status?: string };
    return data.status === 'OK';
  } catch {
    return false;
  }
}

async function geocodeAddress(address: string, suburb?: string | null, city?: string | null): Promise<{ lat: number; lng: number } | null> {
  const key = getGoogleKey();
  if (!key || !address) return null;
  const q = [address, suburb, city, 'New Zealand'].filter(Boolean).join(', ');
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}&key=${key}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as { status?: string; results?: Array<{ geometry?: { location?: { lat?: number; lng?: number } } }> };
    if (data.status !== 'OK' || !data.results?.[0]?.geometry?.location) return null;
    const loc = data.results[0].geometry.location;
    if (typeof loc.lat !== 'number' || typeof loc.lng !== 'number') return null;
    return { lat: loc.lat, lng: loc.lng };
  } catch {
    return null;
  }
}

export async function getCachedR2Url(propertyId: string): Promise<string | null> {
  if (!propertyId) return null;
  const cached = await getStreetViewCachedUrl(propertyId);
  if (cached) return cached;
  const key = streetViewR2Key(propertyId);
  if (await headR2Exists(key)) {
    const url = streetViewR2Url(propertyId);
    await setStreetViewCachedUrl(propertyId, url);
    return url;
  }
  return null;
}

export async function getOrCreateStreetViewUrl(
  propertyId: string,
  latitude: number | null,
  longitude: number | null,
  currentImageUrl: string | null | undefined,
  fallbackAddress?: string | null,
  fallbackSuburb?: string | null,
  fallbackCity?: string | null
): Promise<string | null> {
  if (!propertyId) return currentImageUrl || null;
  if (isR2StreetViewUrl(currentImageUrl || '')) return currentImageUrl || null;
  if (isPlaceholderUrl(currentImageUrl || '')) return currentImageUrl || null;
  const cached = await getStreetViewCachedUrl(propertyId);
  if (cached) return cached;
  if (await getStreetViewFail(propertyId)) return currentImageUrl || null;
  let lat = latitude;
  let lng = longitude;
  if (lat == null || lng == null) {
    if (!fallbackAddress) return currentImageUrl || null;
    const geo = await geocodeAddress(fallbackAddress, fallbackSuburb, fallbackCity);
    if (!geo) return currentImageUrl || null;
    lat = geo.lat;
    lng = geo.lng;
  }
  const key = streetViewR2Key(propertyId);
  const r2Url = streetViewR2Url(propertyId);
  if (await headR2Exists(key)) {
    await setStreetViewCachedUrl(propertyId, r2Url);
    return r2Url;
  }
  const locked = await acquireStreetViewLock(propertyId);
  if (!locked) return currentImageUrl || null;
  try {
    if (await headR2Exists(key)) {
      await setStreetViewCachedUrl(propertyId, r2Url);
      return r2Url;
    }
    const has = await hasStreetViewPanorama(lat!, lng!);
    if (!has) {
      await setStreetViewFail(propertyId);
      return currentImageUrl || null;
    }
    const buf = await fetchGoogleStreetView(lat!, lng!);
    if (!buf) return currentImageUrl || null;
    try {
      await uploadToR2(key, buf, 'image/jpeg', 'public, max-age=31536000, immutable');
    } catch {
      return currentImageUrl || null;
    }
    await setStreetViewCachedUrl(propertyId, r2Url);
    try {
      const { query } = await import('@/lib/db');
      query(`UPDATE properties SET cover_image_url=$1 WHERE id=$2`, [r2Url, propertyId]).catch(() => {});
    } catch {}
    return r2Url;
  } finally {
    await releaseStreetViewLock(propertyId);
  }
}

export async function batchResolveStreetViews<T extends { id: string; latitude: number | null; longitude: number | null; image_url?: string | null; cover_image_url?: string | null; address?: string | null; suburb?: string | null; city?: string | null }>(
  rows: T[]
): Promise<T[]> {
  const limit = 5;
  const results: T[] = [];
  for (let i = 0; i < rows.length; i += limit) {
    const chunk = rows.slice(i, i + limit);
    const resolved = await Promise.all(
      chunk.map(async (row) => {
        const current = (row as unknown as { image_url?: string | null }).image_url ?? (row as unknown as { cover_image_url?: string | null }).cover_image_url ?? null;
        if (isR2StreetViewUrl(current || '') || isPlaceholderUrl(current || '')) return row;
        const next = await getOrCreateStreetViewUrl(row.id, row.latitude, row.longitude, current, (row as unknown as { address?: string | null }).address ?? null, (row as unknown as { suburb?: string | null }).suburb ?? null, (row as unknown as { city?: string | null }).city ?? null);
        if (next && next !== current) {
          if ('image_url' in row) (row as unknown as { image_url: string | null }).image_url = next;
          if ('cover_image_url' in row) (row as unknown as { cover_image_url: string | null }).cover_image_url = next;
        }
        return row;
      })
    );
    results.push(...resolved);
  }
  return results;
}

export async function batchGetCachedR2Urls(
  propertyIds: string[]
): Promise<Map<string, string>> {
  const filtered = propertyIds.filter(Boolean);
  if (filtered.length === 0) return new Map();
  const map = new Map<string, string>();
  await Promise.all(
    filtered.map(async (id) => {
      const url = await getCachedR2Url(id);
      if (url) map.set(id, url);
    })
  );
  return map;
}

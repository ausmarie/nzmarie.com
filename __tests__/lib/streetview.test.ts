import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isR2StreetViewUrl,
  isGoogleStreetViewUrl,
  isPlaceholderUrl,
  streetViewR2Key,
  streetViewR2Url,
  getOrCreateStreetViewUrl,
  getCachedR2Url,
  batchResolveStreetViews,
  batchGetCachedR2Urls,
} from '@/lib/streetview';

vi.mock('@/lib/r2-storage', async () => {
  const actual = await vi.importActual<typeof import('@/lib/r2-storage')>('@/lib/r2-storage');
  return {
    ...actual,
    isR2Mock: true,
    uploadToR2: vi.fn().mockResolvedValue('streetview/test.jpg'),
  };
});

describe('isR2StreetViewUrl', () => {
  it('detects R2 streetview url', () => {
    expect(isR2StreetViewUrl('https://reports.nzmarie.com/streetview/abc.jpg')).toBe(true);
  });
  it('rejects google url', () => {
    expect(isR2StreetViewUrl('https://maps.googleapis.com/maps/api/streetview?location=1,1')).toBe(false);
  });
  it('rejects null', () => {
    expect(isR2StreetViewUrl(null)).toBe(false);
  });
});

describe('isGoogleStreetViewUrl', () => {
  it('detects google streetview', () => {
    expect(isGoogleStreetViewUrl('https://maps.googleapis.com/maps/api/streetview?size=640x480')).toBe(true);
  });
  it('rejects R2', () => {
    expect(isGoogleStreetViewUrl('https://reports.nzmarie.com/streetview/a.jpg')).toBe(false);
  });
});

describe('isPlaceholderUrl', () => {
  it('detects placeholder', () => {
    expect(isPlaceholderUrl('https://via.placeholder.com/400x300')).toBe(true);
    expect(isPlaceholderUrl('/static/media/no-photo-available.png')).toBe(true);
    expect(isPlaceholderUrl(null)).toBe(true);
  });
  it('rejects real url', () => {
    expect(isPlaceholderUrl('https://reports.nzmarie.com/streetview/a.jpg')).toBe(false);
  });
});

describe('streetViewR2Key', () => {
  it('builds key', () => {
    expect(streetViewR2Key('abc-123')).toBe('streetview/abc-123.jpg');
  });
  it('builds url', () => {
    expect(streetViewR2Url('abc-123')).toBe('https://reports.nzmarie.com/streetview/abc-123.jpg');
  });
});

describe('getOrCreateStreetViewUrl', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  it('returns R2 url directly if already R2', async () => {
    const url = 'https://reports.nzmarie.com/streetview/abc.jpg';
    expect(await getOrCreateStreetViewUrl('abc', -36.7, 174.7, url)).toBe(url);
  });
  it('returns placeholder directly', async () => {
    const url = 'https://via.placeholder.com/400x300';
    expect(await getOrCreateStreetViewUrl('abc', -36.7, 174.7, url)).toBe(url);
  });
  it('returns current url when lat/lng missing', async () => {
    const url = 'https://maps.googleapis.com/maps/api/streetview?location=1,1';
    expect(await getOrCreateStreetViewUrl('abc', null, null, url)).toBe(url);
  });
  it('returns current when isR2Mock and no R2 object', async () => {
    const url = 'https://maps.googleapis.com/maps/api/streetview?location=1,1';
    expect(await getOrCreateStreetViewUrl('test-id', -36.7, 174.7, url)).toBe(url);
  });
});

describe('getCachedR2Url', () => {
  it('returns null when isR2Mock', async () => {
    expect(await getCachedR2Url('any-id')).toBe(null);
  });
  it('returns null for empty id', async () => {
    expect(await getCachedR2Url('')).toBe(null);
  });
});

describe('batchResolveStreetViews', () => {
  it('resolves batch without error', async () => {
    const rows = [
      { id: '1', latitude: -36.7, longitude: 174.7, image_url: 'https://maps.googleapis.com/maps/api/streetview?location=1,1' },
      { id: '2', latitude: null, longitude: null, image_url: 'https://via.placeholder.com/400' },
    ];
    const res = await batchResolveStreetViews(rows as never);
    expect(res).toHaveLength(2);
    expect(res[0].id).toBe('1');
  });
});

describe('batchGetCachedR2Urls', () => {
  it('returns empty map when isR2Mock', async () => {
    const map = await batchGetCachedR2Urls(['a', 'b']);
    expect(map.size).toBe(0);
  });
});

describe('shared R2 across 3 pages', () => {
  it('properties, outreach, leads share same R2 key', () => {
    const propertyId = '550e8400-e29b-41d4-a716-446655440000';
    const key = streetViewR2Key(propertyId);
    const url = streetViewR2Url(propertyId);
    expect(key).toBe(`streetview/${propertyId}.jpg`);
    expect(url).toBe(`https://reports.nzmarie.com/streetview/${propertyId}.jpg`);
    expect(isR2StreetViewUrl(url)).toBe(true);
  });
});

describe('optimizations', () => {
  it('batchResolve skips R2 and placeholder without Google call', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch');
    const rows = [
      { id: '1', latitude: -36.7, longitude: 174.7, image_url: 'https://reports.nzmarie.com/streetview/1.jpg' },
      { id: '2', latitude: -36.7, longitude: 174.7, image_url: 'https://via.placeholder.com/400' },
      { id: '3', latitude: -36.7, longitude: 174.7, cover_image_url: 'https://reports.nzmarie.com/streetview/3.jpg' },
    ];
    const res = await batchResolveStreetViews(rows as never);
    expect(res).toHaveLength(3);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('getOrCreate uses geocode fallback when lat/lng missing', async () => {
    const originalKey = process.env.GOOGLE_MAPS_SERVER_KEY;
    process.env.GOOGLE_MAPS_SERVER_KEY = 'test-key';
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'OK', results: [{ geometry: { location: { lat: -36.7, lng: 174.7 } } }] }) } as never)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'OK' }) } as never)
      .mockResolvedValueOnce({ ok: true, headers: { get: () => 'image/jpeg' }, arrayBuffer: async () => new ArrayBuffer(8000) } as never);
    vi.stubGlobal('fetch', fetchMock);
    const url = 'https://example.com/old.jpg';
    const result = await getOrCreateStreetViewUrl('geo-test', null, null, url, '1 Acacia Road', 'Torbay', 'Auckland');
    expect(fetchMock).toHaveBeenCalled();
    expect(result).toBe('https://reports.nzmarie.com/streetview/geo-test.jpg');
    vi.unstubAllGlobals();
    if (originalKey) process.env.GOOGLE_MAPS_SERVER_KEY = originalKey;
    else delete process.env.GOOGLE_MAPS_SERVER_KEY;
  });

  it('batchGetCachedR2Urls handles empty and null', async () => {
    expect((await batchGetCachedR2Urls([])).size).toBe(0);
    expect((await batchGetCachedR2Urls([''])) .size).toBe(0);
  });
});

import { describe, it, expect } from 'vitest';
import {
  RUN_COLORS,
  getRunColor,
  computeBoundsFromCoords,
  boundsCenter,
  haversineMeters,
  statusColor,
  getStreetLabelState,
  getStreetLabelColor,
  createStreetAnchorElement,
  createAddressDotElement,
  createStreetLabelElement,
} from '@/lib/outreach-map';

describe('getRunColor', () => {
  it('maps the first five runs to the palette order', () => {
    expect(getRunColor(1)).toBe(RUN_COLORS[0]);
    expect(getRunColor(2)).toBe(RUN_COLORS[1]);
    expect(getRunColor(3)).toBe(RUN_COLORS[2]);
    expect(getRunColor(4)).toBe(RUN_COLORS[3]);
    expect(getRunColor(5)).toBe(RUN_COLORS[4]);
  });

  it('wraps past the end of the palette', () => {
    expect(getRunColor(6)).toBe(RUN_COLORS[0]);
    expect(getRunColor(11)).toBe(RUN_COLORS[0]);
  });

  it('falls back to the first color for invalid indexes', () => {
    expect(getRunColor(0)).toBe(RUN_COLORS[0]);
    expect(getRunColor(-1)).toBe(RUN_COLORS[0]);
  });
});

describe('computeBoundsFromCoords', () => {
  it('returns null for empty coords', () => {
    expect(computeBoundsFromCoords([])).toBeNull();
    expect(computeBoundsFromCoords(undefined as unknown as { lat: number; lng: number }[])).toBeNull();
    expect(computeBoundsFromCoords(null as unknown as { lat: number; lng: number }[])).toBeNull();
  });

  it('computes min/max lat and lng', () => {
    const bounds = computeBoundsFromCoords([
      { lat: -36.7, lng: 174.7 },
      { lat: -36.8, lng: 174.8 },
      { lat: -36.75, lng: 174.75 },
    ]);
    expect(bounds).toEqual({ minLat: -36.8, maxLat: -36.7, minLng: 174.7, maxLng: 174.8 });
  });

  it('handles a single point', () => {
    const bounds = computeBoundsFromCoords([{ lat: 1, lng: 2 }]);
    expect(bounds).toEqual({ minLat: 1, maxLat: 1, minLng: 2, maxLng: 2 });
  });
});

describe('boundsCenter', () => {
  it('returns the midpoint of the bounds', () => {
    const bounds = { minLat: -36.8, maxLat: -36.7, minLng: 174.7, maxLng: 174.8 };
    expect(boundsCenter(bounds)).toEqual({ lat: -36.75, lng: 174.75 });
  });

  it('returns null when bounds is null', () => {
    expect(boundsCenter(null)).toBeNull();
  });
});

describe('haversineMeters', () => {
  it('returns ~0 for identical points', () => {
    expect(haversineMeters({ lat: -36.7, lng: 174.7 }, { lat: -36.7, lng: 174.7 })).toBeLessThan(1);
  });

  it('returns ~111km per degree of latitude', () => {
    const d = haversineMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
    expect(d).toBeGreaterThan(110000);
    expect(d).toBeLessThan(112000);
  });

  it('is symmetric', () => {
    const a = haversineMeters({ lat: -36.7, lng: 174.7 }, { lat: -36.75, lng: 174.75 });
    const b = haversineMeters({ lat: -36.75, lng: 174.75 }, { lat: -36.7, lng: 174.7 });
    expect(Math.abs(a - b)).toBeLessThan(1);
  });
});

describe('statusColor', () => {
  it('maps unsent to red, sent to purple, junk to yellow', () => {
    expect(statusColor('unsent')).toBe('#dc2626');
    expect(statusColor('sent')).toBe('#7c3aed');
    expect(statusColor('junk')).toBe('#eab308');
  });

  it('falls back to gray for unknown status', () => {
    expect(statusColor('unknown' as 'unsent')).toBe('#6b7280');
  });
});

describe('getStreetLabelState', () => {
  it('returns no-pending for empty coords', () => {
    expect(getStreetLabelState([])).toBe('no-pending');
    expect(getStreetLabelState(undefined)).toBe('no-pending');
  });

  it('returns has-unsent when any address is unsent', () => {
    expect(getStreetLabelState([{ status: 'unsent' }, { status: 'sent' }])).toBe('has-unsent');
    expect(getStreetLabelState([{ status: 'unsent' }])).toBe('has-unsent');
  });

  it('returns all-sent when no address is unsent', () => {
    expect(getStreetLabelState([{ status: 'sent' }, { status: 'junk' }, { status: 'sent' }])).toBe('all-sent');
    expect(getStreetLabelState([{ status: 'junk' }])).toBe('all-sent');
  });
});

describe('getStreetLabelColor', () => {
  it('red for has-unsent, blue for all-sent, gray for no-pending', () => {
    expect(getStreetLabelColor('has-unsent')).toBe('#dc2626');
    expect(getStreetLabelColor('all-sent')).toBe('#2563eb');
    expect(getStreetLabelColor('no-pending')).toBe('#9ca3af');
  });
});

describe('createStreetAnchorElement', () => {
  it('creates a div with the count and run color', () => {
    const el = createStreetAnchorElement(12, '#7c3aed');
    expect(el.className).toBe('outreach-street-anchor');
    expect(el.textContent).toBe('12');
    expect(el.style.width).toBe('16px');
    expect(el.style.height).toBe('16px');
    expect(el.style.backgroundColor).toBe('rgb(124, 58, 237)');
  });

  it('sizes active anchors larger and dimmed anchors smaller', () => {
    expect(createStreetAnchorElement(1, '#000', { active: true }).style.width).toBe('18px');
    expect(createStreetAnchorElement(1, '#000', { dim: true }).style.width).toBe('12px');
    expect(createStreetAnchorElement(1, '#000').style.width).toBe('16px');
  });
});

describe('createAddressDotElement', () => {
  it('renders unsent as a 22px solid red dot', () => {
    const el = createAddressDotElement('unsent');
    expect(el.className).toBe('outreach-address-dot');
    expect(el.style.width).toBe('22px');
    expect(el.style.backgroundColor).toBe('rgb(220, 38, 38)');
  });

  it('renders sent as a 16px solid purple dot', () => {
    const el = createAddressDotElement('sent');
    expect(el.style.width).toBe('16px');
    expect(el.style.backgroundColor).toBe('rgb(124, 58, 237)');
  });

  it('renders junk as a 16px solid yellow dot', () => {
    const el = createAddressDotElement('junk');
    expect(el.style.width).toBe('16px');
    expect(el.style.backgroundColor).toBe('rgb(234, 179, 8)');
  });
});

describe('createStreetLabelElement', () => {
  it('shows the street name with the state color', () => {
    const el = createStreetLabelElement('Glamorgan Drive', 'has-unsent');
    expect(el.className).toBe('outreach-street-label');
    expect(el.textContent).toBe('Glamorgan Drive');
    expect(el.style.color).toBe('rgb(220, 38, 38)');
    expect(el.style.fontWeight).toBe('700');
  });

  it('uses normal weight for all-sent', () => {
    const el = createStreetLabelElement('Sentry Way', 'all-sent');
    expect(el.style.color).toBe('rgb(37, 99, 235)');
    expect(el.style.fontWeight).toBe('400');
  });
});
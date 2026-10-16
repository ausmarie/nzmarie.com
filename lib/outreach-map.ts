export const RUN_COLORS = ['#7c3aed', '#0891b2', '#d97706', '#e11d48', '#475569'];

export function getRunColor(runIndex: number): string {
  return RUN_COLORS[(runIndex - 1) % RUN_COLORS.length] ?? RUN_COLORS[0];
}

export function computeBoundsFromCoords(coords: Array<{ lat: number; lng: number }>) {
  if (!coords || coords.length === 0) return null;
  let minLat = Number.POSITIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;
  let minLng = Number.POSITIVE_INFINITY;
  let maxLng = Number.NEGATIVE_INFINITY;
  for (const c of coords) {
    if (c.lat < minLat) minLat = c.lat;
    if (c.lat > maxLat) maxLat = c.lat;
    if (c.lng < minLng) minLng = c.lng;
    if (c.lng > maxLng) maxLng = c.lng;
  }
  return { minLat, maxLat, minLng, maxLng };
}

export function boundsCenter(bounds: ReturnType<typeof computeBoundsFromCoords>) {
  if (!bounds) return null;
  return { lat: (bounds.minLat + bounds.maxLat) / 2, lng: (bounds.minLng + bounds.maxLng) / 2 };
}

export function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

export type AddressStatus = 'unsent' | 'sent' | 'junk';

export type StreetLabelState = 'has-unsent' | 'all-sent' | 'no-pending';

export function statusColor(status: AddressStatus) {
  switch (status) {
    case 'unsent':
      return '#dc2626';
    case 'sent':
      return '#7c3aed';
    case 'junk':
      return '#eab308';
    default:
      return '#6b7280';
  }
}

export function getStreetLabelState(
  addressCoords: Array<{ status: AddressStatus }> = []
): StreetLabelState {
  if (!addressCoords || addressCoords.length === 0) return 'no-pending';
  const hasUnsent = addressCoords.some((c) => c.status === 'unsent');
  return hasUnsent ? 'has-unsent' : 'all-sent';
}

export function getStreetLabelColor(state: StreetLabelState): string {
  switch (state) {
    case 'has-unsent':
      return '#dc2626';
    case 'all-sent':
      return '#2563eb';
    default:
      return '#9ca3af';
  }
}

export function createStreetAnchorElement(pendingCount: number, runColor: string, options?: { active?: boolean; dim?: boolean; selected?: boolean }) {
  const el = document.createElement('div');
  el.className = 'outreach-street-anchor';
  const selected = options?.selected ?? false;
  const size = selected ? 22 : (options?.active ? 18 : (options?.dim ? 12 : 16));
  const opacity = options?.dim && !selected ? '0.45' : '1';
  // Selected: white ring around the marker to make it pop
  const outline = selected ? `outline: 3px solid #ffffff; outline-offset: 2px; box-shadow: 0 0 0 5px ${runColor}55, 0 3px 8px rgba(0,0,0,0.35);` : 'box-shadow:0 2px 6px rgba(0,0,0,0.25);';
  el.style.cssText = `display:flex;align-items:center;justify-content:center;${outline}border-radius:50%;width:${size}px;height:${size}px;background:${runColor};color:#ffffff;font-weight:700;font-size:${selected ? 11 : 10}px;border:2px solid #ffffff;cursor:pointer;opacity:${opacity};transition:all 0.15s;`;
  el.textContent = String(pendingCount);
  return el;
}

export function createAddressDotElement(status: 'unsent' | 'sent' | 'junk') {
  const el = document.createElement('div');
  el.className = 'outreach-address-dot';
  const color = statusColor(status);
  const size = status === 'unsent' ? 22 : 16;
  el.style.cssText = `width:${size}px;height:${size}px;border-radius:50%;background-color:${color};box-shadow:0 3px 8px rgba(0,0,0,0.45);border:3px solid white;`;
  return el;
}

export function createStreetLabelElement(streetName: string, state: StreetLabelState, selected?: boolean) {
  const el = document.createElement('div');
  el.className = 'outreach-street-label';
  const color = selected ? '#1e3a5f' : getStreetLabelColor(state);
  const fw = (selected || state === 'has-unsent') ? 700 : 400;
  const bg = selected ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.95)';
  const shadow = selected
    ? '0 2px 8px rgba(0,0,0,0.22), 0 0 0 2px #3b82f6'
    : '0 1px 4px rgba(0,0,0,0.12)';
  const fontSize = selected ? '13px' : '12px';
  el.style.cssText = `padding:3px 7px;border-radius:4px;background:${bg};color:${color};font-weight:${fw};font-size:${fontSize};box-shadow:${shadow};white-space:nowrap;`;
  el.textContent = streetName;
  return el;
}

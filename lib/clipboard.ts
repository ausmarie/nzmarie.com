/**
 * Clipboard helpers - copy text with modern API and execCommand fallback.
 * Also provides address formatting used by Copy buttons on Properties/Outreach cards.
 */

export function buildFullAddress(parts: Array<string | null | undefined>): string {
  return parts
    .map((p) => (p ?? '').trim())
    .filter((p) => p.length > 0)
    .join(', ');
}

export function buildPropertyAddress(
  address: string | null | undefined,
  suburb?: string | null,
  city?: string | null,
  region?: string | null,
  postcode?: string | null,
): string {
  // Keep ordering: street address, suburb, city, region, postcode
  return buildFullAddress([address ?? '', suburb ?? '', city ?? '', region ?? '', postcode ?? '']);
}

export function buildGoogleMapsUrl(address: string): string {
  return `https://maps.google.com/?q=${encodeURIComponent(address)}`;
}

function isMobileDevice(): boolean {
  return typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function openGoogleMaps(address: string): void {
  if (!address) return;
  const url = buildGoogleMapsUrl(address);
  if (isMobileDevice()) {
    window.location.href = url;
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

export async function copyText(text: string): Promise<boolean> {
  if (!text) return false;
  // Try modern async clipboard API
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to legacy path
  }

  // Fallback: hidden textarea + execCommand
  try {
    if (typeof document === 'undefined') return false;
    const ta = document.createElement('textarea');
    ta.value = text;
    // avoid scrolling to bottom
    ta.style.position = 'fixed';
    ta.style.top = '-9999px';
    ta.style.left = '-9999px';
    ta.setAttribute('readonly', '');
    document.body.appendChild(ta);
    ta.select();
    // For iOS
    ta.setSelectionRange(0, ta.value.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildFullAddress, buildPropertyAddress, copyText, openGoogleMaps, buildGoogleMapsUrl } from '@/lib/clipboard';

describe('buildFullAddress', () => {
  it('joins non-empty parts with comma', () => {
    expect(buildFullAddress(['4 Cairnbrae Court', 'Northcross', 'Auckland', 'Auckland', '0632'])).toBe(
      '4 Cairnbrae Court, Northcross, Auckland, Auckland, 0632',
    );
  });

  it('filters empty, null and whitespace-only parts', () => {
    expect(buildFullAddress(['  ', null, undefined, 'Northcross', '', 'Auckland'])).toBe('Northcross, Auckland');
  });

  it('trims whitespace', () => {
    expect(buildFullAddress(['  4 Cairnbrae Court ', ' Northcross '])).toBe('4 Cairnbrae Court, Northcross');
  });

  it('returns empty string when all parts empty', () => {
    expect(buildFullAddress(['', null, undefined])).toBe('');
  });
});

describe('buildPropertyAddress', () => {
  it('builds full address from property fields', () => {
    expect(buildPropertyAddress('4 Cairnbrae Court', 'Northcross', 'North Shore City', 'Auckland', '0632')).toBe(
      '4 Cairnbrae Court, Northcross, North Shore City, Auckland, 0632',
    );
  });

  it('omits missing optional fields', () => {
    expect(buildPropertyAddress('4 Cairnbrae Court', 'Northcross', null, undefined)).toBe(
      '4 Cairnbrae Court, Northcross',
    );
  });

  it('handles null address gracefully', () => {
    expect(buildPropertyAddress(null, 'Northcross', 'Auckland')).toBe('Northcross, Auckland');
  });
});

describe('copyText', () => {
  const originalClipboard = (global.navigator as unknown as { clipboard?: unknown })?.clipboard;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    // restore clipboard
    if (originalClipboard) {
      Object.defineProperty(global.navigator, 'clipboard', { value: originalClipboard, configurable: true });
    } else {
      delete (global.navigator as unknown as { clipboard?: unknown }).clipboard;
    }
    vi.restoreAllMocks();
  });

  it('returns false for empty string', async () => {
    expect(await copyText('')).toBe(false);
  });

  it('uses navigator.clipboard when available and returns true on success', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(global.navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    const ok = await copyText('4 Cairnbrae Court, Northcross, Auckland');
    expect(writeText).toHaveBeenCalledWith('4 Cairnbrae Court, Northcross, Auckland');
    expect(ok).toBe(true);
  });

  it('falls back to execCommand when clipboard API fails', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    Object.defineProperty(global.navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    const execCommand = vi.fn().mockReturnValue(true);
    (document as unknown as { execCommand: typeof document.execCommand }).execCommand = execCommand as unknown as typeof document.execCommand;

    const ok = await copyText('fallback address');

    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(ok).toBe(true);
  });

  it('returns false when both clipboard and execCommand fail', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    Object.defineProperty(global.navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    (document as unknown as { execCommand: typeof document.execCommand }).execCommand = vi.fn().mockImplementation(() => {
      throw new Error('no exec');
    }) as unknown as typeof document.execCommand;

    const ok = await copyText('fail case');
    expect(ok).toBe(false);
  });

  it('uses execCommand path when navigator.clipboard is absent', async () => {
    delete (global.navigator as unknown as { clipboard?: unknown }).clipboard;
    (document as unknown as { execCommand: typeof document.execCommand }).execCommand = vi.fn().mockReturnValue(true) as unknown as typeof document.execCommand;

    const ok = await copyText('no clipboard address');
    expect(ok).toBe(true);
  });

  it('returns false when execCommand returns false', async () => {
    delete (global.navigator as unknown as { clipboard?: unknown }).clipboard;
    (document as unknown as { execCommand: typeof document.execCommand }).execCommand = vi.fn().mockReturnValue(false) as unknown as typeof document.execCommand;

    const ok = await copyText('exec returns false');
    expect(ok).toBe(false);
  });
});

describe('buildGoogleMapsUrl', () => {
  it('returns encoded Google Maps URL', () => {
    expect(buildGoogleMapsUrl('1A Barker Rise, Northcross')).toBe(
      'https://maps.google.com/?q=1A%20Barker%20Rise%2C%20Northcross',
    );
  });

  it('encodes special characters', () => {
    expect(buildGoogleMapsUrl('1A & B Street')).toContain('%26');
  });

  it('encodes empty string', () => {
    expect(buildGoogleMapsUrl('')).toBe('https://maps.google.com/?q=');
  });
});

describe('openGoogleMaps', () => {
  let openSpy: ReturnType<typeof vi.fn>;
  const originalUA = navigator.userAgent;

  beforeEach(() => {
    openSpy = vi.fn();
    vi.stubGlobal('open', openSpy);
    vi.restoreAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'userAgent', { value: originalUA, configurable: true });
    vi.restoreAllMocks();
  });

  it('does nothing for empty address', () => {
    openGoogleMaps('');
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('opens Google Maps in new tab on desktop', () => {
    Object.defineProperty(navigator, 'userAgent', { value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120', configurable: true });
    openGoogleMaps('1A Barker Rise, Northcross');
    expect(openSpy).toHaveBeenCalledWith(
      'https://maps.google.com/?q=1A%20Barker%20Rise%2C%20Northcross',
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('does not call window.open on mobile (uses location.href instead)', () => {
    Object.defineProperty(navigator, 'userAgent', { value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Mobile/15E148', configurable: true });
    openGoogleMaps('1A Barker Rise, Northcross');
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('does not call window.open on Android (uses location.href instead)', () => {
    Object.defineProperty(navigator, 'userAgent', { value: 'Mozilla/5.0 (Linux; Android 14) Mobile/15E148', configurable: true });
    openGoogleMaps('1A Barker Rise, Northcross');
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('does not call window.open on iPad (uses location.href instead)', () => {
    Object.defineProperty(navigator, 'userAgent', { value: 'Mozilla/5.0 (iPad; CPU OS 17_0) Mobile/15E148', configurable: true });
    openGoogleMaps('1A Barker Rise, Northcross');
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('encodes special characters in address', () => {
    Object.defineProperty(navigator, 'userAgent', { value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120', configurable: true });
    openGoogleMaps('1A & B Street, North Shore');
    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining('maps.google.com/?q='),
      '_blank',
      'noopener,noreferrer',
    );
    expect(openSpy.mock.calls[0][0]).toContain('%26');
  });
});

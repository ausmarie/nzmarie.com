import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  CARD_IMAGE_COPIED_EVENT,
  CARD_IMAGE_FAILED_EVENT,
  copyCardAsImage,
  inlineCardStyles,
  isImageClipboardSupported,
} from '@/lib/card-image-copy';

const pngBlob = () => new Blob(['png'], { type: 'image/png' });

function buildCard(): HTMLElement {
  const root = document.createElement('div');
  root.style.cssText = 'display:flex;flex-wrap:wrap;gap:12px;width:100%;box-sizing:border-box;';
  root.innerHTML = `
    <div class="card" style="flex:1 1 320px;min-width:0;background:#fff;border:1px solid #e2e8f0;border-radius:12px;">
      <span data-prop="saleTitle" contenteditable="true" spellcheck="false">Comparable Sale Price</span>
      <span class="marker"><span data-prop="saleBadge" contenteditable="true" spellcheck="false">Median</span></span>
      <strong>$855,000</strong>
    </div>
    <div class="card" style="flex:1 1 320px;min-width:0;background:#fff;border:1px solid #e2e8f0;border-radius:12px;">
      <span data-prop="cvTitle" contenteditable="true" spellcheck="false">Comparable Council Valuation</span>
      <strong>$1,015,000</strong>
    </div>`;
  document.body.appendChild(root);
  return root;
}

describe('inlineCardStyles', () => {
  let root: HTMLElement | null = null;

  afterEach(() => {
    root?.remove();
    root = null;
  });

  it('inlines the flex row onto the wrapper so Word keeps both columns side by side', () => {
    root = buildCard();

    const wrapper = document.createElement('div');
    wrapper.innerHTML = inlineCardStyles(root);
    const clone = wrapper.firstElementChild as HTMLElement;

    expect(clone.style.display).toBe('flex');
    expect(clone.style.flexWrap).toBe('wrap');
    expect(clone.style.gap).toBe('12px');
  });

  it('inlines each card column styles instead of relying on classes', () => {
    root = buildCard();

    const wrapper = document.createElement('div');
    wrapper.innerHTML = inlineCardStyles(root);
    const cards = Array.from(wrapper.querySelectorAll<HTMLElement>('.card'));

    expect(cards).toHaveLength(2);
    for (const card of cards) {
      expect(card.style.flexGrow).toBe('1');
      expect(card.style.flexBasis).toBe('320px');
      expect(card.style.background).toBe('rgb(255, 255, 255)');
      expect(card.style.borderRadius).toBe('12px');
    }
  });

  it('strips editing attributes so pasted markup has no caret or prop hooks', () => {
    root = buildCard();

    const html = inlineCardStyles(root);

    expect(html).not.toContain('data-prop');
    expect(html).not.toContain('contenteditable');
    expect(html).not.toContain('spellcheck');
    expect(html).toContain('$855,000');
    expect(html).toContain('$1,015,000');
  });

  it('keeps the plain-text Median marker aligned via line-height only', () => {
    root = buildCard();
    // Mirror the card markup: the marker is plain text, no pill chrome.
    const marker = root.querySelector<HTMLElement>('.marker')!;
    marker.setAttribute('style', 'font-size:10px;font-weight:600;color:#94a3b8;line-height:1.4;white-space:nowrap;');

    const wrapper = document.createElement('div');
    wrapper.innerHTML = inlineCardStyles(root);
    const inlinedMarker = wrapper.querySelector<HTMLElement>('.marker')!;

    // A single text line cannot drift: no fixed height, no padding box.
    expect(['', '0px', 'auto']).toContain(inlinedMarker.style.height);
    expect(['', '0px']).toContain(inlinedMarker.style.padding);
    expect(['', '0px']).toContain(inlinedMarker.style.borderRadius);
    expect(inlinedMarker.style.lineHeight).not.toBe('normal');
    expect(inlinedMarker.style.whiteSpace).toBe('nowrap');
    expect(inlinedMarker.textContent).toContain('Median');
  });

  it('does not freeze the height of a text-only marker', () => {
    root = buildCard();
    const marker = root.querySelector<HTMLElement>('.marker')!;
    marker.setAttribute('style', 'font-size:10px;font-weight:600;color:#94a3b8;line-height:1.4;white-space:nowrap;');

    const wrapper = document.createElement('div');
    wrapper.innerHTML = inlineCardStyles(root);
    const inlinedMarker = wrapper.querySelector<HTMLElement>('.marker')!;

    // A frozen height would clip/drift once Word substitutes a font.
    const declarations = (inlinedMarker.getAttribute('style') ?? '').split(';');
    const hasBoxHeight = declarations.some((decl) => /^\s*height\s*:/.test(decl));
    expect(hasBoxHeight).toBe(false);
  });

  it('resolves line-height:normal to a concrete pixel value', () => {
    root = buildCard();
    const title = root.querySelector<HTMLElement>('[data-prop="saleTitle"]')!;
    title.style.lineHeight = 'normal';
    title.style.fontSize = '12px';

    const wrapper = document.createElement('div');
    wrapper.innerHTML = inlineCardStyles(root);
    const inlinedTitle = Array.from(wrapper.querySelectorAll<HTMLElement>('span')).find(
      (el) => el.textContent === 'Comparable Sale Price'
    );

    expect(inlinedTitle).toBeTruthy();
    const style = inlinedTitle?.getAttribute('style') ?? '';
    expect(style).not.toContain('line-height:normal');
    // jsdom has no layout, so the font-size based fallback is emitted.
    expect(style).toMatch(/line-height:[\d.]+px/);
  });
});

describe('isImageClipboardSupported', () => {
  const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  const originalItem = (globalThis as { ClipboardItem?: unknown }).ClipboardItem;

  afterEach(() => {
    if (originalClipboard) {
      Object.defineProperty(navigator, 'clipboard', originalClipboard);
    }
    if (originalItem === undefined) {
      delete (globalThis as { ClipboardItem?: unknown }).ClipboardItem;
    } else {
      (globalThis as { ClipboardItem?: unknown }).ClipboardItem = originalItem;
    }
  });

  it('reports false when the Clipboard API is missing', () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    expect(isImageClipboardSupported()).toBe(false);
  });

  it('reports false when ClipboardItem is missing', () => {
    Object.defineProperty(navigator, 'clipboard', { value: { write: vi.fn() }, configurable: true });
    delete (globalThis as { ClipboardItem?: unknown }).ClipboardItem;
    expect(isImageClipboardSupported()).toBe(false);
  });

  it('reports true when both clipboard write and ClipboardItem exist', () => {
    Object.defineProperty(navigator, 'clipboard', { value: { write: vi.fn() }, configurable: true });
    (globalThis as { ClipboardItem?: unknown }).ClipboardItem = class {};
    expect(isImageClipboardSupported()).toBe(true);
  });
});

describe('copyCardAsImage', () => {
  let write: ReturnType<typeof vi.fn>;
  let events: string[];
  const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  const originalItem = (globalThis as { ClipboardItem?: unknown }).ClipboardItem;
  let root: HTMLElement | null = null;

  const onCopied = () => events.push('copied');
  const onFailed = () => events.push('failed');

  beforeEach(() => {
    write = vi.fn(() => Promise.resolve());
    events = [];
    // Failure paths log intentionally; keep test output clean.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    Object.defineProperty(navigator, 'clipboard', { value: { write }, configurable: true });
    (globalThis as { ClipboardItem?: unknown }).ClipboardItem = class {
      items: Record<string, Promise<Blob>>;
      constructor(items: Record<string, Promise<Blob>>) {
        this.items = items;
      }
    };
    window.addEventListener(CARD_IMAGE_COPIED_EVENT, onCopied);
    window.addEventListener(CARD_IMAGE_FAILED_EVENT, onFailed);
  });

  afterEach(() => {
    window.removeEventListener(CARD_IMAGE_COPIED_EVENT, onCopied);
    window.removeEventListener(CARD_IMAGE_FAILED_EVENT, onFailed);
    vi.restoreAllMocks();
    root?.remove();
    root = null;
    if (originalClipboard) {
      Object.defineProperty(navigator, 'clipboard', originalClipboard);
    }
    if (originalItem === undefined) {
      delete (globalThis as { ClipboardItem?: unknown }).ClipboardItem;
    } else {
      (globalThis as { ClipboardItem?: unknown }).ClipboardItem = originalItem;
    }
  });

  it('writes an image/png clipboard item and emits the copied event', async () => {
    root = buildCard();

    const ok = await copyCardAsImage(root, {}, Promise.resolve(pngBlob()));

    expect(ok).toBe(true);
    expect(write).toHaveBeenCalledTimes(1);
    const items = write.mock.calls[0][0] as Array<{ items: Record<string, Promise<Blob>> }>;
    expect(items).toHaveLength(1);
    expect(Object.keys(items[0].items)).toEqual(['image/png']);
    expect(events).toEqual(['copied']);
  });

  it('returns false and emits the failed event when the write rejects', async () => {
    root = buildCard();
    write.mockImplementation(() => Promise.reject(new Error('clipboard blocked')));

    const ok = await copyCardAsImage(root, {}, Promise.resolve(pngBlob()));

    expect(ok).toBe(false);
    expect(events).toEqual(['failed']);
  });

  it('returns false without touching the clipboard when the API is unavailable', async () => {
    root = buildCard();
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });

    const ok = await copyCardAsImage(root, {}, Promise.resolve(pngBlob()));

    expect(ok).toBe(false);
    expect(events).toEqual(['failed']);
  });
});

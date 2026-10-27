export const CARD_IMAGE_COPIED_EVENT = 'report:card-image-copied';
export const CARD_IMAGE_FAILED_EVENT = 'report:card-image-failed';

export interface CardImageOptions {
  /** Pixel density multiplier used when rasterising the card. Defaults to 2. */
  scale?: number;
  /** Canvas background colour. Defaults to white so Word pages look clean. */
  backgroundColor?: string;
  /** Rendered width in CSS pixels. Defaults to the element's layout width. */
  width?: number;
}

/**
 * Clipboard image writing needs both the async Clipboard API and ClipboardItem.
 * Older browsers (or non-secure contexts) fall back to the HTML copy.
 */
export function isImageClipboardSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.clipboard &&
    typeof navigator.clipboard.write === 'function' &&
    typeof ClipboardItem !== 'undefined'
  );
}

/**
 * Builds a clipboard-safe HTML document body for a card.
 *
 * Word ignores flexbox/grid and class-based styles, so every rule that defines
 * the card's two-column layout is inlined as a `style` attribute. The result is
 * what Word receives when only rich text (no PNG) can be pasted.
 */
/**
 * True when the element holds nothing but a single text run: either it is a
 * text leaf, or it wraps exactly one child that is itself a text leaf. These
 * are atomic markers (e.g. the "Median" label) whose box must follow the
 * destination font rather than a frozen height.
 */
function isTextOnlyLeaf(element: HTMLElement): boolean {
  if ((element.textContent ?? '').trim() === '' && element.children.length === 0) return false;
  if (element.children.length === 0) return (element.textContent ?? '').trim() !== '';
  if (element.children.length === 1) {
    const only = element.children[0] as HTMLElement;
    return only.children.length === 0 && (only.textContent ?? '').trim() !== '';
  }
  return false;
}

/**
 * Resolves `line-height: normal` to the used pixel value so a copy keeps its
 * vertical rhythm when the destination renders with a different font.
 *
 * The element's own text line box is measured; for containers holding block
 * children (no inline text) the computed font-size fallback is used.
 */
function resolveLineHeight(source: HTMLElement, computed: CSSStyleDeclaration): string | undefined {
  const value = computed.lineHeight;
  if (value && value !== 'normal') return value;

  const hasInlineText = Array.from(source.childNodes).some(
    (node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim() !== ''
  );

  if (hasInlineText && typeof Range !== 'undefined') {
    const probe = document.createRange();
    if (typeof probe.getBoundingClientRect === 'function') {
      const range = document.createRange();
      range.selectNodeContents(source);
      const rect = range.getBoundingClientRect();
      if (rect.height > 0) {
        // Round to sub-pixel precision; browsers accept fractional px values.
        const decimals = Math.round(rect.height * 100) / 100;
        return `${decimals}px`;
      }
    }
  }

  const fontSize = parseFloat(computed.fontSize);
  if (!Number.isFinite(fontSize) || fontSize <= 0) return undefined;
  return `${Math.round(fontSize * 1.4 * 100) / 100}px`;
}

export function inlineCardStyles(root: HTMLElement): string {
  const clone = root.cloneNode(true) as HTMLElement;
  const originals = [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))];
  const clones = [clone, ...Array.from(clone.querySelectorAll<HTMLElement>('*'))];

  originals.forEach((source, index) => {
    const target = clones[index];
    if (!target) return;
    const computed = window.getComputedStyle(source);

    const declarations: string[] = [];
    const push = (prop: string, value: string | undefined) => {
      if (value && value !== 'auto' && value !== 'normal' && value !== 'none') {
        declarations.push(`${prop}:${value}`);
      }
    };

    // Layout — the part Word needs most (flex rows, gaps, widths)
    push('display', computed.display);
    push('flex-direction', computed.flexDirection);
    push('flex-wrap', computed.flexWrap);
    push('flex-grow', computed.flexGrow);
    push('flex-shrink', computed.flexShrink);
    push('flex-basis', computed.flexBasis);
    push('align-items', computed.alignItems);
    push('justify-content', computed.justifyContent);
    push('gap', computed.gap);
    push('width', computed.width);
    // Never freeze the height of a single-line text marker: once the
    // destination font differs the text no longer fits and drifts upward.
    // Containers (cards, pills, rows) keep their locked height.
    if (!isTextOnlyLeaf(source)) {
      push('height', computed.height);
    }
    push('min-width', computed.minWidth);
    push('max-width', computed.maxWidth);
    push('box-sizing', computed.boxSizing);

    // Visual — borders, radius, background, typography
    push('padding', computed.padding);
    push('margin', computed.margin);
    push('background-color', computed.backgroundColor);
    push('border', computed.border);
    push('border-top', computed.borderTop);
    push('border-radius', computed.borderRadius);
    push('box-shadow', computed.boxShadow);
    push('color', computed.color);
    push('font-family', computed.fontFamily);
    push('font-size', computed.fontSize);
    push('font-weight', computed.fontWeight);
    push('font-style', computed.fontStyle);
    // line-height:"normal" depends on the destination font. Emitting the used
    // pixel value keeps pill/badge text vertically centred after the copy.
    push('line-height', resolveLineHeight(source, computed));
    push('letter-spacing', computed.letterSpacing);
    push('text-align', computed.textAlign);
    push('white-space', computed.whiteSpace);
    push('vertical-align', computed.verticalAlign);

    if (declarations.length) {
      target.setAttribute('style', `${target.getAttribute('style') ?? ''};${declarations.join(';')}`);
    }

    // Strip editing artefacts so Word shows no data attributes / caret markup
    target.removeAttribute('contenteditable');
    target.removeAttribute('spellcheck');
    target.removeAttribute('data-prop');
    if (target.hasAttribute('data-arrow')) target.removeAttribute('data-arrow');
    if (target.hasAttribute('data-value-col')) target.removeAttribute('data-value-col');
  });

  return clone.outerHTML;
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }
      reject(new Error('Failed to encode card image'));
    }, 'image/png');
  });
}

/**
 * Rasterises a DOM node into a PNG blob. `html2canvas` is imported lazily so it
 * never lands in the initial report editor bundle.
 */
export async function createCardImageBlob(
  element: HTMLElement,
  options: CardImageOptions = {}
): Promise<Blob> {
  const { scale = 2, backgroundColor = '#ffffff', width } = options;
  const { default: html2canvas } = await import('html2canvas');

  const canvas = await html2canvas(element, {
    backgroundColor,
    scale,
    useCORS: true,
    logging: false,
    // Pinning the window width keeps flex rows laid out exactly as on screen.
    windowWidth: width ?? Math.max(document.documentElement.clientWidth, 1200),
  });

  return canvasToBlob(canvas);
}

function dispatch(name: string): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(name));
  }
}

/**
 * Copies a rendered card to the clipboard as a PNG image.
 *
 * The ClipboardItem is created synchronously (with a pending blob promise) so
 * the write stays associated with the user's copy gesture. Word then pastes a
 * crisp image of the card instead of flattened text.
 *
 * Returns `false` when the Clipboard API is unavailable or the write fails, in
 * which case the caller's rich-text fallback remains usable.
 */
export async function copyCardAsImage(
  element: HTMLElement,
  options: CardImageOptions = {},
  blobPromise?: Promise<Blob>
): Promise<boolean> {
  if (!isImageClipboardSupported()) {
    console.debug('[card-image-copy] Clipboard image API not supported');
    dispatch(CARD_IMAGE_FAILED_EVENT);
    return false;
  }

  try {
    const blob = blobPromise ?? createCardImageBlob(element, options);
    const item = new ClipboardItem({ 'image/png': blob });
    await navigator.clipboard.write([item]);
    dispatch(CARD_IMAGE_COPIED_EVENT);
    console.debug('[card-image-copy] Successfully wrote PNG to clipboard');
    return true;
  } catch (err) {
    console.error('[card-image-copy] Failed to copy card as image:', err);
    dispatch(CARD_IMAGE_FAILED_EVENT);
    return false;
  }
}

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor, act, cleanup } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  editor: {
    document: [{ id: 'block-1' }],
    getTextCursorPosition: vi.fn(() => ({ block: { id: 'block-1' } })),
    insertBlocks: vi.fn(),
    focus: vi.fn(),
  },
  handleImageFile: vi.fn(),
  cardImage: {
    copyCardAsImage: vi.fn((_element: HTMLElement, _options?: unknown, _blob?: Promise<Blob>) => Promise.resolve(true)),
    isImageClipboardSupported: vi.fn(() => true),
    createCardImageBlob: vi.fn(() => Promise.resolve(new Blob(['png'], { type: 'image/png' }))),
    inlineCardStyles: vi.fn((element: HTMLElement) => {
      const clone = element.cloneNode(true) as HTMLElement;
      clone.querySelectorAll<HTMLElement>('[contenteditable]').forEach((el) => {
        el.removeAttribute('contenteditable');
        el.removeAttribute('spellcheck');
      });
      clone.querySelectorAll<HTMLElement>('[data-prop]').forEach((el) => {
        el.removeAttribute('data-prop');
      });
      return clone.outerHTML;
    }),
    eventName: 'report:card-image-copied',
    failedEventName: 'report:card-image-failed',
  },
  blockSpecs: [] as Array<{
    spec: { type: string; propSchema: Record<string, { default: string }> };
    implementation: { render: (block: any, editor: any) => { dom: HTMLElement; destroy?: () => void } };
  }>,
}));

vi.mock('@blocknote/core', () => ({
  BlockNoteSchema: { create: vi.fn(() => ({})) },
  defaultBlockSpecs: {},
  defaultInlineContentSpecs: {},
  createInlineContentSpec: vi.fn(() => ({})),
  createBlockSpec: vi.fn((spec, implementation) => {
    mocks.blockSpecs.push({ spec, implementation });
    return () => ({});
  }),
}));

vi.mock('@blocknote/core/extensions', () => ({
  filterSuggestionItems: vi.fn(() => []),
}));

vi.mock('@blocknote/react', () => ({
  useCreateBlockNote: vi.fn(() => mocks.editor),
  getDefaultReactSlashMenuItems: vi.fn(() => []),
  SuggestionMenuController: () => null,
}));

vi.mock('@blocknote/mantine', () => ({
  BlockNoteView: () => null,
}));

vi.mock('../../app/admin/reports/hooks/useAutoSave', () => ({
  useAutoSave: vi.fn(),
}));

vi.mock('../../app/admin/reports/hooks/useImageUpload', () => ({
  useImageUpload: () => ({ handleImageFile: mocks.handleImageFile }),
}));

vi.mock('../../app/admin/reports/stores/report-store', () => ({
  useReportStore: () => ({
    isSaving: false,
    lastSaved: null,
    setIsSaving: vi.fn(),
    setLastSaved: vi.fn(),
    updateDocument: vi.fn(),
  }),
}));

vi.mock('@/lib/card-image-copy', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/card-image-copy')>();
  return {
    ...actual,
    CARD_IMAGE_COPIED_EVENT: mocks.cardImage.eventName,
    CARD_IMAGE_FAILED_EVENT: mocks.cardImage.failedEventName,
    copyCardAsImage: mocks.cardImage.copyCardAsImage,
    createCardImageBlob: mocks.cardImage.createCardImageBlob,
    inlineCardStyles: mocks.cardImage.inlineCardStyles,
    isImageClipboardSupported: mocks.cardImage.isImageClipboardSupported,
  };
});

import ReportEditor from '../../app/admin/reports/components/ReportEditor';
import CardCopyToast from '../../app/admin/reports/components/CardCopyToast';

function pasteClipboardData(target: Element, files: File[] = [], items: unknown[] = []) {
  fireEvent.paste(target, {
    clipboardData: { files, items },
  });
}

describe('ReportEditor image paste', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.editor.getTextCursorPosition.mockImplementation(() => ({ block: { id: 'block-1' } }));
    mocks.cardImage.copyCardAsImage.mockImplementation(() => Promise.resolve(true));
    mocks.cardImage.isImageClipboardSupported.mockReturnValue(true);
  });

  afterEach(() => {
    // @testing-library/react auto-cleanup is disabled for this suite, so mounted
    // editors would keep their window copy listeners alive across tests.
    cleanup();
  });

  it('uploads a pasted image and inserts it as an image block', async () => {
    mocks.handleImageFile.mockResolvedValue('https://reports.example.com/pasted.png');
    const { container } = render(<ReportEditor docId="doc-1" initialContent={null} />);
    const file = new File(['image'], 'clipboard.png', { type: 'image/png' });

    pasteClipboardData(container.querySelector('.report-editor-container')!, [file]);

    await waitFor(() => {
      expect(mocks.handleImageFile).toHaveBeenCalledWith(file, 'doc-1');
    });
    await waitFor(() => {
      expect(mocks.editor.insertBlocks).toHaveBeenCalledWith(
        [{ type: 'image', props: { url: 'https://reports.example.com/pasted.png' } }],
        'block-1',
        'after'
      );
    });
  });

  it('does not upload or block ordinary text paste', async () => {
    const { container } = render(<ReportEditor docId="doc-1" initialContent={null} />);

    pasteClipboardData(container.querySelector('.report-editor-container')!, [], [
      { kind: 'string', type: 'text/plain', getAsFile: () => null },
    ]);

    expect(mocks.handleImageFile).not.toHaveBeenCalled();
    expect(mocks.editor.insertBlocks).not.toHaveBeenCalled();
  });

  it('shows an upload error without inserting a block', async () => {
    mocks.handleImageFile.mockRejectedValue(new Error('Image too large. Max 5MB'));
    const { container, findByText } = render(<ReportEditor docId="doc-1" initialContent={null} />);
    const file = new File(['image'], 'clipboard.png', { type: 'image/png' });

    pasteClipboardData(container.querySelector('.report-editor-container')!, [file]);

    expect(await findByText('Image too large. Max 5MB')).toBeTruthy();
    expect(mocks.editor.insertBlocks).not.toHaveBeenCalled();
  });

  it('selects the whole card on background mousedown without focusing a field', () => {
    const captured = mocks.blockSpecs.find(({ spec }) => spec.type === 'marketPulse');
    expect(captured).toBeTruthy();
    if (!captured) return;

    const props = Object.fromEntries(
      Object.entries(captured.spec.propSchema).map(([key, value]) => [key, value.default])
    );
    props.medianPrice = '1.19M';
    props.medianLabel = 'Median Sale Price';
    const node = captured.implementation.render({ id: 'pulse-1', props }, mocks.editor);

    try {
      document.body.appendChild(node.dom);
      const firstField = node.dom.querySelector<HTMLElement>('[data-prop]');
      expect(firstField).toBeTruthy();
      if (!firstField) return;
      const focus = vi.spyOn(firstField, 'focus');
      const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });

      node.dom.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(true);
      expect(focus).not.toHaveBeenCalled();
      const selection = window.getSelection();
      expect(selection?.rangeCount).toBe(1);
      expect(selection?.getRangeAt(0).commonAncestorContainer).toBe(node.dom);
    } finally {
      node.destroy?.();
      node.dom.remove();
    }
  });

  it('copies the card with a BlockNote block payload and upgrades it to a PNG', async () => {
    const captured = mocks.blockSpecs.find(({ spec }) => spec.type === 'marketPulse');
    expect(captured).toBeTruthy();
    if (!captured) return;

    const props = Object.fromEntries(
      Object.entries(captured.spec.propSchema).map(([key, value]) => [key, value.default])
    );
    props.medianPrice = '1.19M';
    props.medianLabel = 'Median Sale Price';
    props.card2Note = 'North Shore Sold: 262';
    const node = captured.implementation.render({ id: 'pulse-1', type: 'marketPulse', props }, mocks.editor);
    const setData = vi.fn();

    try {
      document.body.appendChild(node.dom);
      vi.spyOn(node.dom, 'getBoundingClientRect').mockReturnValue({
        width: 800, height: 300, top: 0, left: 0, right: 800, bottom: 300, x: 0, y: 0,
        toJSON: () => ({}),
      } as DOMRect);
      node.dom.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));

      const medianField = node.dom.querySelector<HTMLElement>('[data-prop="medianPrice"]');
      expect(medianField).toBeTruthy();
      if (medianField) {
        medianField.textContent = '$1,234,567';
        medianField.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
      }

      await waitFor(() => {
        expect(mocks.cardImage.copyCardAsImage.mock.calls.length).toBe(0);
      });

      const event = new Event('copy', { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'clipboardData', { value: { setData } });
      document.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(true);
      const internal = setData.mock.calls.find(([type]) => type === 'blocknote/html')?.[1];
      expect(internal).toBeTruthy();

      const wrapper = document.createElement('div');
      wrapper.innerHTML = internal;
      const blockContent = wrapper.firstElementChild;
      expect(blockContent?.getAttribute('data-content-type')).toBe('marketPulse');
      expect(blockContent?.getAttribute('data-median-price')).toBe('1.19M');
      expect(blockContent?.getAttribute('data-median-label')).toBe('Median Sale Price');
      expect(blockContent?.getAttribute('data-card2note')).toBe('North Shore Sold: 262');

      // The card is also handed to the clipboard as a PNG for Word pasting.
      // Wait for requestAnimationFrame callback to fire
      await waitFor(() => {
        expect(mocks.cardImage.copyCardAsImage).toHaveBeenCalledTimes(1);
      });
      const rendered = mocks.cardImage.copyCardAsImage.mock.calls[0][0] as HTMLElement;
      expect(rendered.style.width).toBe('800px');
      // Editor selection chrome is removed from the captured image.
      expect(rendered.style.outline).toBe('none');
      // Editing attributes are stripped from the captured HTML
      expect(rendered.querySelector('[data-prop]')).toBeNull();
      expect(rendered.textContent).toContain('$1,234,567');
      expect(rendered.textContent).not.toContain('1.19M');
    } finally {
      node.destroy?.();
      node.dom.remove();
    }
  });

  it('copies Comparable Sales with inlined flex styles so Word keeps two columns', () => {
    const captured = mocks.blockSpecs.find(({ spec }) => spec.type === 'comparableSummary');
    expect(captured).toBeTruthy();
    if (!captured) return;

    const props = Object.fromEntries(
      Object.entries(captured.spec.propSchema).map(([key, value]) => [key, value.default])
    );
    props.saleMedian = '$855,000';
    props.saleRange = '$820,000 – $1,081,500';
    props.cvMedian = '$1,015,000';
    const node = captured.implementation.render({ id: 'comp-1', type: 'comparableSummary', props }, mocks.editor);
    const setData = vi.fn();

    try {
      document.body.appendChild(node.dom);
      node.dom.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));

      const event = new Event('copy', { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'clipboardData', { value: { setData } });
      document.dispatchEvent(event);

      // The rich-text fallback must be built from the style-inlined clone...
      expect(mocks.cardImage.inlineCardStyles).toHaveBeenCalledWith(node.dom);
      const html = setData.mock.calls.find(([type]) => type === 'text/html')?.[1] as string;
      expect(html).toContain('$855,000');
      expect(html).toContain('$1,015,000');
      expect(html).not.toContain('data-prop=');
      expect(html).not.toContain('contenteditable');
    } finally {
      node.destroy?.();
      node.dom.remove();
    }
  });

  it('keeps the HTML copy when image clipboard support is unavailable', () => {
    mocks.cardImage.isImageClipboardSupported.mockReturnValue(false);
    const captured = mocks.blockSpecs.find(({ spec }) => spec.type === 'comparableSummary');
    expect(captured).toBeTruthy();
    if (!captured) return;

    const props = Object.fromEntries(
      Object.entries(captured.spec.propSchema).map(([key, value]) => [key, value.default])
    );
    props.saleMedian = '$855,000';
    const node = captured.implementation.render({ id: 'comp-1', type: 'comparableSummary', props }, mocks.editor);
    const setData = vi.fn();

    try {
      document.body.appendChild(node.dom);
      node.dom.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));

      const event = new Event('copy', { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'clipboardData', { value: { setData } });
      document.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(true);
      expect(setData.mock.calls.find(([type]) => type === 'text/html')?.[1]).toContain('$855,000');
      expect(mocks.cardImage.copyCardAsImage).not.toHaveBeenCalled();
    } finally {
      node.destroy?.();
      node.dom.remove();
    }
  });

  it('wins the copy event when BlockNote clears the clipboardData first', () => {
    // No image clipboard: this test is about the rich-text fallback ordering.
    mocks.cardImage.isImageClipboardSupported.mockReturnValue(false);
    const captured = mocks.blockSpecs.find(({ spec }) => spec.type === 'comparableSummary');
    expect(captured).toBeTruthy();
    if (!captured) return;

    const props = Object.fromEntries(
      Object.entries(captured.spec.propSchema).map(([key, value]) => [key, value.default])
    );
    props.saleMedian = '$855,000';
    const node = captured.implementation.render({ id: 'comp-1', type: 'comparableSummary', props }, mocks.editor);
    const store = new Map<string, string>();
    const clipboardData = {
      setData: (type: string, value: string) => store.set(type, value),
      getData: (type: string) => store.get(type) ?? '',
      clearData: () => store.clear(),
      types: [] as string[],
    };

    try {
      document.body.appendChild(node.dom);
      node.dom.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));

      let blockNoteSawDefaultPrevented = false;
      // Simulates BlockNote's copyToClipboard plugin: like ProseMirror's
      // handleDOMEvents it bails out when another handler already handled the
      // event (defaultPrevented).
      const blockNoteListener = (ev: Event) => {
        if (ev.defaultPrevented) return;
        blockNoteSawDefaultPrevented = true;
        clipboardData.clearData();
        clipboardData.setData('text/html', '<p>Comparable Sale Price Median</p>');
      };
      document.addEventListener('copy', blockNoteListener);

      try {
        const event = new Event('copy', { bubbles: true, cancelable: true });
        Object.defineProperty(event, 'clipboardData', { value: clipboardData });
        document.dispatchEvent(event);
      } finally {
        document.removeEventListener('copy', blockNoteListener);
      }

      expect(blockNoteSawDefaultPrevented).toBe(false);
      // Our payload survives because we handled and prevented the event first.
      const html = store.get('text/html') ?? '';
      expect(html).toContain('$855,000');
      expect(store.get('text/plain') ?? '').toContain('$855,000');
      expect(store.has('blocknote/html')).toBe(true);
    } finally {
      node.destroy?.();
      node.dom.remove();
    }
  });

  it('captures Comparable Sales as a wide two-column image, not a text column', async () => {
    const captured = mocks.blockSpecs.find(({ spec }) => spec.type === 'comparableSummary');
    expect(captured).toBeTruthy();
    if (!captured) return;

    const props = Object.fromEntries(
      Object.entries(captured.spec.propSchema).map(([key, value]) => [key, value.default])
    );
    props.saleMedian = '$855,000';
    props.cvMedian = '$1,015,000';
    const node = captured.implementation.render({ id: 'comp-1', type: 'comparableSummary', props }, mocks.editor);

    try {
      document.body.appendChild(node.dom);
      vi.spyOn(node.dom, 'getBoundingClientRect').mockReturnValue({
        width: 860, height: 240, top: 0, left: 0, right: 860, bottom: 240, x: 0, y: 0,
        toJSON: () => ({}),
      } as DOMRect);
      node.dom.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));

      const event = new Event('copy', { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'clipboardData', { value: { setData: vi.fn() } });
      document.dispatchEvent(event);

      await waitFor(() => {
        expect(mocks.cardImage.createCardImageBlob).toHaveBeenCalledTimes(1);
      });

      const [rendered, options] = mocks.cardImage.createCardImageBlob.mock.calls[0] as unknown as [
        HTMLElement,
        { width?: number },
      ];
      // Full editor width is preserved so both columns render side by side.
      expect(rendered.style.width).toBe('860px');
      expect(rendered.style.maxWidth).toBe('none');
      expect(options.width).toBe(860);
      // Selection outline is editor chrome, never part of the image.
      expect(rendered.style.outline).toBe('none');
      // Both cards are present in the rasterised DOM.
      expect(rendered.textContent).toContain('$855,000');
      expect(rendered.textContent).toContain('$1,015,000');
      // The off-screen holder is cleaned up after copying.
      await waitFor(() => {
        expect(document.querySelector('div[style*="-20000px"]')).toBeNull();
      });
    } finally {
      node.destroy?.();
      node.dom.remove();
    }
  });

  it('renders the copy toast container for clipboard feedback', () => {
    const { queryByTestId } = render(<CardCopyToast />);
    expect(queryByTestId('card-copied-toast')).toBeNull();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  editor: {
    document: [{ id: 'block-1' }],
    getTextCursorPosition: vi.fn(() => ({ block: { id: 'block-1' } })),
    insertBlocks: vi.fn(),
    focus: vi.fn(),
  },
  handleImageFile: vi.fn(),
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

import ReportEditor from '../../app/admin/reports/components/ReportEditor';

function pasteClipboardData(target: Element, files: File[] = [], items: unknown[] = []) {
  fireEvent.paste(target, {
    clipboardData: { files, items },
  });
}

describe('ReportEditor image paste', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.editor.getTextCursorPosition.mockImplementation(() => ({ block: { id: 'block-1' } }));
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

  it('copies the card with a BlockNote block payload', () => {
    const captured = mocks.blockSpecs.find(({ spec }) => spec.type === 'marketPulse');
    expect(captured).toBeTruthy();
    if (!captured) return;

    const props = Object.fromEntries(
      Object.entries(captured.spec.propSchema).map(([key, value]) => [key, value.default])
    );
    props.medianPrice = '1.19M';
    props.medianLabel = 'Median Sale Price';
    const node = captured.implementation.render({ id: 'pulse-1', type: 'marketPulse', props }, mocks.editor);
    const setData = vi.fn();

    try {
      document.body.appendChild(node.dom);
      node.dom.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));

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
    } finally {
      node.destroy?.();
      node.dom.remove();
    }
  });
});

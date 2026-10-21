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
}));

vi.mock('@blocknote/core', () => ({
  BlockNoteSchema: { create: vi.fn(() => ({})) },
  defaultBlockSpecs: {},
  defaultInlineContentSpecs: {},
  createInlineContentSpec: vi.fn(() => ({})),
  createBlockSpec: vi.fn(() => () => ({})),
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
});

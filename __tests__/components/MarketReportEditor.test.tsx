import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MarketReportEditor from '@/components/market/MarketReportEditor';

vi.mock('@blocknote/react', () => ({
  useCreateBlockNote: () => ({ document: [{ type: 'paragraph' }] }),
}));

vi.mock('@blocknote/mantine', () => ({
  BlockNoteView: ({ onChange }: { onChange?: () => void }) => (
    <button type="button" onClick={onChange}>Change report content</button>
  ),
}));

vi.mock('@/components/market/market-report-blocks', () => ({
  createMarketReportSchema: () => ({}),
}));

describe('MarketReportEditor', () => {
  it('omits the introduction field and reports content edits', () => {
    const onContentChange = vi.fn();

    render(
      <MarketReportEditor
        reportId="report-1"
        content={[{ type: 'paragraph' }]}
        getContentRef={{ current: null }}
        onContentChange={onContentChange}
      />
    );

    expect(screen.queryByLabelText('Introduction / summary')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Change report content' }));
    expect(onContentChange).toHaveBeenCalledOnce();
  });
});

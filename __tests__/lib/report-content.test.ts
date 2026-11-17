import { describe, expect, it } from 'vitest';
import { trimTrailingEmptyParagraphs } from '@/lib/report-content';

describe('trimTrailingEmptyParagraphs', () => {
  it('removes trailing blank paragraphs but preserves blank paragraphs between content', () => {
    const content = [
      { type: 'paragraph', content: [{ type: 'text', text: 'First paragraph' }] },
      { type: 'paragraph', content: [] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Last paragraph' }] },
      { type: 'paragraph', content: [{ type: 'text', text: '  ' }] },
      { type: 'paragraph', content: [] },
    ] as Parameters<typeof trimTrailingEmptyParagraphs>[0];

    expect(trimTrailingEmptyParagraphs(content)).toHaveLength(3);
    expect(trimTrailingEmptyParagraphs(content)[1]).toEqual(content[1]);
  });

  it('keeps content in nested inline text', () => {
    const content = [
      {
        type: 'paragraph',
        content: [{ type: 'link', content: [{ type: 'text', text: 'Linked content' }] }],
      },
    ] as Parameters<typeof trimTrailingEmptyParagraphs>[0];

    expect(trimTrailingEmptyParagraphs(content)).toHaveLength(1);
  });
});

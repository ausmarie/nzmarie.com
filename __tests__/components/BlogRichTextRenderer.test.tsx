import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import BlogRichTextRenderer from '@/components/blog/BlogRichTextRenderer';
import type { ReportEditorContent } from '@/types/report';

describe('BlogRichTextRenderer', () => {
  afterEach(cleanup);

  it('renders formatted text and headings from published block content', () => {
    const content = [
      { type: 'heading', props: { level: 2 }, content: [{ type: 'text', text: 'Buying well' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Compare the details.', styles: { bold: true } }] },
    ] as ReportEditorContent;

    render(<BlogRichTextRenderer content={content} />);

    expect(screen.getByRole('heading', { name: 'Buying well' })).toBeTruthy();
    expect(screen.getByText('Compare the details.').tagName).toBe('STRONG');
  });

  it('does not render unsafe links or image sources from article content', () => {
    const content = [
      {
        type: 'paragraph',
        content: [{
          type: 'link',
          href: 'javascript:alert(1)',
          content: [{ type: 'text', text: 'unsafe link' }],
        }],
      },
      { type: 'image', props: { url: 'javascript:alert(1)', name: 'unsafe' } },
    ] as ReportEditorContent;

    render(<BlogRichTextRenderer content={content} />);

    expect(screen.getByText('unsafe link').closest('a')).toBeNull();
    expect(document.querySelector('img')).toBeNull();
  });

  it('renders BlockNote table cell contents and header rows', () => {
    const content = [{
      type: 'table',
      content: {
        type: 'tableContent',
        headerRows: 1,
        rows: [
          {
            cells: [
              { type: 'tableCell', content: [{ type: 'text', text: 'Sales Method' }] },
              { type: 'tableCell', content: [{ type: 'text', text: 'Core Advantage' }] },
            ],
          },
          {
            cells: [
              { type: 'tableCell', content: [{ type: 'text', text: 'Auction' }] },
              [{ type: 'text', text: 'Competitive bidding' }],
            ],
          },
        ],
      },
    }] as ReportEditorContent;

    render(<BlogRichTextRenderer content={content} />);

    expect(screen.getByRole('columnheader', { name: 'Sales Method' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Core Advantage' })).toBeTruthy();
    expect(screen.getByRole('cell', { name: 'Auction' })).toBeTruthy();
    expect(screen.getByRole('cell', { name: 'Competitive bidding' })).toBeTruthy();
    expect(document.querySelector('.blog-public-richtext')?.classList.contains('market-report-richtext')).toBe(true);
    expect(document.querySelector('table')?.className).toBe('w-full border-collapse text-left');
    expect(document.querySelector('th')?.className).toBe('border border-slate-300 px-3 py-2');
  });

  it('uses semantic list markup and disables the duplicate BlockNote bullet marker', () => {
    const content = [{
      type: 'bulletListItem',
      content: [{ type: 'text', text: 'Comparative Market Analysis' }],
    }] as ReportEditorContent;

    render(<BlogRichTextRenderer content={content} />);

    const blockContent = screen.getByText('Comparative Market Analysis').closest('.bn-block-content');
    expect(blockContent?.getAttribute('data-native-list-marker')).toBe('true');
    expect(blockContent?.querySelector('ul.list-disc > li')?.textContent).toBe('Comparative Market Analysis');
  });
});

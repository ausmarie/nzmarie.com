import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import MarketReportArticle from '@/components/market/MarketReportArticle';
import type { MarketReportArticleData } from '@/components/market/MarketReportArticle';

vi.mock('@blocknote/react', () => ({
  useCreateBlockNote: () => ({}),
}));

vi.mock('@blocknote/mantine', () => ({
  BlockNoteView: () => React.createElement('div', { 'data-testid': 'report-content' }),
}));

vi.mock('next/dynamic', () => ({
  default: () => ({ content }: { content: unknown }) => React.createElement(
    'div',
    { 'data-testid': 'report-content' },
    JSON.stringify(content),
  ),
}));

vi.mock('@/components/Header', () => ({
  default: () => null,
}));

vi.mock('@/lib/market-report-document', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/market-report-document')>();
  return {
    ...actual,
    ensureMarketReportRichTextContent: (content: unknown[]) => content,
  };
});

const report: MarketReportArticleData = {
  content: [{ type: 'paragraph' }],
  dataSnapshot: {
    periodType: 'monthly',
    periodKey: '2026-10',
    periodLabel: 'October 2026',
    generatedAt: '2026-11-01T00:00:00.000Z',
    source: 'Test source',
    propertyType: 'House',
    metrics: { medianPrice: null, salesCount: 0, daysToSell: null },
    charts: { medianPrice: [], salesCount: [], daysToSell: [] },
    dataNotes: 'Test notes',
  },
};

describe('MarketReportArticle', () => {
  afterEach(cleanup);

  it('does not render a separate report title or summary and preserves the page width', () => {
    render(<MarketReportArticle report={report} preview />);

    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
    expect(screen.queryByText('North Shore Property Market Report', { exact: true })).toBeNull();
    expect(screen.queryByText('October 2026 · Draft preview')).toBeNull();

    expect(document.querySelector('body > div > div')?.className).toContain('bg-white');
    const main = document.querySelector('main');
    const article = document.querySelector('article');
    expect(main?.className).toContain('max-w-6xl');
    expect(main?.className).toContain('market-report-body');
    expect(article?.className).toContain('px-4');
    expect(article?.className).not.toMatch(/bg-white|border|rounded|shadow/);
  });

  it('adds the Reports delta icon to the rich-text title', () => {
    render(
      <MarketReportArticle
        report={{
          ...report,
          content: [{
            type: 'heading',
            props: { level: 1 },
            content: [{ type: 'text', text: 'North Shore Market Report', styles: { bold: true } }],
          }] as unknown as MarketReportArticleData['content'],
        }}
      />,
    );

    expect(screen.getByTestId('report-content').textContent).toContain('"type":"delta"');
    expect(screen.getByTestId('report-content').textContent).toContain('North Shore Market Report');
  });

  it('renders a custom footer as paragraphs and aligns it with the report content', () => {
    render(<MarketReportArticle report={{ ...report, footer: 'Custom source note.\nCustom disclaimer.' }} />);

    const footer = document.querySelector('footer');
    expect(footer?.className).toContain('market-report-footer');
    expect(footer?.textContent).toBe('Custom source note.Custom disclaimer.');
  });

  it('uses the generated footer when a report has no custom footer', () => {
    render(<MarketReportArticle report={report} />);

    expect(screen.getByText('Source: Test source. Property type: House.')).toBeTruthy();
    expect(screen.getByText('This report is an independent market analysis and is not a formal property valuation or financial advice.')).toBeTruthy();
  });
});

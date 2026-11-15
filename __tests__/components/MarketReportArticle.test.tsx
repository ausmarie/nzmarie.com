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
  default: () => () => React.createElement('div', { 'data-testid': 'report-content' }),
}));

vi.mock('@/components/Header', () => ({
  default: () => null,
}));

vi.mock('@/lib/market-report-document', () => ({
  ensureMarketReportRichTextContent: (content: unknown[]) => content,
}));

const report: MarketReportArticleData = {
  title: 'North Shore Property Market Report — October 2026',
  summary: '',
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

  it('removes redundant report labels and paper styling while preserving the page width', () => {
    render(<MarketReportArticle report={report} preview />);

    const heading = screen.getByRole('heading', { level: 1, name: report.title });
    expect(heading).toBeTruthy();
    expect(heading.className).toContain('text-left');
    expect(heading.parentElement?.className).toContain('px-4');
    expect(heading.parentElement?.className).toContain('sm:px-8');
    expect(heading.parentElement?.className).toContain('market-report-title');
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

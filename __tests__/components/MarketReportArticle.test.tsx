import React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import MarketReportArticle from '@/components/market/MarketReportArticle';
import type { MarketReportArticleData } from '@/components/market/MarketReportArticle';

vi.mock('@/components/Header', () => ({
  default: () => React.createElement('div', { 'data-testid': 'public-header' }),
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

  it('renders the structured article header and preserves the page width', () => {
    render(<MarketReportArticle report={report} preview />);

    expect(screen.queryByTestId('public-header')).toBeNull();
    expect(document.querySelector('body > div > div')?.className).toContain('overflow-y-auto');
    expect(screen.getByRole('heading', { level: 1, name: 'North Shore Market Report' })).toBeTruthy();
    expect(screen.getByText('By Marie Nian')).toBeTruthy();
    expect(screen.getByText('Barfoot & Thompson')).toBeTruthy();
    expect(screen.getByText('5 min read')).toBeTruthy();
    expect(screen.getByText('Nov 2026')).toBeTruthy();
    const metadata = document.querySelector('main > article > header > div:last-child');
    expect(metadata?.textContent).toBe('By Marie Nian•Barfoot & Thompson•5 min read•Nov 2026');
    expect(screen.queryByText('October 2026 · Draft preview')).toBeNull();

    expect(document.querySelector('body > div > div')?.className).toContain('bg-white');
    const main = document.querySelector('main');
    const article = document.querySelector('article');
    expect(main?.className).toContain('max-w-6xl');
    expect(main?.className).toContain('market-report-body');
    expect(article?.className).toContain('px-4');
    expect(article?.className).not.toMatch(/bg-white|border|rounded|shadow/);
  });

  it('uses the Chinese header metadata and responsive wrapping layout', () => {
    render(
      <MarketReportArticle
        report={{
          ...report,
          language: 'zh',
          articleHeader: {
            icon: 'none',
            title: '北岸市场报告',
            subtitle: '2026年10月市场更新',
            author: 'Marie Nian',
            organization: 'Barfoot & Thompson',
            readingMinutes: 6,
            articleMonth: '2026-11',
          },
        }}
        preview
      />,
    );

    expect(screen.getByRole('heading', { level: 1, name: '北岸市场报告' })).toBeTruthy();
    expect(screen.getByText('2026年10月市场更新')).toBeTruthy();
    expect(screen.getByText('作者：Marie Nian')).toBeTruthy();
    expect(screen.getByText('Barfoot & Thompson')).toBeTruthy();
    expect(screen.getByText('6 分钟阅读')).toBeTruthy();
    expect(screen.getByText('2026年11月')).toBeTruthy();
    const metadata = document.querySelector('main > article > header > div:last-child');
    expect(metadata?.textContent).toBe('作者：Marie Nian•Barfoot & Thompson•6 分钟阅读•2026年11月');
    expect(screen.queryByText('△')).toBeNull();
    expect(document.querySelector('main > article > header > div:last-child')?.className)
      .toContain('flex-wrap');
  });

  it('renders the outlined market report icon with its baseline', () => {
    render(<MarketReportArticle report={report} preview />);
    const icon = document.querySelector('main > article > header svg');

    expect(icon?.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(icon?.querySelectorAll('path')).toHaveLength(2);
    expect(icon?.querySelector('path')?.getAttribute('stroke')).toBe('#244fc4');
  });

  it('renders the report heading as semantic HTML', () => {
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

    expect(screen.getByRole('heading', { level: 1, name: 'North Shore Market Report' })).toBeTruthy();
  });

  it('applies the same Note styling hook to English and Chinese note quotes only', () => {
    render(
      <MarketReportArticle
        report={{
          ...report,
          content: [
            {
              type: 'quote',
              content: [{ type: 'text', text: 'Note: Market data reflects broad trends.', styles: {} }],
            },
            {
              type: 'quote',
              content: [{ type: 'text', text: '提示：数据反映整体市场趋势。', styles: {} }],
            },
            {
              type: 'quote',
              content: [{ type: 'text', text: 'A quoted market observation.', styles: {} }],
            },
          ] as unknown as MarketReportArticleData['content'],
        }}
      />,
    );

    const quotes = [...document.querySelectorAll('.market-report-richtext blockquote')];
    expect(quotes).toHaveLength(3);
    expect(quotes[0].classList.contains('market-report-note')).toBe(true);
    expect(quotes[1].classList.contains('market-report-note')).toBe(true);
    expect(quotes[2].classList.contains('market-report-note')).toBe(false);
    expect(quotes.every((quote) => quote.classList.contains('market-report-quote'))).toBe(true);
    expect(quotes.every((quote) => !quote.hasAttribute('style'))).toBe(true);
  });

  it('keeps only the report title as h1 and demotes later level-one headings to h2', () => {
    render(
      <MarketReportArticle
        report={{
          ...report,
          content: [
            'North Shore Market Report',
            'October 2026 Housing Market Update (Spring Edition)',
            'North Shore Market Pulse (October 2026)',
            'REINZ Market Trends',
          ].map((text) => ({
            type: 'heading',
            props: { level: 1 },
            content: [{ type: 'text', text, styles: {} }],
          })) as unknown as MarketReportArticleData['content'],
        }}
      />,
    );

    expect(document.querySelectorAll('h1')).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'North Shore Market Report' })).toBeTruthy();
    const pulseHeading = screen.getByRole('heading', { level: 2, name: 'North Shore Market Pulse (October 2026)' });
    expect(pulseHeading.className).toContain('market-report-heading-level-1');
    expect(screen.getByRole('heading', { level: 2, name: 'REINZ Market Trends' }).className)
      .toContain('market-report-heading-level-1');
  });

  it('links report note actions and contact details and fixes the extra punctuation space', () => {
    render(
      <MarketReportArticle
        report={{
          ...report,
          content: [{
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Request a Free Property Appraisal, ',
                styles: { italic: true },
              },
              {
                type: 'link',
                props: { url: 'http://localhost:3000/#download-report' },
                content: [{ type: 'text', text: 'Download Your Suburb Report', styles: { italic: true } }],
              },
              {
                type: 'text',
                text: ' . Contact m.nian@barfoot.co.nz or call 021 0693 089.',
                styles: { italic: true },
              },
            ],
          }] as unknown as MarketReportArticleData['content'],
        }}
      />,
    );

    const article = within(screen.getByRole('article'));
    expect(article.getByRole('link', { name: 'Request a Free Property Appraisal' }).getAttribute('href')).toBe('/#appraisal');
    expect(article.getByRole('link', { name: 'Download Your Suburb Report' }).getAttribute('href')).toBe('/#download-report');
    expect(article.getByRole('link', { name: 'm.nian@barfoot.co.nz' }).getAttribute('href')).toBe('mailto:m.nian@barfoot.co.nz');
    const phoneLink = article.getByRole('link', { name: '021 0693 089' });
    expect(phoneLink.getAttribute('href')).toBe('tel:+64210693089');
    const renderedNote = document.querySelector('.market-report-richtext')?.textContent ?? '';
    expect(renderedNote).toContain('Download Your Suburb Report. Contact');
    expect(renderedNote).not.toContain('Report .');
    expect([...document.querySelectorAll('.market-report-richtext em')].some((em) =>
      em.textContent?.trimEnd().endsWith('021 0693 089.'),
    )).toBe(false);
  });

  it('removes italics from only the hyphen in pre-election', () => {
    render(
      <MarketReportArticle
        report={{
          ...report,
          content: [{
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Sales Volume Insight: pre', styles: { italic: true } },
              { type: 'text', text: '-', styles: { italic: true } },
              { type: 'text', text: 'election activity', styles: { italic: true } },
            ],
          }] as unknown as MarketReportArticleData['content'],
        }}
      />,
    );

    const paragraph = [...document.querySelectorAll('.market-report-richtext p')]
      .find((element) => element.textContent?.includes('pre-election'));
    expect(paragraph?.textContent).toContain('pre-election');
    expect([...paragraph?.querySelectorAll('em') ?? []].some((em) => em.textContent?.includes('-'))).toBe(false);
  });

  it('links the Chinese appraisal and suburb report actions to Chinese homepage sections', () => {
    render(
      <MarketReportArticle
        report={{
          ...report,
          language: 'zh',
          content: [{
            type: 'paragraph',
            content: [{
              type: 'text',
              text: '预约免费房产评估 或 下载专属子区报告',
              styles: {},
            }],
          }] as unknown as MarketReportArticleData['content'],
        }}
      />,
    );

    const article = within(screen.getByRole('article'));
    expect(article.getByRole('link', { name: '预约免费房产评估' }).getAttribute('href')).toBe('/cn#appraisal');
    expect(article.getByRole('link', { name: '下载专属子区报告' }).getAttribute('href')).toBe('/cn#download-report');
  });

  it('includes report text and descriptive chart alt text in server-rendered HTML', () => {
    const html = renderToStaticMarkup(
      <MarketReportArticle
        report={{
          ...report,
          content: [{
            type: 'paragraph',
            content: [{ type: 'text', text: 'North Shore market commentary', styles: {} }],
          }, {
            type: 'image',
            props: {
              name: 'north-shore-market-chart-medianPrice',
              url: 'data:image/svg+xml,%3Csvg%3E%3C%2Fsvg%3E',
            },
          }] as unknown as MarketReportArticleData['content'],
        }}
      />,
    );

    expect(html).toContain('North Shore market commentary');
    expect(html).toContain('alt="North Shore vs Auckland Region median sale price trend chart, October 2026"');
  });

  it('renders Article structured data for public reports but not previews', () => {
    const publicHtml = renderToStaticMarkup(
      <MarketReportArticle report={{ ...report, publishedAt: '2026-11-15T12:00:00.000Z' }} />,
    );
    const previewHtml = renderToStaticMarkup(
      <MarketReportArticle report={{ ...report, publishedAt: '2026-11-15T12:00:00.000Z' }} preview />,
    );

    expect(publicHtml).toContain('"@type":"Article"');
    expect(publicHtml).toContain('"datePublished":"2026-11-15T12:00:00.000Z"');
    expect(publicHtml).toContain('"name":"Marie Nian"');
    expect(previewHtml).not.toContain('"@type":"Article"');
  });

  it('preserves empty editor paragraphs as visible spacing between report paragraphs', () => {
    render(
      <MarketReportArticle
        report={{
          ...report,
          content: [{
            type: 'paragraph',
            content: [{ type: 'text', text: 'First paragraph', styles: {} }],
          }, {
            type: 'paragraph',
            content: [],
          }, {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Second paragraph', styles: {} }],
          }] as unknown as MarketReportArticleData['content'],
        }}
      />,
    );

    const spacer = document.querySelector('.market-report-empty-paragraph');
    expect(spacer).toBeTruthy();
    expect(spacer?.querySelector('br')).toBeTruthy();
    expect(spacer?.getAttribute('aria-hidden')).toBe('true');
  });

  it('removes trailing empty editor paragraphs before the footer', () => {
    render(
      <MarketReportArticle
        report={{
          ...report,
          content: [{
            type: 'paragraph',
            content: [{ type: 'text', text: 'Final report paragraph', styles: {} }],
          }, {
            type: 'paragraph',
            content: [],
          }, {
            type: 'paragraph',
            content: [{ type: 'text', text: '  ', styles: {} }],
          }] as unknown as MarketReportArticleData['content'],
        }}
      />,
    );

    expect(document.querySelector('.market-report-richtext')?.textContent).toContain('Final report paragraph');
    expect(document.querySelector('.market-report-empty-paragraph')).toBeNull();
  });

  it('keeps the standard Note and renders the report Footer text below it', () => {
    render(
      <MarketReportArticle
        report={{
          ...report,
          footer: '© 2026 Marie Nian, custom copyright text.\nCustom publication disclaimer.',
        }}
      />,
    );

    expect(screen.getByTestId('public-header')).toBeTruthy();
    const footer = document.querySelector<HTMLElement>('.market-report-footer');
    const note = footer?.querySelector('.border-l-2');
    expect(note?.textContent).toContain('Market data reflects broad North Shore trends.');
    expect(note?.textContent).toContain('For a confidential, tailored valuation of your specific address,');
    expect(note?.textContent).not.toContain('custom copyright text.');

    expect(screen.getByRole('link', { name: 'Request a Free Property Appraisal' }).getAttribute('href'))
      .toBe('https://www.nzmarie.com/#appraisal');
    expect(screen.getByRole('link', { name: 'Download Your Suburb Report' }).getAttribute('href'))
      .toBe('https://www.nzmarie.com/#download-report');
    expect(screen.getByRole('link', { name: 'm.nian@barfoot.co.nz' }).getAttribute('href'))
      .toBe('mailto:m.nian@barfoot.co.nz');
    expect(screen.getByRole('link', { name: '021 0693 089' }).getAttribute('href'))
      .toBe('tel:+64210693089');

    expect(footer?.querySelector('footer')?.textContent)
      .toContain('© 2026 Marie Nian, custom copyright text.Custom publication disclaimer.');
    expect(footer?.querySelector('footer')?.textContent).not.toContain('Licensed Residential Sales');
    expect(document.querySelector('main')?.nextElementSibling).toBe(footer);
  });

  it('keeps the Chinese Note and renders the Chinese report Footer', () => {
    render(<MarketReportArticle
      report={{
        ...report,
        language: 'zh',
        footer: '© 2026 Marie Nian，版权自定义文本。\n自定义出版说明。',
      }}
    />);

    const footer = document.querySelector<HTMLElement>('.market-report-footer');
    const footerQueries = within(footer!);
    expect(footer?.textContent).toContain('说明：');
    expect(footer?.textContent).toContain('北岸市场数据反映整体趋势。');
    expect(footerQueries.getByRole('link', { name: '预约免费房产评估' }).getAttribute('href'))
      .toBe('https://www.nzmarie.com/cn#appraisal');
    expect(footerQueries.getByRole('link', { name: '下载专属子区报告' }).getAttribute('href'))
      .toBe('https://www.nzmarie.com/cn#download-report');
    expect(footer?.querySelector('footer')?.textContent)
      .toContain('© 2026 Marie Nian，版权自定义文本。自定义出版说明。');
  });
});

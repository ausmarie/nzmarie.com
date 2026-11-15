import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock('@/lib/db', () => ({ query: mocks.query }));

import {
  buildMarketReportArticleStructuredData,
  getMarketReportSitemap,
  getPublishedMarketReportMetadata,
} from '@/lib/market-report-seo';

describe('market report SEO metadata and sitemap', () => {
  beforeEach(() => mocks.query.mockReset());

  it('builds English metadata from the published report snapshot', async () => {
    mocks.query.mockResolvedValueOnce({
      rows: [{
        period_type: 'monthly',
        period_key: '2026-10',
        language: 'en',
        published_data_snapshot: { metrics: { medianPrice: 1_130_000, salesCount: 123 } },
        published_at: '2026-11-15T12:00:00.000Z',
      }],
    });

    const metadata = await getPublishedMarketReportMetadata('October-2026', 'en');

    expect(metadata.title).toBe('North Shore Market Report (October 2026) | NZ Marie');
    expect(metadata.description).toContain('median sale prices ($1.13M)');
    expect(metadata.description).toContain('sales volume (123 sales)');
    expect(metadata.alternates?.canonical).toBe('https://www.nzmarie.com/market-reports/october-2026');
    expect(metadata.openGraph?.url).toBe('https://www.nzmarie.com/market-reports/october-2026');
    expect(metadata.openGraph?.images).toEqual([expect.objectContaining({
      url: 'https://www.nzmarie.com/images/north_shore_house.png',
      alt: 'North Shore property market report cover',
    })]);
    expect(metadata.twitter?.images).toContain('https://www.nzmarie.com/images/north_shore_house.png');
    expect(mocks.query.mock.calls[0][1]).toEqual(['monthly', '2026-10', 'en']);
  });

  it('builds Chinese metadata with a self-referencing localized canonical', async () => {
    mocks.query.mockResolvedValueOnce({
      rows: [{
        period_type: 'monthly',
        period_key: '2026-10',
        language: 'zh',
        published_data_snapshot: { metrics: { medianPrice: 1_130_000 } },
        published_at: '2026-11-15T12:00:00.000Z',
      }],
    });

    const metadata = await getPublishedMarketReportMetadata('October-2026', 'zh');

    expect(metadata.title).toBe('奥克兰北岸房地产市场报告（2026年10月）| NZ Marie');
    expect(metadata.description).toContain('中位售价为 $1.13M');
    expect(metadata.alternates?.canonical).toBe('https://www.nzmarie.com/market-reports/october-2026/cn');
  });

  it('builds Article structured data with publication, author, publisher and cover image', () => {
    const structuredData = buildMarketReportArticleStructuredData({
      period_type: 'monthly',
      period_key: '2026-10',
      language: 'en',
      published_at: '2026-11-15T12:00:00.000Z',
      published_data_snapshot: { metrics: { medianPrice: 1_130_000, salesCount: 123 } },
    }, 'en');

    expect(structuredData).toMatchObject({
      '@type': 'Article',
      headline: 'North Shore Market Report (October 2026)',
      datePublished: '2026-11-15T12:00:00.000Z',
      author: { '@type': 'Person', name: 'Marie Nian' },
      publisher: { '@type': 'Organization', name: 'Barfoot & Thompson / NZ Marie' },
      image: ['https://www.nzmarie.com/images/north_shore_house.png'],
      mainEntityOfPage: { '@id': 'https://www.nzmarie.com/market-reports/october-2026' },
    });
  });

  it('omits Article structured data when no reliable publication date is available', () => {
    const structuredData = buildMarketReportArticleStructuredData({
      period_type: 'monthly',
      period_key: '2026-10',
      language: 'en',
      published_at: null,
    }, 'en');

    expect(structuredData).toBeNull();
  });

  it('does not query or index an invalid or unpublished report', async () => {
    const invalid = await getPublishedMarketReportMetadata('not-a-report', 'en');
    mocks.query.mockResolvedValueOnce({ rows: [] });
    const unpublished = await getPublishedMarketReportMetadata('October-2026', 'en');

    expect(invalid.robots).toEqual({ index: false, follow: false });
    expect(unpublished.robots).toEqual({ index: false, follow: false });
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });

  it('lists only valid published English and Chinese report URLs', async () => {
    mocks.query.mockResolvedValueOnce({
      rows: [
        {
          period_type: 'monthly',
          period_key: '2026-10',
          language: 'en',
          published_at: '2026-11-01T00:00:00.000Z',
        },
        {
          period_type: 'monthly',
          period_key: '2026-10',
          language: 'zh',
          published_at: null,
        },
        {
          period_type: 'monthly',
          period_key: '2026-13',
          language: 'en',
          published_at: null,
        },
      ],
    });

    const sitemap = await getMarketReportSitemap();

    expect(sitemap).toEqual([
      {
        url: 'https://www.nzmarie.com/market-reports/october-2026',
        lastModified: new Date('2026-11-01T00:00:00.000Z'),
      },
      { url: 'https://www.nzmarie.com/market-reports/october-2026/cn' },
    ]);
    expect(mocks.query.mock.calls[0][0]).toContain("status = 'published'");
  });
});

import { describe, expect, it, vi } from 'vitest';
import type { MarketReportSnapshot } from '@/lib/market-report-data';
import {
  getDefaultMarketReportArticleHeader,
  marketReportArticleMonthForDate,
  normalizeMarketReportArticleHeader,
  parseMarketReportArticleHeader,
  removeLegacyMarketReportArticleHeader,
} from '@/lib/market-report-article-header';
import type { ReportEditorContent } from '@/types/report';

const snapshot: MarketReportSnapshot = {
  periodType: 'monthly',
  periodKey: '2026-10',
  periodLabel: 'October 2026',
  generatedAt: '2026-11-01T00:00:00.000Z',
  source: 'REINZ',
  propertyType: 'House',
  metrics: { medianPrice: null, salesCount: 0, daysToSell: null },
  charts: { medianPrice: [], salesCount: [], daysToSell: [] },
  dataNotes: '',
};

describe('market report article header', () => {
  it('creates localized defaults and defaults the article month to the current New Zealand month', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-18T12:00:00.000Z'));
    try {
      expect(getDefaultMarketReportArticleHeader(snapshot, 'en')).toMatchObject({
        title: 'North Shore Market Report',
        subtitle: 'October 2026 Housing Market Update (Spring Edition)',
        author: 'Marie Nian',
        readingMinutes: 5,
        articleMonth: '2026-11',
      });
      expect(getDefaultMarketReportArticleHeader(snapshot, 'zh')).toMatchObject({
        title: '北岸房地产市场报告',
        subtitle: '2026年10月房地产市场更新（春季版）',
        articleMonth: '2026-11',
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('validates header metadata and strips legacy title, subtitle, and byline blocks', () => {
    const header = getDefaultMarketReportArticleHeader(snapshot, 'en');
    expect(parseMarketReportArticleHeader(header)).toEqual(header);
    expect(parseMarketReportArticleHeader({ ...header, articleMonth: '2026-13' })).toBeNull();
    expect(parseMarketReportArticleHeader({ ...header, readingMinutes: 0 })).toBeNull();
    expect(marketReportArticleMonthForDate('2026-10-31T12:00:00.000Z')).toBe('2026-11');
    expect(normalizeMarketReportArticleHeader({}, snapshot, 'en', '2024-09').articleMonth).toBe('2024-09');

    const content = [
      { type: 'heading', props: { level: 1 }, content: [{ type: 'text', text: 'Old title' }] },
      { type: 'heading', props: { level: 2 }, content: [{ type: 'text', text: 'Old subtitle' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'By Marie Nian • 5 min read • Nov 2026' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Report body' }] },
    ] as unknown as ReportEditorContent;

    expect(removeLegacyMarketReportArticleHeader(content)).toEqual([
      { type: 'paragraph', content: [{ type: 'text', text: 'Report body' }] },
    ]);

    const legacyRichHeader = [
      { type: 'heading', props: { level: 3 }, content: [{ type: 'text', text: 'October 2026 Housing Market Update (Spring Edition)' }] },
      { type: 'paragraph', content: [] },
      { type: 'quote', content: [{ type: 'text', text: 'By Marie Nian • Barfoot & Thompson • 5 min read • Nov 2026' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Report body' }] },
    ] as unknown as ReportEditorContent;

    expect(removeLegacyMarketReportArticleHeader(legacyRichHeader)).toEqual([
      { type: 'paragraph', content: [{ type: 'text', text: 'Report body' }] },
    ]);

    const bodyHeading = [
      { type: 'heading', props: { level: 1 }, content: [{ type: 'text', text: 'Old title' }] },
      { type: 'heading', props: { level: 2 }, content: [{ type: 'text', text: 'Market pulse' }] },
    ] as unknown as ReportEditorContent;
    expect(removeLegacyMarketReportArticleHeader(bodyHeading)).toEqual([bodyHeading[1]]);
  });
});

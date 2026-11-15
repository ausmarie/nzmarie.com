import { describe, expect, it } from 'vitest';
import {
  marketReportAdminPublicUrl,
  marketReportDraftPreviewUrl,
  marketReportDraftUrl,
  marketReportSlug,
  marketReportUrl,
  parseMarketReportLanguage,
  parseMarketReportSlug,
} from '@/lib/market-report-url';

describe('Market report URLs', () => {
  it('uses human-readable monthly and quarterly slugs', () => {
    expect(marketReportSlug('monthly', '2026-10')).toBe('October-2026');
    expect(marketReportSlug('quarterly', '2026-Q3')).toBe('Q3-2026');
  });

  it('sends drafts to preview URLs and published reports to public URLs', () => {
    expect(marketReportUrl({
      period_type: 'monthly',
      period_key: '2026-10',
      status: 'draft',
    })).toBe('/market-reports/preview/October-2026');
    expect(marketReportUrl({
      period_type: 'quarterly',
      period_key: '2026-Q3',
      status: 'published',
    })).toBe('/market-reports/Q3-2026');
  });

  it('creates admin editor, draft preview, and published-version URLs', () => {
    const report = {
      period_type: 'monthly' as const,
      period_key: '2026-10',
      status: 'published',
    };

    expect(marketReportDraftUrl(report)).toBe('/admin/market/draft/October-2026');
    expect(marketReportDraftPreviewUrl(report)).toBe('/admin/market/draft/October-2026/preview');
    expect(marketReportAdminPublicUrl(report)).toBe('/admin/market/public/October-2026');
  });

  it('uses the Chinese public URL suffix while keeping admin and preview URLs localized', () => {
    const report = {
      period_type: 'monthly' as const,
      period_key: '2026-10',
      status: 'published',
      language: 'zh' as const,
    };

    expect(marketReportDraftUrl(report)).toBe('/admin/market/draft/October-2026?lang=zh');
    expect(marketReportDraftPreviewUrl(report)).toBe('/admin/market/draft/October-2026/preview?lang=zh');
    expect(marketReportAdminPublicUrl(report)).toBe('/admin/market/public/October-2026?lang=zh');
    expect(marketReportUrl(report)).toBe('/market-reports/October-2026/cn');
  });

  it('parses month and quarter slugs and rejects invalid periods', () => {
    expect(parseMarketReportSlug('October-2026')).toEqual({
      periodType: 'monthly',
      periodKey: '2026-10',
    });
    expect(parseMarketReportSlug('Q3-2026')).toEqual({
      periodType: 'quarterly',
      periodKey: '2026-Q3',
    });
    expect(parseMarketReportSlug('Foo-2026')).toBeNull();
    expect(parseMarketReportSlug('Q5-2026')).toBeNull();
  });

  it('defaults missing language to English and rejects unsupported languages', () => {
    expect(parseMarketReportLanguage(undefined)).toBe('en');
    expect(parseMarketReportLanguage('zh')).toBe('zh');
    expect(parseMarketReportLanguage('fr')).toBeNull();
  });
});

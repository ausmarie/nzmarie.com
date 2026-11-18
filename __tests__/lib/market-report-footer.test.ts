import { describe, expect, it } from 'vitest';
import {
  getMarketReportDataNotes,
  type MarketReportSnapshot,
} from '@/lib/market-report-data';
import {
  getDefaultMarketReportFooter,
  resolveMarketReportFooter,
} from '@/lib/market-report-footer';

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

describe('Market report footer', () => {
  it('creates localized copyright and editorial footer text', () => {
    expect(getDefaultMarketReportFooter(snapshot, 'en')).toMatch(
      /^© \d{4} Marie Nian, Licensed Residential Sales, Barfoot & Thompson/,
    );
    expect(getDefaultMarketReportFooter(snapshot, 'en')).toContain(
      'This publication is independent editorial content provided for general reference only.',
    );
    expect(getDefaultMarketReportFooter(snapshot, 'zh')).toMatch(
      /^© \d{4} Marie Nian，持牌住宅销售顾问/,
    );
    expect(getDefaultMarketReportFooter(snapshot, 'zh')).toContain(
      '本出版物为独立编辑内容，仅供一般参考。',
    );
  });

  it('replaces previously generated default text while preserving custom footers', () => {
    const legacyDefault = [
      'Source: REINZ. Property type: House.',
      getMarketReportDataNotes('monthly', 'monthly', 'en'),
      'This report is an independent market analysis and is not a formal property valuation or financial advice.',
    ].join('\n');

    expect(resolveMarketReportFooter(legacyDefault, snapshot, 'en'))
      .toBe(getDefaultMarketReportFooter(snapshot, 'en'));
    expect(resolveMarketReportFooter('Custom legal footer.', snapshot, 'en'))
      .toBe('Custom legal footer.');
  });
});

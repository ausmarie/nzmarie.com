import {
  getMarketReportDataNotes,
  type MarketReportLanguage,
  type MarketReportSnapshot,
} from '@/lib/market-report-data';

function getLegacyDefaultMarketReportFooter(
  snapshot: MarketReportSnapshot,
  language: MarketReportLanguage,
): string {
  const chartPeriodType = snapshot.chartPeriodType ?? snapshot.periodType;
  return [
    language === 'zh'
      ? `数据来源：${snapshot.source}。房产类型：住宅。`
      : `Source: ${snapshot.source}. Property type: ${snapshot.propertyType}.`,
    getMarketReportDataNotes(snapshot.periodType, chartPeriodType, language),
    language === 'zh'
      ? '本报告为独立市场分析，不构成正式房产估价或财务建议。'
      : 'This report is an independent market analysis and is not a formal property valuation or financial advice.',
  ].filter(Boolean).join('\n');
}

export function getDefaultMarketReportFooter(
  _snapshot: MarketReportSnapshot,
  language: MarketReportLanguage = 'en',
): string {
  return [
    language === 'zh'
      ? `© ${new Date().getFullYear()} Marie Nian，持牌住宅销售顾问，Barfoot & Thompson（持有 REAA 2008 牌照）。`
      : `© ${new Date().getFullYear()} Marie Nian, Licensed Residential Sales, Barfoot & Thompson (Licensed under the REAA 2008).`,
    language === 'zh'
      ? '本出版物为独立编辑内容，仅供一般参考。'
      : 'This publication is independent editorial content provided for general reference only.',
  ].join('\n');
}

export function resolveMarketReportFooter(
  footer: string | null | undefined,
  snapshot: MarketReportSnapshot,
  language: MarketReportLanguage,
): string {
  const normalizedFooter = footer?.trim();
  if (!normalizedFooter || normalizedFooter === getLegacyDefaultMarketReportFooter(snapshot, language)) {
    return getDefaultMarketReportFooter(snapshot, language);
  }
  return normalizedFooter;
}

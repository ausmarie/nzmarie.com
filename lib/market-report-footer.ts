import {
  getMarketReportDataNotes,
  type MarketReportLanguage,
  type MarketReportSnapshot,
} from '@/lib/market-report-data';

const MARKET_REPORT_DISCLAIMER_EN =
  'This report is an independent market analysis and is not a formal property valuation or financial advice.';
const MARKET_REPORT_DISCLAIMER_ZH =
  '本报告为独立市场分析，不构成正式房产估价或财务建议。';

export function getDefaultMarketReportFooter(
  snapshot: MarketReportSnapshot,
  language: MarketReportLanguage = 'en',
): string {
  const chinese = language === 'zh';
  const chartPeriodType = snapshot.chartPeriodType ?? snapshot.periodType;
  return [
    chinese
      ? `数据来源：${snapshot.source}。房产类型：住宅。`
      : `Source: ${snapshot.source}. Property type: ${snapshot.propertyType}.`,
    getMarketReportDataNotes(snapshot.periodType, chartPeriodType, language),
    chinese ? MARKET_REPORT_DISCLAIMER_ZH : MARKET_REPORT_DISCLAIMER_EN,
  ].filter(Boolean).join('\n');
}

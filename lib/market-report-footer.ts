import type { MarketReportSnapshot } from '@/lib/market-report-data';

const MARKET_REPORT_DISCLAIMER =
  'This report is an independent market analysis and is not a formal property valuation or financial advice.';

export function getDefaultMarketReportFooter(snapshot: MarketReportSnapshot): string {
  return [
    `Source: ${snapshot.source}. Property type: ${snapshot.propertyType}.`,
    snapshot.dataNotes,
    MARKET_REPORT_DISCLAIMER,
  ].filter(Boolean).join('\n');
}

import {
  isValidMarketReportPeriod,
  type MarketReportLanguage,
  type MarketReportPeriodType,
} from '@/lib/market-report-data';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export interface MarketReportRoute {
  period_type: MarketReportPeriodType;
  period_key: string;
  status: string;
  language?: MarketReportLanguage;
}

export function parseMarketReportLanguage(value: unknown): MarketReportLanguage | null {
  if (value === undefined || value === 'en') return 'en';
  return value === 'zh' ? 'zh' : null;
}

function languageQuery(report: MarketReportRoute): string {
  return report.language === 'zh' ? '?lang=zh' : '';
}

function publishedLanguagePath(report: MarketReportRoute): string {
  return report.language === 'zh' ? '/cn' : '';
}

export function marketReportSlug(
  periodType: MarketReportPeriodType,
  periodKey: string,
): string {
  if (!isValidMarketReportPeriod(periodType, periodKey)) {
    throw new Error('Invalid Market report period.');
  }

  const [year, value] = periodKey.split(periodType === 'monthly' ? '-' : '-Q');
  if (periodType === 'monthly') {
    return `${MONTH_NAMES[Number(value) - 1]}-${year}`;
  }
  return `Q${value}-${year}`;
}

export function parseMarketReportSlug(
  slug: string,
): { periodType: MarketReportPeriodType; periodKey: string } | null {
  const monthMatch = /^([a-z]+)-(\d{4})$/i.exec(slug);
  if (monthMatch) {
    const monthIndex = MONTH_NAMES.findIndex(
      (month) => month.toLowerCase() === monthMatch[1].toLowerCase(),
    );
    if (monthIndex < 0) return null;
    const periodKey = `${monthMatch[2]}-${String(monthIndex + 1).padStart(2, '0')}`;
    return isValidMarketReportPeriod('monthly', periodKey)
      ? { periodType: 'monthly', periodKey }
      : null;
  }

  const quarterMatch = /^Q([1-4])-(\d{4})$/i.exec(slug);
  if (!quarterMatch) return null;
  const periodKey = `${quarterMatch[2]}-Q${quarterMatch[1]}`;
  return isValidMarketReportPeriod('quarterly', periodKey)
    ? { periodType: 'quarterly', periodKey }
    : null;
}

export function marketReportUrl(report: MarketReportRoute): string {
  const slug = marketReportSlug(report.period_type, report.period_key);
  return report.status === 'published'
    ? `/market-reports/${slug}${publishedLanguagePath(report)}`
    : `/market-reports/preview/${slug}${languageQuery(report)}`;
}

export function marketReportDraftUrl(report: MarketReportRoute): string {
  return `/admin/market/draft/${marketReportSlug(report.period_type, report.period_key)}${languageQuery(report)}`;
}

export function marketReportDraftPreviewUrl(report: MarketReportRoute): string {
  return `/admin/market/draft/${marketReportSlug(report.period_type, report.period_key)}/preview${languageQuery(report)}`;
}

export function marketReportAdminPublicUrl(report: MarketReportRoute): string {
  return `/admin/market/public/${marketReportSlug(report.period_type, report.period_key)}${languageQuery(report)}`;
}

export type ReportPeriodType = 'quarter' | 'month';

export interface ReportPeriodParts {
  periodType: ReportPeriodType;
  year: number;
  code: string;
  label: string;
  month: number | null;
  quarter: number | null;
}

export function monthCode(month: number): string {
  return `M${String(month).padStart(2, '0')}`;
}

export function isMonthCode(code: string | null | undefined): boolean {
  return !!code && /^M(0[1-9]|1[0-2])$/i.test(code.trim());
}

export function isQuarterCode(code: string | null | undefined): boolean {
  return !!code && /^Q[1-4]$/i.test(code.trim());
}

export function periodLabel(year: number, code: string): string {
  const normalized = (code || '').trim().toUpperCase();
  if (isMonthCode(normalized)) {
    return `${year}-${normalized.slice(1)}`;
  }
  return `${year}-${normalized}`;
}

export function reportDocumentPeriodKey(
  periodType: ReportPeriodType,
  year: number,
  month: number,
  quarter: string
): string {
  if (periodType === 'month') {
    return `${year}-${String(month).padStart(2, '0')}`;
  }
  return quarter;
}

export function parsePeriodParts(value?: string | null): ReportPeriodParts | null {
  if (!value) return null;
  const trimmed = value.trim().toUpperCase();
  const match = trimmed.match(/^(\d{4})[-_](Q[1-4]|M(?:0[1-9]|1[0-2])|(?:0[1-9]|1[0-2]))$/);
  if (!match) return null;

  const year = parseInt(match[1], 10);
  if (!year) return null;

  const rawCode = match[2];
  const code = /^\d{2}$/.test(rawCode) ? `M${rawCode}` : rawCode;
  const month = code.startsWith('M') ? parseInt(code.slice(1), 10) : null;
  const quarter = code.startsWith('Q') ? parseInt(code.slice(1), 10) : null;

  return {
    periodType: month ? 'month' : 'quarter',
    year,
    code,
    label: periodLabel(year, code),
    month,
    quarter,
  };
}

export function periodSortValue(value?: string | null): number {
  const parts = parsePeriodParts(value);
  if (!parts) return 0;

  const endMonth = parts.periodType === 'month' ? parts.month || 0 : (parts.quarter || 0) * 3;
  return parts.year * 10000 + endMonth * 100 + (parts.periodType === 'month' ? 1 : 0);
}

export function campaignPatternForPeriod(year: number, code: string): string {
  const normalized = (code || '').trim().toUpperCase();
  if (isMonthCode(normalized)) {
    const month = normalized.slice(1);
    return `^${year}[_-](M${month}|${month})`;
  }
  return `^${year}[_-]${normalized}`;
}

/**
 * Checks whether a campaign key (e.g. "2026_Q3_Torbay") belongs to a report
 * period key (e.g. "2026-Q3"). Campaign keys without a recognizable period are
 * treated as not matching.
 */
export function campaignMatchesPeriod(
  campaign: string | null | undefined,
  periodKey: string | null | undefined
): boolean {
  const parts = parsePeriodParts(periodKey);
  const value = (campaign || '').trim();
  if (!parts || !value) return false;

  return new RegExp(campaignPatternForPeriod(parts.year, parts.code), 'i').test(value);
}

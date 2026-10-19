import { campaignPatternForPeriod, parsePeriodParts } from '@/lib/report-period';

export interface QuarterInfo {
  quarter: string;
  year: number;
  key: string;
  campaignPattern: string;
}

export function parseReportQuarter(reportQuarter?: string | null): QuarterInfo | null {
  const parts = parsePeriodParts(reportQuarter);
  if (!parts) return null;

  return {
    quarter: parts.code,
    year: parts.year,
    key: parts.label,
    campaignPattern: campaignPatternForPeriod(parts.year, parts.code),
  };
}

export const parseReportPeriod = parseReportQuarter;

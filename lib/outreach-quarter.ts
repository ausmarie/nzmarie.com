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

export function campaignPeriodRangePredicate(
  column: string,
  period: QuarterInfo,
  params: unknown[]
): string {
  const suffixes = period.quarter.startsWith('M')
    ? [period.quarter, period.quarter.slice(1)]
    : [period.quarter];
  const prefixes = suffixes.flatMap((suffix) => [
    `${period.year}_${suffix}`,
    `${period.year}-${suffix}`,
  ]);

  return `(${prefixes.map((prefix) => {
    const lowerParam = params.length + 1;
    const lastCharacter = prefix.slice(-1);
    const upperPrefix = `${prefix.slice(0, -1)}${String.fromCharCode(lastCharacter.charCodeAt(0) + 1)}`;
    params.push(prefix, upperPrefix);
    return `(${column} >= $${lowerParam} AND ${column} < $${lowerParam + 1})`;
  }).join(' OR ')})`;
}

export const parseReportPeriod = parseReportQuarter;

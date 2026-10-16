export interface QuarterInfo {
  quarter: string;
  year: number;
  key: string;
  campaignPattern: string;
}

export function parseReportQuarter(reportQuarter?: string | null): QuarterInfo | null {
  if (!reportQuarter) return null;
  const parts = reportQuarter.split('-');
  if (parts.length !== 2) return null;
  if (!/^\d{4}$/.test(parts[0])) return null;
  const year = parseInt(parts[0], 10);
  const quarter = (parts[1] || '').toUpperCase();
  if (!year || !/^Q[1-4]$/.test(quarter)) return null;
  return {
    quarter,
    year,
    key: `${year}-${quarter}`,
    campaignPattern: `^${year}[_-]${quarter}`,
  };
}

const MONTH_SHORT: Record<string, string> = {
  '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr', '05': 'May', '06': 'Jun',
  '07': 'Jul', '08': 'Aug', '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec',
};

export interface TrendChartSourcePoint {
  period: string;
  cityMedian: number | null;
  suburbs: Record<string, { median: number | null }>;
}

export interface TrendChartRow {
  _label: string;
  _period: string;
  cityMedian?: number;
  [key: string]: number | string | undefined;
}

export type TrendChartMode = 'monthly' | 'quarterly';

export function buildMarketTrendRows(
  data: TrendChartSourcePoint[],
  suburbs: string[],
  mode: TrendChartMode
): TrendChartRow[] {
  if (mode === 'quarterly') {
    return data.map((d) => {
      const row: TrendChartRow = {
        _label: d.period,
        _period: d.period,
        cityMedian: d.cityMedian ?? undefined,
      };
      for (const s of suburbs) {
        if (d.suburbs[s]?.median != null) row[s] = d.suburbs[s]!.median!;
      }
      return row;
    });
  }

  let previousYear = '';
  return data.map((d) => {
    const [year, monthKey] = d.period.split('-');
    const month = MONTH_SHORT[monthKey] || monthKey;
    const showYear = monthKey === '01' || year !== previousYear;
    previousYear = year;
    const row: TrendChartRow = {
      _label: showYear ? `${year} ${month}` : month,
      _period: `${year} ${month}`,
      cityMedian: d.cityMedian ?? undefined,
    };
    for (const s of suburbs) {
      if (d.suburbs[s]?.median != null) row[s] = d.suburbs[s]!.median!;
    }
    return row;
  });
}

export const MONTHLY_POINT_WIDTH = 56;
export const QUARTERLY_POINT_WIDTH = 84;
export const MIN_CHART_WIDTH = 360;

export function marketTrendChartMinWidth(pointCount: number, mode: TrendChartMode): number {
  const perPoint = mode === 'monthly' ? MONTHLY_POINT_WIDTH : QUARTERLY_POINT_WIDTH;
  return Math.max(MIN_CHART_WIDTH, pointCount * perPoint);
}

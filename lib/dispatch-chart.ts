export type DispatchChartGranularity = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

const POINT_WIDTH: Record<DispatchChartGranularity, number> = {
  daily: 44,
  weekly: 60,
  monthly: 72,
  quarterly: 88,
  yearly: 96,
};

export const MIN_DISPATCH_CHART_WIDTH = 320;
export const MAX_DISPATCH_POINT_WIDTH = 200;

export function dispatchChartMinWidth(
  pointCount: number,
  granularity: DispatchChartGranularity
): number {
  return Math.max(MIN_DISPATCH_CHART_WIDTH, pointCount * POINT_WIDTH[granularity]);
}

export function dispatchChartMaxWidth(pointCount: number): number {
  return Math.max(MIN_DISPATCH_CHART_WIDTH, pointCount * MAX_DISPATCH_POINT_WIDTH);
}

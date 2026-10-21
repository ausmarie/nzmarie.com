import { describe, it, expect } from 'vitest';
import {
  dispatchChartMaxWidth,
  dispatchChartMinWidth,
  MIN_DISPATCH_CHART_WIDTH,
} from '@/lib/dispatch-chart';

describe('dispatchChartMinWidth', () => {
  it('keeps a minimum width for a short series', () => {
    expect(dispatchChartMinWidth(0, 'daily')).toBe(MIN_DISPATCH_CHART_WIDTH);
    expect(dispatchChartMinWidth(2, 'quarterly')).toBe(MIN_DISPATCH_CHART_WIDTH);
  });

  it('grows with the number of daily buckets', () => {
    expect(dispatchChartMinWidth(30, 'daily')).toBe(30 * 44);
  });

  it('uses wider steps for coarser granularity', () => {
    expect(dispatchChartMinWidth(10, 'weekly')).toBe(10 * 60);
    expect(dispatchChartMinWidth(10, 'monthly')).toBe(10 * 72);
    expect(dispatchChartMinWidth(10, 'quarterly')).toBe(10 * 88);
    expect(dispatchChartMinWidth(10, 'yearly')).toBe(10 * 96);
  });
});

describe('dispatchChartMaxWidth', () => {
  it('keeps a minimum width for very short series', () => {
    expect(dispatchChartMaxWidth(1)).toBe(MIN_DISPATCH_CHART_WIDTH);
    expect(dispatchChartMaxWidth(2)).toBe(400);
  });

  it('limits how wide each bucket can stretch', () => {
    expect(dispatchChartMaxWidth(3)).toBe(600);
    expect(dispatchChartMaxWidth(10)).toBe(2000);
  });
});

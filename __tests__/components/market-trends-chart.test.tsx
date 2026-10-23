import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, waitFor, cleanup } from '@testing-library/react';
import React from 'react';

const renderedLineProps = vi.hoisted(() => [] as Array<Record<string, unknown>>);

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => children,
  LineChart: ({ children }: { children?: React.ReactNode }) => children,
  Line: (props: Record<string, unknown>) => {
    renderedLineProps.push(props);
    return null;
  },
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
}));

import MarketTrendsChart from '@/components/admin/MarketTrendsChart';

const makePoint = (period: string) => ({
  period,
  periodRaw: period,
  cityMedian: 1_000_000,
  citySales: 10,
  cityDays: 30,
  suburbs: {
    Oteha: { median: 900_000, sales: 5, days: 25 },
  },
});

const chartProps = {
  suburbs: ['Oteha'],
  district: 'North Shore City',
  suburbColors: { Oteha: '#2563EB' },
  showDistrict: true,
};

describe('MarketTrendsChart scroll position', () => {
  afterEach(() => {
    cleanup();
    renderedLineProps.length = 0;
    vi.restoreAllMocks();
  });

  it('scrolls to the newest data on load and after data changes', async () => {
    let scrollWidth = 1000;
    let clientWidth = 300;

    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(() => scrollWidth);
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => clientWidth);

    const initialData = Array.from({ length: 10 }, (_, index) => makePoint(`2025-${String(index + 1).padStart(2, '0')}`));
    const { rerender, getByTestId } = render(
      <MarketTrendsChart {...chartProps} data={initialData} mode="monthly" />
    );

    await waitFor(() => {
      expect(getByTestId('market-trends-scroll').scrollLeft).toBe(700);
    });

    scrollWidth = 1400;
    clientWidth = 200;
    const nextData = Array.from({ length: 12 }, (_, index) => makePoint(`2025-${String(index + 1).padStart(2, '0')}`));

    rerender(<MarketTrendsChart {...chartProps} data={nextData} mode="quarterly" />);

    await waitFor(() => {
      expect(getByTestId('market-trends-scroll').scrollLeft).toBe(1200);
    });
  });

  it('renders lines without animation when the range changes', () => {
    render(
      <MarketTrendsChart
        {...chartProps}
        data={[makePoint('2026-01'), makePoint('2026-02')]}
        mode="monthly"
      />
    );

    expect(renderedLineProps.length).toBe(2);
    expect(renderedLineProps.every((props) => props.isAnimationActive === false)).toBe(true);
  });
});

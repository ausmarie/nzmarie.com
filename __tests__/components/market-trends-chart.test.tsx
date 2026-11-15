import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
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
  districts: {
    'North Shore City': { median: 1_000_000, sales: 10, days: 30 },
    'Auckland Region': { median: 1_500_000, sales: 20, days: 40 },
  },
  suburbs: {
    Oteha: { median: 900_000, sales: 5, days: 25 },
  },
});

const chartProps = {
  suburbs: ['Oteha'],
  districts: ['North Shore City'],
  suburbColors: { Oteha: '#2563EB' },
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

  it('styles Auckland Region as a blue primary line', () => {
    render(
      <MarketTrendsChart
        data={[makePoint('2026-01')]}
        suburbs={[]}
        districts={['Auckland Region']}
        mode="monthly"
        suburbColors={{}}
      />
    );

    expect(screen.getByText('Auckland Region Monthly Median Price')).toBeDefined();
    expect(renderedLineProps[0]).toMatchObject({
      name: 'Auckland Region',
      stroke: '#1E3A8A',
      strokeWidth: 3,
    });
  });

  it('renders Auckland Region and North Shore as separate comparison lines', () => {
    render(
      <MarketTrendsChart
        data={[makePoint('2026-01')]}
        suburbs={[]}
        districts={['Auckland Region', 'North Shore City']}
        mode="monthly"
        suburbColors={{}}
      />
    );

    expect(screen.getByText('Auckland Region vs North Shore Monthly Median Price')).toBeDefined();
    expect(renderedLineProps).toHaveLength(2);
    expect(renderedLineProps[0]).toMatchObject({ name: 'Auckland Region', stroke: '#1E3A8A' });
    expect(renderedLineProps[1]).toMatchObject({
      name: 'North Shore',
      stroke: '#94A3B8',
      strokeDasharray: '5 5',
    });
  });
});

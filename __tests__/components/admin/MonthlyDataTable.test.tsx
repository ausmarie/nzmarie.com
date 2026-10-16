import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import MonthlyDataTable from '../../../components/admin/MonthlyDataTable';
import type { MonthlyDataPoint, SuburbDetail } from '../../../lib/market-data-aggregator';

function makeDetail(overrides: Partial<SuburbDetail> = {}): SuburbDetail {
  return {
    median: 1000000,
    sales: 10,
    days: 30,
    priceDiffMomPct: 2.3,
    priceDiff1yrPct: 8.5,
    medianListPrice: 1200000,
    saleToValuationPct: 98,
    listToValuationPct: 115,
    totalVolume: 24500000,
    medianPrice1yrPrior: 920000,
    medianPrice3yrsPrior: 800000,
    priceDiff3yrsPct: 25,
    housePriceIndex: 1850,
    ...overrides,
  };
}

const mockData: MonthlyDataPoint[] = [
  {
    period: '2025-01',
    periodRaw: '2025-01-01',
    cityMedian: 900000,
    citySales: 50,
    cityDays: 35,
    cityDetail: makeDetail({ median: 900000, sales: 50, days: 35, totalVolume: 45000000 }),
    suburbs: {
      Oteha: makeDetail({ median: 1000000, sales: 10, days: 30, totalVolume: 10000000 }),
      Albany: makeDetail({ median: 950000, sales: 8, days: 28, totalVolume: 8000000 }),
    },
  },
  {
    period: '2025-02',
    periodRaw: '2025-02-01',
    cityMedian: 920000,
    citySales: 55,
    cityDays: 33,
    cityDetail: makeDetail({ median: 920000, sales: 55, days: 33, totalVolume: 50000000 }),
    suburbs: {
      Oteha: makeDetail({ median: 1100000, sales: 12, days: 28, totalVolume: 13000000 }),
      Albany: makeDetail({ median: 960000, sales: 9, days: 26, totalVolume: 9000000 }),
    },
  },
  {
    period: '2025-03',
    periodRaw: '2025-03-01',
    cityMedian: 910000,
    citySales: 45,
    cityDays: 34,
    cityDetail: makeDetail({ median: 910000, sales: 45, days: 34, totalVolume: 42000000 }),
    suburbs: {
      Oteha: makeDetail({ median: 1050000, sales: 8, days: 32, totalVolume: 8500000 }),
      Albany: makeDetail({ median: 940000, sales: 7, days: 30, totalVolume: 7000000 }),
    },
  },
];

const availableSuburbs = ['Oteha', 'Albany', 'Browns Bay'];

describe('MonthlyDataTable', () => {
  const onModeChange = vi.fn();
  const onFocusChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the title and mode toggle', () => {
    render(
      <MonthlyDataTable
        monthlyData={mockData}
        dataMode="monthly"
        onModeChange={onModeChange}
        activeFocusSuburb="Oteha"
        availableSuburbs={availableSuburbs}
        onFocusChange={onFocusChange}
      />
    );

    expect(screen.getByText('Analysis Data')).toBeDefined();
    expect(screen.getByText('Monthly')).toBeDefined();
    expect(screen.getByText('Quarterly')).toBeDefined();
  });

  it('renders suburb buttons with single-select highlighting', () => {
    render(
      <MonthlyDataTable
        monthlyData={mockData}
        dataMode="monthly"
        onModeChange={onModeChange}
        activeFocusSuburb="Albany"
        availableSuburbs={availableSuburbs}
        onFocusChange={onFocusChange}
      />
    );

    expect(screen.getByText('Albany')).toBeDefined();
    expect(screen.getByText('Oteha')).toBeDefined();
    expect(screen.getByText('Browns Bay')).toBeDefined();
  });

  it('renders North Shore City button', () => {
    render(
      <MonthlyDataTable
        monthlyData={mockData}
        dataMode="monthly"
        onModeChange={onModeChange}
        activeFocusSuburb="Oteha"
        availableSuburbs={availableSuburbs}
        onFocusChange={onFocusChange}
      />
    );

    expect(screen.getByRole('button', { name: /North Shore/ })).toBeDefined();
  });

  it('renders new column headers', () => {
    render(
      <MonthlyDataTable
        monthlyData={mockData}
        dataMode="monthly"
        onModeChange={onModeChange}
        activeFocusSuburb="Oteha"
        availableSuburbs={availableSuburbs}
        onFocusChange={onFocusChange}
      />
    );

    expect(screen.getByText('Period')).toBeDefined();
    expect(screen.getByText('Median Price')).toBeDefined();
    expect(screen.getByText('List vs Sold')).toBeDefined();
    expect(screen.getByText('Sale / CV %')).toBeDefined();
    expect(screen.getByText('Volume / Pace')).toBeDefined();
    expect(screen.getByText('Market Size')).toBeDefined();
    expect(screen.getByText('(Month/Qtr)')).toBeDefined();
    expect(screen.getByText('MoM / YoY Trend')).toBeDefined();
    expect(screen.getByText('Market Gap %')).toBeDefined();
    expect(screen.getByText('(vs Valuation)')).toBeDefined();
    expect(screen.getByText('Sales | Days')).toBeDefined();
    expect(screen.getByText('Total Volume')).toBeDefined();
  });

  it('formats prices with $ and commas', () => {
    render(
      <MonthlyDataTable
        monthlyData={mockData}
        dataMode="monthly"
        onModeChange={onModeChange}
        activeFocusSuburb="Oteha"
        availableSuburbs={availableSuburbs}
        onFocusChange={onFocusChange}
      />
    );

    expect(screen.getByText('$1,000,000')).toBeDefined();
  });

  it('shows MoM and YoY percentages', () => {
    render(
      <MonthlyDataTable
        monthlyData={mockData}
        dataMode="monthly"
        onModeChange={onModeChange}
        activeFocusSuburb="Oteha"
        availableSuburbs={availableSuburbs}
        onFocusChange={onFocusChange}
      />
    );

    expect(screen.getAllByText(/MoM \+2\.3%/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/YoY \+8\.5%/).length).toBeGreaterThanOrEqual(1);
  });

  it('shows Price Gap with list vs sale', () => {
    render(
      <MonthlyDataTable
        monthlyData={mockData}
        dataMode="monthly"
        onModeChange={onModeChange}
        activeFocusSuburb="Oteha"
        availableSuburbs={availableSuburbs}
        onFocusChange={onFocusChange}
      />
    );

    expect(screen.getAllByText(/\$1\.2M/).length).toBeGreaterThanOrEqual(1);
  });

  it('shows Valuation Ratio with color class for buyer market', () => {
    render(
      <MonthlyDataTable
        monthlyData={mockData}
        dataMode="monthly"
        onModeChange={onModeChange}
        activeFocusSuburb="Oteha"
        availableSuburbs={availableSuburbs}
        onFocusChange={onFocusChange}
      />
    );

    expect(screen.getAllByText('98%').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Buyer market').length).toBeGreaterThanOrEqual(1);
  });

  it('shows Liquidity with sales count and days', () => {
    render(
      <MonthlyDataTable
        monthlyData={mockData}
        dataMode="monthly"
        onModeChange={onModeChange}
        activeFocusSuburb="Oteha"
        availableSuburbs={availableSuburbs}
        onFocusChange={onFocusChange}
      />
    );

    expect(screen.getByText('10')).toBeDefined();
    expect(screen.getByText('30 days')).toBeDefined();
  });

  it('shows Market Size with short price format', () => {
    render(
      <MonthlyDataTable
        monthlyData={mockData}
        dataMode="monthly"
        onModeChange={onModeChange}
        activeFocusSuburb="Oteha"
        availableSuburbs={availableSuburbs}
        onFocusChange={onFocusChange}
      />
    );

    expect(screen.getByText('$10.0M')).toBeDefined();
  });

  it('calls onFocusChange when a suburb button is clicked', () => {
    render(
      <MonthlyDataTable
        monthlyData={mockData}
        dataMode="monthly"
        onModeChange={onModeChange}
        activeFocusSuburb="Oteha"
        availableSuburbs={availableSuburbs}
        onFocusChange={onFocusChange}
      />
    );

    fireEvent.click(screen.getByText('Albany'));
    expect(onFocusChange).toHaveBeenCalledWith('Albany');
  });

  it('calls onFocusChange with North Shore City when district button is clicked', () => {
    render(
      <MonthlyDataTable
        monthlyData={mockData}
        dataMode="monthly"
        onModeChange={onModeChange}
        activeFocusSuburb="Oteha"
        availableSuburbs={availableSuburbs}
        onFocusChange={onFocusChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /North Shore/ }));
    expect(onFocusChange).toHaveBeenCalledWith('North Shore City');
  });

  it('calls onModeChange when toggle is clicked', () => {
    render(
      <MonthlyDataTable
        monthlyData={mockData}
        dataMode="monthly"
        onModeChange={onModeChange}
        activeFocusSuburb="Oteha"
        availableSuburbs={availableSuburbs}
        onFocusChange={onFocusChange}
      />
    );

    fireEvent.click(screen.getByText('Quarterly'));
    expect(onModeChange).toHaveBeenCalledWith('quarterly');
  });

  it('opens AI Copilot drawer on row click', () => {
    render(
      <MonthlyDataTable
        monthlyData={mockData}
        dataMode="monthly"
        onModeChange={onModeChange}
        activeFocusSuburb="Oteha"
        availableSuburbs={availableSuburbs}
        onFocusChange={onFocusChange}
      />
    );

    const firstRow = screen.getByText('2025-03');
    fireEvent.click(firstRow);

    expect(screen.getByText(/AI Copilot/)).toBeDefined();
    expect(screen.getByText(/Landlord Script/)).toBeDefined();
    expect(screen.getByText(/Buyer Script/)).toBeDefined();
    expect(screen.getByText(/Market Insight/)).toBeDefined();
  });

  it('closes AI Copilot drawer on close button', () => {
    render(
      <MonthlyDataTable
        monthlyData={mockData}
        dataMode="monthly"
        onModeChange={onModeChange}
        activeFocusSuburb="Oteha"
        availableSuburbs={availableSuburbs}
        onFocusChange={onFocusChange}
      />
    );

    const firstRow = screen.getByText('2025-03');
    fireEvent.click(firstRow);
    expect(screen.getByText(/AI Copilot/)).toBeDefined();

    fireEvent.click(screen.getByText('Close'));
    expect(screen.queryByText(/AI Copilot/)).toBeNull();
  });

  it('renders quarterly data when mode is quarterly', () => {
    render(
      <MonthlyDataTable
        monthlyData={mockData}
        dataMode="quarterly"
        onModeChange={onModeChange}
        activeFocusSuburb="Oteha"
        availableSuburbs={availableSuburbs}
        onFocusChange={onFocusChange}
      />
    );

    expect(screen.getByText('2025-Q1')).toBeDefined();
  });

  it('shows table when suburb has sales but no median price', () => {
    const dataWithNullMedian: MonthlyDataPoint[] = [
      {
        period: '2025-01',
        periodRaw: '2025-01-01',
        cityMedian: 900000,
        citySales: 50,
        cityDays: 35,
        cityDetail: null,
        suburbs: {
          'Stanley Point': {
            median: null,
            sales: 3,
            days: null,
            priceDiffMomPct: null,
            priceDiff1yrPct: null,
            medianListPrice: null,
            saleToValuationPct: null,
            listToValuationPct: null,
            totalVolume: null,
            medianPrice1yrPrior: null,
            medianPrice3yrsPrior: null,
            priceDiff3yrsPct: null,
            housePriceIndex: null,
          },
        },
      },
    ];
    render(
      <MonthlyDataTable
        monthlyData={dataWithNullMedian}
        dataMode="monthly"
        onModeChange={onModeChange}
        activeFocusSuburb="Stanley Point"
        availableSuburbs={['Stanley Point']}
        onFocusChange={onFocusChange}
      />
    );

    expect(screen.queryByText(/No detailed data available/)).toBeNull();
    expect(screen.getByText('3')).toBeDefined();
  });

  it('shows empty state when no data', () => {
    render(
      <MonthlyDataTable
        monthlyData={[]}
        dataMode="monthly"
        onModeChange={onModeChange}
        activeFocusSuburb="Oteha"
        availableSuburbs={availableSuburbs}
        onFocusChange={onFocusChange}
      />
    );

    expect(screen.getByText(/No market data yet/)).toBeDefined();
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import React from 'react';
import ScanTrendsChart from '../../../components/admin/ScanTrendsChart';

const originalConsoleError = console.error;

vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="responsive-container">{children}</div>
    ),
    AreaChart: ({ children, onClick, data }: { children: React.ReactNode; onClick?: (e: unknown) => void; data?: unknown[] }) => (
      <div data-testid="area-chart" data-points={data?.length ?? 0} onClick={() => onClick?.({ activeLabel: '2026-07-25', activeDataKey: 'campaign_a' })}>
        {children}
      </div>
    ),
    Area: ({ dataKey, name }: { dataKey: string; name: string }) => (
      <div data-testid={`area-${dataKey}`} data-name={name} />
    ),
    XAxis: () => <div data-testid="x-axis" />,
    YAxis: () => <div data-testid="y-axis" />,
    CartesianGrid: () => <div data-testid="cart-grid" />,
    Tooltip: () => <div data-testid="tooltip" />,
    Legend: ({ onClick }: { onClick?: (e: unknown) => void }) => (
      <div data-testid="legend" onClick={() => onClick?.({ dataKey: 'campaign_a' })} />
    ),
    defs: () => null,
    linearGradient: () => null,
  };
});

const mockData = {
  success: true,
  data: [
    { time: '2026-07-25', campaign_a: 5, campaign_b: 3 },
    { time: '2026-07-26', campaign_a: 8, campaign_b: 2 },
    { time: '2026-07-27', campaign_a: 4, campaign_b: 6 },
  ],
  campaigns: [
    { key: 'campaign_a', name: 'Campaign A' },
    { key: 'campaign_b', name: 'Campaign B' },
  ],
  isSubDay: false,
};

beforeEach(() => {
  console.error = vi.fn((msg: string, ...args: unknown[]) => {
    if (
      String(msg).includes('linearGradient') ||
      String(msg).includes('incorrect casing') ||
      String(msg).includes('unrecognized') ||
      String(msg).includes('uppercase letter')
    ) return;
    originalConsoleError(msg, ...args);
  });
  global.fetch = vi.fn().mockResolvedValue({
    json: () => Promise.resolve(mockData),
  });
});

afterEach(() => {
  console.error = originalConsoleError;
  cleanup();
  vi.restoreAllMocks();
});

describe('ScanTrendsChart', () => {
  describe('initial render', () => {
    it('renders title', () => {
      render(<ScanTrendsChart onDrillDown={() => {}} />);
      expect(screen.getByText('Scan Trends')).toBeTruthy();
    });

    it('renders all time range buttons', () => {
      render(<ScanTrendsChart onDrillDown={() => {}} />);
      for (const r of ['1h', '6h', '1d', '2d', '1w', '2w', '1m', '2m', '3m', '6m', '1y']) {
        expect(screen.getByText(r)).toBeTruthy();
      }
    });

    it('defaults to 1m range active', () => {
      render(<ScanTrendsChart onDrillDown={() => {}} />);
      const btn = screen.getByText('1m');
      expect(btn.className).toContain('bg-blue-600');
    });

    it('shows loading state immediately on mount', () => {
      render(<ScanTrendsChart onDrillDown={() => {}} />);
      expect(screen.getByText('Loading chart data...')).toBeTruthy();
    });
  });

  describe('after data loads', () => {
    it('renders campaign toggle buttons', async () => {
      render(<ScanTrendsChart onDrillDown={() => {}} />);
      await waitFor(() => {
        expect(screen.getByText('Campaign A')).toBeTruthy();
        expect(screen.getByText('Campaign B')).toBeTruthy();
      });
    });

    it('no longer shows loading state', async () => {
      render(<ScanTrendsChart onDrillDown={() => {}} />);
      await waitFor(() => expect(screen.getByText('Campaign A')).toBeTruthy());
      expect(screen.queryByText('Loading chart data...')).toBeNull();
    });

    it('renders the AreaChart container', async () => {
      render(<ScanTrendsChart onDrillDown={() => {}} />);
      await waitFor(() => expect(screen.getByTestId('area-chart')).toBeTruthy());
    });

    it('renders an Area series per visible campaign', async () => {
      render(<ScanTrendsChart onDrillDown={() => {}} />);
      await waitFor(() => {
        expect(screen.getByTestId('area-campaign_a')).toBeTruthy();
        expect(screen.getByTestId('area-campaign_b')).toBeTruthy();
      });
    });

    it('does not show empty state when data is present', async () => {
      render(<ScanTrendsChart onDrillDown={() => {}} />);
      await waitFor(() => expect(screen.getByTestId('area-chart')).toBeTruthy());
      expect(screen.queryByText('No scan data yet for this time range.')).toBeNull();
    });

    it('fetches with correct default range', async () => {
      render(<ScanTrendsChart onDrillDown={() => {}} />);
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/admin/analytics/scan-trends?range=1m');
      });
    });
  });

  describe('empty state', () => {
    it('shows empty state message when data is empty', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ success: true, data: [], campaigns: [], isSubDay: false }),
      });
      render(<ScanTrendsChart onDrillDown={() => {}} />);
      await waitFor(() => {
        expect(screen.getByText('No scan data yet for this time range.')).toBeTruthy();
      });
    });

    it('does not render AreaChart when data is empty', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ success: true, data: [], campaigns: [], isSubDay: false }),
      });
      render(<ScanTrendsChart onDrillDown={() => {}} />);
      await waitFor(() => expect(screen.getByText('No scan data yet for this time range.')).toBeTruthy());
      expect(screen.queryByTestId('area-chart')).toBeNull();
    });
  });

  describe('time range selector', () => {
    it('activates the clicked range button', async () => {
      render(<ScanTrendsChart onDrillDown={() => {}} />);
      const btn = screen.getByText('1w');
      fireEvent.click(btn);
      expect(btn.className).toContain('bg-blue-600');
    });

    it('deactivates previous range button on change', async () => {
      render(<ScanTrendsChart onDrillDown={() => {}} />);
      fireEvent.click(screen.getByText('1w'));
      expect(screen.getByText('1m').className).not.toContain('bg-blue-600');
    });

    it('re-fetches with the new range on click', async () => {
      render(<ScanTrendsChart onDrillDown={() => {}} />);
      await waitFor(() => expect(screen.getByText('1y')).toBeTruthy());
      fireEvent.click(screen.getByText('1y'));
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/admin/analytics/scan-trends?range=1y');
      });
    });
  });

  describe('campaign toggles', () => {
    it('hides a campaign when its toggle is clicked', async () => {
      render(<ScanTrendsChart onDrillDown={() => {}} />);
      await waitFor(() => expect(screen.getByText('Campaign A')).toBeTruthy());
      fireEvent.click(screen.getByText('Campaign A').closest('button')!);
      await waitFor(() => expect(screen.queryByTestId('area-campaign_a')).toBeNull());
    });

    it('allows hiding all campaigns to view New Devices alone', async () => {
      render(<ScanTrendsChart onDrillDown={() => {}} />);
      await waitFor(() => expect(screen.getByText('Campaign A')).toBeTruthy());
      fireEvent.click(screen.getByText('Campaign B').closest('button')!);
      fireEvent.click(screen.getByText('Campaign A').closest('button')!);
      // All campaigns hidden, but New Devices area remains
      expect(screen.queryByTestId('area-campaign_a')).toBeNull();
      expect(screen.queryByTestId('area-campaign_b')).toBeNull();
      expect(screen.getByTestId('area-newDevices')).toBeTruthy();
    });

    it('prevents hiding the last visible campaign when New Devices is disabled', async () => {
      render(<ScanTrendsChart onDrillDown={() => {}} />);
      await waitFor(() => expect(screen.getByText('New Devices')).toBeTruthy());
      // Turn off New Devices first
      fireEvent.click(screen.getByText('New Devices').closest('button')!);
      // Now hide Campaign B
      fireEvent.click(screen.getByText('Campaign B').closest('button')!);
      // Trying to hide Campaign A (the last campaign) should be prevented
      fireEvent.click(screen.getByText('Campaign A').closest('button')!);
      expect(screen.getByTestId('area-campaign_a')).toBeTruthy();
    });

    it('re-shows a campaign when its toggle is clicked again', async () => {
      render(<ScanTrendsChart onDrillDown={() => {}} />);
      await waitFor(() => expect(screen.getByText('Campaign A')).toBeTruthy());
      const btnA = screen.getByText('Campaign A').closest('button')!;
      fireEvent.click(btnA);
      await waitFor(() => expect(screen.queryByTestId('area-campaign_a')).toBeNull());
      fireEvent.click(btnA);
      await waitFor(() => expect(screen.getByTestId('area-campaign_a')).toBeTruthy());
    });
  });

  describe('drilldown callback', () => {
    it('calls onDrillDown with date and campaign key when chart is clicked', async () => {
      const onDrillDown = vi.fn();
      render(<ScanTrendsChart onDrillDown={onDrillDown} />);
      await waitFor(() => expect(screen.getByTestId('area-chart')).toBeTruthy());
      fireEvent.click(screen.getByTestId('area-chart'));
      expect(onDrillDown).toHaveBeenCalledWith('2026-07-25', 'campaign_a');
    });
  });

  describe('sub-day format', () => {
    it('renders campaign series for sub-day data', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        json: () => Promise.resolve({
          success: true,
          data: [
            { time: '2026-07-27T10:00:00.000Z', campaign_a: 2 },
            { time: '2026-07-27T11:00:00.000Z', campaign_a: 5 },
          ],
          campaigns: [{ key: 'campaign_a', name: 'Campaign A' }],
          isSubDay: true,
        }),
      });
      render(<ScanTrendsChart onDrillDown={() => {}} />);
      await waitFor(() => {
        expect(screen.getByText('Campaign A')).toBeTruthy();
        expect(screen.getByTestId('area-campaign_a')).toBeTruthy();
      });
    });

    it('calls onDrillDown with ISO date for sub-day data', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        json: () => Promise.resolve({
          success: true,
          data: [{ time: '2026-07-27T10:00:00.000Z', campaign_a: 2 }],
          campaigns: [{ key: 'campaign_a', name: 'Campaign A' }],
          isSubDay: true,
        }),
      });
      const onDrillDown = vi.fn();
      render(<ScanTrendsChart onDrillDown={onDrillDown} />);
      await waitFor(() => expect(screen.getByTestId('area-chart')).toBeTruthy());
      fireEvent.click(screen.getByTestId('area-chart'));
      expect(onDrillDown).toHaveBeenCalledWith('2026-07-25', 'campaign_a');
    });
  });

  describe('fetch error handling', () => {
    it('stays in empty-data state when fetch throws', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('network error'));
      render(<ScanTrendsChart onDrillDown={() => {}} />);
      await waitFor(() => {
        expect(screen.queryByText('Loading chart data...')).toBeNull();
      });
      expect(screen.getByText('No scan data yet for this time range.')).toBeTruthy();
    });

    it('stays in empty-data state when API returns success:false', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ success: false }),
      });
      render(<ScanTrendsChart onDrillDown={() => {}} />);
      await waitFor(() => {
        expect(screen.queryByText('Loading chart data...')).toBeNull();
      });
      expect(screen.getByText('No scan data yet for this time range.')).toBeTruthy();
    });
  });
});

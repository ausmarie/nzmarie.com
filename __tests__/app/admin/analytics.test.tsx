import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

let chartDataCalls = 0;
let chartDataResponse: any = { success: true, data: { monthlyData: [], quarterlyData: [] } };
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const createQueryClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockSession = { user: { email: 'nzmarie.com@gmail.com' } };
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: mockSession, status: 'authenticated' }),
}));

vi.mock('@/components/admin/Skeleton', () => ({
  SkeletonAnalytics: () => <div>Loading Analytics</div>,
}));

vi.mock('@/components/admin/MarketTrendsChart', () => ({
  default: ({ data }: any) => (
    <div data-testid="market-trends-chart">{data.map((point: { period: string }) => point.period).join(',')}</div>
  ),
}));

vi.mock('@/components/admin/ExcelUploadForm', () => ({
  default: () => <div>ExcelUploadForm Mock</div>,
}));

const mockOnFocusChange = vi.fn();

vi.mock('@/components/admin/MonthlyDataTable', () => ({
  default: ({ onFocusChange, availableSuburbs, activeFocusSuburb }: any) => {
    mockOnFocusChange.mockImplementation(onFocusChange);
    return (
      <div data-testid="monthly-data-table">
        {availableSuburbs.map((s: string) => {
          const active = activeFocusSuburb === s;
          const color = '#2563EB';
          return (
            <button
              key={s}
              onClick={() => onFocusChange(s)}
              data-testid={`ad-btn-${s}`}
              className={active ? 'text-white shadow-sm' : 'text-gray-600'}
              style={active ? { backgroundColor: color, borderColor: color } : undefined}
            >
              {s}
            </button>
          );
        })}
        <button
          onClick={() => onFocusChange('North Shore City')}
          data-testid="ad-btn-north-shore"
          className={activeFocusSuburb === 'North Shore City' ? 'text-white shadow-sm' : 'text-gray-600'}
        >
          North Shore {activeFocusSuburb === 'North Shore City' ? '✓' : ''}
        </button>
      </div>
    );
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  chartDataResponse = { success: true, data: { monthlyData: [], quarterlyData: [] } };
  global.fetch = vi.fn().mockImplementation((url: string) => {
    if (typeof url === 'string' && url.includes('/api/admin/analytics/scans')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, total_scans: 0, total_unique: 0, campaigns: [], logs: [] }),
      });
    }
    if (typeof url === 'string' && url.includes('/api/admin/analytics/chart-data')) {
      chartDataCalls += 1;
      return Promise.resolve({
        ok: true,
        json: async () => chartDataResponse,
      });
    }
    if (typeof url === 'string' && url.includes('/api/admin/analytics/available-suburbs')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ availableSuburbs: ['Oteha', 'Albany', 'Torbay'] }),
      });
    }
    if (typeof url === 'string' && url.includes('/api/admin/analytics/overview')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, total_cost: 0, total_revenue: 0, total_mailed: 0, total_downloads: 0, total_appraisals: 0, total_conversions: 0 }),
      });
    }
    if (typeof url === 'string' && url.includes('/api/admin/analytics/location')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, locations: [], regions: [], total: 0 }),
      });
    }
    if (typeof url === 'string' && url.includes('/api/admin/analytics/last-sold-data')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, suburbs: [], northShore: { total: 0, buckets: [] } }),
      });
    }
  });
});

afterEach(() => {
  cleanup();
  chartDataCalls = 0;
});

describe('Analytics Page — suburb sync between sections', () => {
  it('renders both sections and suburb buttons', async () => {
    const AnalyticsPage = (await import('../../../app/admin/analytics/page')).default;
    const qc = createQueryClient();
    render(
      <QueryClientProvider client={qc}>
        <AnalyticsPage />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('REINZ Market Trends')).toBeDefined();
      expect(screen.getByTestId('monthly-data-table')).toBeDefined();
    });
  });

  it('click suburb in Analysis Data replaces REINZ selection (not append)', async () => {
    const AnalyticsPage = (await import('../../../app/admin/analytics/page')).default;
    const qc = createQueryClient();
    render(
      <QueryClientProvider client={qc}>
        <AnalyticsPage />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('monthly-data-table')).toBeDefined();
    });

    // Initially 'Oteha' is selected in both sections (default)
    const reinzOteha = screen.getAllByText('Oteha');
    expect(reinzOteha.length).toBeGreaterThanOrEqual(1);

    // All REINZ buttons for 'Oteha' should show active class initially
    const initialReinzOteha = reinzOteha[0];
    expect(initialReinzOteha.className).toContain('text-white');

    // Click 'Albany' in Analysis Data
    const adAlbany = screen.getByTestId('ad-btn-Albany');
    fireEvent.click(adAlbany);

    await waitFor(() => {
      // REINZ 'Oteha' should no longer be active (was replaced, not appended)
      const reinzButtons = screen.getAllByText('Oteha');
      const reinzOtehaAfter = reinzButtons[0];
      expect(reinzOtehaAfter.className).toContain('text-gray-600');

      // REINZ 'Albany' should now be active
      const reinzAlbany = screen.getAllByText('Albany');
      expect(reinzAlbany[0].className).toContain('text-white');
    });
  });

  it('does not refetch chart data repeatedly when selection is unchanged', async () => {
    const AnalyticsPage = (await import('../../../app/admin/analytics/page')).default;
    const qc = createQueryClient();
    render(
      <QueryClientProvider client={qc}>
        <AnalyticsPage />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(chartDataCalls).toBeGreaterThan(0);
    });

    const callsAfterLoad = chartDataCalls;

    await new Promise((r) => setTimeout(r, 300));

    expect(chartDataCalls).toBe(callsAfterLoad);
  });

  it('click North Shore in Analysis Data deselects all REINZ suburbs', async () => {
    const AnalyticsPage = (await import('../../../app/admin/analytics/page')).default;
    const qc = createQueryClient();
    render(
      <QueryClientProvider client={qc}>
        <AnalyticsPage />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('monthly-data-table')).toBeDefined();
    });

    // Click 'North Shore' in Analysis Data
    const adNorthShore = screen.getByTestId('ad-btn-north-shore');
    fireEvent.click(adNorthShore);

    await waitFor(() => {
      // All suburb buttons in REINZ should now be inactive
      const reinzOteha = screen.getAllByText('Oteha');
      expect(reinzOteha[0].className).toContain('text-gray-600');

      const reinzAlbany = screen.getAllByText('Albany');
      expect(reinzAlbany[0].className).toContain('text-gray-600');
    });
  });

  it('loads the full history, defaults to 2 years, and reveals older REINZ data with 5 years+', async () => {
    chartDataResponse = {
      success: true,
      data: {
        monthlyData: [
          { period: '2020-06' },
          { period: '2024-06' },
          { period: '2025-01' },
          { period: '2026-01' },
        ],
        quarterlyData: [
          { period: '2020-Q2' },
          { period: '2025-Q1' },
          { period: '2026-Q1' },
        ],
      },
    };

    const AnalyticsPage = (await import('../../../app/admin/analytics/page')).default;
    const qc = createQueryClient();
    render(
      <QueryClientProvider client={qc}>
        <AnalyticsPage />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('market-trends-chart').textContent).toBe('2025-01,2026-01');
    });

    const chartCall = (global.fetch as any).mock.calls.find(
      (call: unknown[]) => typeof call[0] === 'string' && call[0].includes('/api/admin/analytics/chart-data')
    );
    expect(String(chartCall?.[0])).toContain('from=1900-01-01');
    expect(String(chartCall?.[0])).toContain('to=2999-12-31');

    expect(screen.getByTestId('reinz-range-2y').getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(screen.getByTestId('reinz-range-5y+'));

    await waitFor(() => {
      expect(screen.getByTestId('market-trends-chart').textContent).toBe('2020-06,2024-06,2025-01,2026-01');
    });
    expect(screen.getByTestId('reinz-range-5y+').getAttribute('aria-pressed')).toBe('true');
  });
});

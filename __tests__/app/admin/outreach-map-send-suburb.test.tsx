'use client';

import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import OutreachPage from '../../../app/admin/outreach/page';

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { email: 'nzlouis.com@gmail.com' } }, status: 'authenticated' }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/components/admin/Skeleton', () => ({
  SkeletonOutreach: () => <div>Loading Outreach</div>,
  SkeletonOutreachCard: () => <div>Loading Card</div>,
  SkeletonOutreachListRow: () => <div>Loading Row</div>,
}));

vi.mock('@/components/property/AddressAutocomplete', () => ({
  default: () => <input data-testid="address-autocomplete" />,
}));

vi.mock('@/lib/geo-data', () => ({
  getAllSuburbs: () => ['Torbay'],
}));

vi.mock('../../../app/admin/outreach/components/DynamicMapView', () => ({
  default: (props: {
    onMarkAsSent?: (id: string, suburb: string) => void;
    onMarkAsJunk?: (id: string, suburb: string) => void | Promise<void>;
    refreshKey?: number | string;
    isVisible?: boolean;
    statusFilter?: 'all' | 'unsent' | 'sent' | 'junk';
  }) => (
    <div
      data-testid="map-stub"
      data-refresh-key={props.refreshKey}
      data-visible={String(props.isVisible)}
      data-status-filter={props.statusFilter}
    >
      <button
        type="button"
        onClick={() => props.onMarkAsSent?.('map-address-1', 'Torbay')}
      >
        Map Sent
      </button>
      <button
        type="button"
        onClick={() => { void props.onMarkAsJunk?.('junk-address-1', 'Torbay'); }}
      >
        Map Junk
      </button>
    </div>
  ),
}));

class MockIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  constructor(_cb: IntersectionObserverCallback, _opts?: IntersectionObserverInit) {}
}
globalThis.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;

const pdfReports = [
  { id: 'r-f', suburb: 'Fairview Heights', quarter: 'Q3', year: 2026, label: '2026-Q3', doc_label: 'Main Report', file_url: 'https://x/f.pdf', file_name: 'f.pdf' },
  { id: 'r-t', suburb: 'Torbay', quarter: 'Q3', year: 2026, label: '2026-Q3', doc_label: 'Main Report', file_url: 'https://x/t.pdf', file_name: 't.pdf' },
];

describe('Outreach map Sent modal suburb', () => {
  beforeEach(() => {
    global.fetch = vi.fn((url: RequestInfo) => {
      const s = String(url || '');
      if (s.includes('/api/admin/pdf/reports')) {
        const parsed = new URL(s, 'http://localhost');
        const suburb = parsed.searchParams.get('suburb');
        const reports = suburb ? pdfReports.filter((r) => r.suburb === suburb) : pdfReports;
        return Promise.resolve({ ok: true, json: async () => ({ success: true, reports }) });
      }
      if (s.includes('/api/admin/outreach/default-report')) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, defaultReport: null }) });
      }
      if (s.includes('/api/admin/outreach/suburb-sent-stats')) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, stats: {} }) });
      }
      if (s.includes('/api/admin/outreach/street-clusters')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            suburb: 'Torbay',
            groups: [],
            allStreets: [],
            runs: [],
            unclusteredStreets: [],
          }),
        });
      }
      if (s.includes('/api/admin/outreach?')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: [
              {
                id: 'map-address-1',
                property_address: '1 Torbay Road',
                street: 'Torbay Road',
                suburb: 'Torbay',
                city: 'Auckland',
                region: 'Auckland',
                status: 'PENDING',
                created_at: '2026-07-01T10:00:00Z',
              },
            ],
            pagination: { page: 1, limit: 9, total: 1, totalPages: 1 },
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true, data: [], pagination: { page: 1, limit: 9, total: 0, totalPages: 0 } }) });
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  it('opens the send modal for the map suburb, not the first report suburb', async () => {
    render(<OutreachPage />);

    fireEvent.click(await screen.findByRole('button', { name: /Pending/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Map$/ }));

    fireEvent.click(await screen.findByRole('button', { name: 'Map Sent' }));

    await screen.findByText('Send Market Report');

    await waitFor(() => {
      const title = screen.getByDisplayValue(/Market Report/i) as HTMLInputElement;
      expect(title.value).toContain('Torbay');
      expect(title.value).not.toContain('Fairview Heights');
    }, { timeout: 3000 });

    const pdfCalls = vi.mocked(global.fetch).mock.calls
      .map((c) => String(c[0]))
      .filter((u) => u.includes('/api/admin/pdf/reports'));
    expect(pdfCalls.some((u) => u.includes('suburb=Torbay'))).toBe(true);
    expect(pdfCalls.some((u) => u.includes('suburb=Fairview+Heights'))).toBe(false);
  });

  it('refreshes the map whenever it is selected and preserves the Pending Unsent filter', async () => {
    render(<OutreachPage />);

    fireEvent.click(await screen.findByRole('button', { name: /Pending/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Unsent' }));
    fireEvent.click(await screen.findByRole('button', { name: /Map$/ }));

    const map = screen.getByTestId('map-stub');
    expect(map.getAttribute('data-status-filter')).toBe('unsent');
    const initialRefreshKey = map.getAttribute('data-refresh-key');

    fireEvent.click(screen.getByTitle('Card View'));
    fireEvent.click(screen.getByTitle('Map View'));

    expect(map.getAttribute('data-status-filter')).toBe('unsent');
    expect(map.getAttribute('data-refresh-key')).not.toBe(initialRefreshKey);
    const refreshedKey = map.getAttribute('data-refresh-key');

    fireEvent.click(screen.getByTitle('Map View'));
    expect(map.getAttribute('data-refresh-key')).not.toBe(refreshedKey);
  });

  it('refreshes map data only after returning from cards following a map dispatch', async () => {
    const scrollToSpy = vi.fn();
    vi.stubGlobal('scrollTo', scrollToSpy);

    render(<OutreachPage />);

    fireEvent.click(await screen.findByRole('button', { name: /Pending/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Map$/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Map Sent' }));

    await screen.findByText('Send Market Report');
    await waitFor(() => {
      expect(screen.getByDisplayValue(/Torbay 2026-Q3 Market Report/)).toBeTruthy();
      expect(screen.getByDisplayValue('2026_Q3_Torbay')).toBeTruthy();
    });
    const map = screen.getByTestId('map-stub');
    const initialRefreshKey = map.getAttribute('data-refresh-key');
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Dispatch Log' }));

    await waitFor(() => {
      expect(
        vi.mocked(global.fetch).mock.calls.some(([url]) =>
          String(url).includes('/api/admin/outreach/send')
        )
      ).toBe(true);
    });

    expect(screen.queryByRole('button', { name: 'Confirm Dispatch Log' })).toBeNull();
    expect(screen.getByTestId('map-stub')).toBe(map);
    expect(map.getAttribute('data-refresh-key')).toBe(initialRefreshKey);

    fireEvent.click(screen.getByTitle('Card View'));
    expect(map.getAttribute('data-visible')).toBe('false');
    expect(map.getAttribute('data-refresh-key')).toBe(initialRefreshKey);

    fireEvent.click(screen.getByTitle('Map View'));
    expect(screen.getByTestId('map-stub')).toBe(map);
    expect(map.getAttribute('data-visible')).toBe('true');
    expect(map.getAttribute('data-refresh-key')).not.toBe(initialRefreshKey);
    expect(scrollToSpy).not.toHaveBeenCalled();
  });

  it('batches multiple junk updates into one refresh when returning from cards', async () => {
    render(<OutreachPage />);
    fireEvent.click(await screen.findByRole('button', { name: /Pending/i }));
    fireEvent.click(await screen.findByRole('button', { name: /2026-Q3/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Map$/ }));

    const map = screen.getByTestId('map-stub');
    const initialRefreshKey = map.getAttribute('data-refresh-key');
    fireEvent.click(screen.getByRole('button', { name: 'Map Junk' }));
    fireEvent.click(screen.getByRole('button', { name: 'Map Junk' }));

    await waitFor(() => {
      const junkRequests = vi.mocked(global.fetch).mock.calls.filter(([url, init]) =>
        String(url).includes('/api/admin/outreach/junk-address-1') && init?.method === 'PATCH'
      );
      expect(junkRequests).toHaveLength(2);
    });
    expect(map.getAttribute('data-refresh-key')).toBe(initialRefreshKey);

    fireEvent.click(screen.getByTitle('Card View'));
    expect(map.getAttribute('data-refresh-key')).toBe(initialRefreshKey);
    fireEvent.click(screen.getByTitle('Map View'));

    expect(screen.getByTestId('map-stub')).toBe(map);
    expect(map.getAttribute('data-refresh-key')).not.toBe(initialRefreshKey);
    const refreshKeyAfterReturn = map.getAttribute('data-refresh-key');

    fireEvent.click(screen.getByTitle('Card View'));
    fireEvent.click(screen.getByTitle('Map View'));
    expect(map.getAttribute('data-refresh-key')).not.toBe(refreshKeyAfterReturn);
  });
});

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
  default: (props: { onMarkAsSent?: (id: string, suburb: string) => void; refreshKey?: number }) => (
    <div data-testid="map-stub" data-refresh-key={props.refreshKey}>
      <button
        type="button"
        onClick={() => props.onMarkAsSent?.('map-address-1', 'Torbay')}
      >
        Map Sent
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

  it('does not reload or scroll the map after dispatching an address from map mode', async () => {
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
    expect(map.getAttribute('data-refresh-key')).toBe(initialRefreshKey);
    expect(scrollToSpy).not.toHaveBeenCalled();
  });
});

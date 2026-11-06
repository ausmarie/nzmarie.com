'use client';

import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
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
    onToggleJunk?: (id: string, suburb: string, shouldBeJunk: boolean) => void | Promise<void>;
    onSendStreet?: (suburb: string, street: string, addresses: Array<{ id: string; address: string }>) => void;
    optimisticSentIds?: string[];
    optimisticJunkIds?: string[];
    optimisticUnjunkIds?: string[];
    refreshKey?: number | string;
    isVisible?: boolean;
    statusFilter?: 'all' | 'unsent' | 'sent' | 'junk';
    onStatusFilterChange?: (status: 'all' | 'unsent' | 'sent' | 'junk') => void;
  }) => (
    <div
      data-testid="map-stub"
      data-refresh-key={props.refreshKey}
      data-visible={String(props.isVisible)}
      data-status-filter={props.statusFilter}
      data-optimistic-sent-ids={props.optimisticSentIds?.join(',') ?? ''}
      data-optimistic-junk-ids={props.optimisticJunkIds?.join(',') ?? ''}
      data-optimistic-unjunk-ids={props.optimisticUnjunkIds?.join(',') ?? ''}
    >
      <button
        type="button"
        onClick={() => props.onMarkAsSent?.('map-address-1', 'Torbay')}
      >
        Map Sent
      </button>
      <button
        type="button"
        onClick={() => props.onMarkAsSent?.('map-address-2', 'Torbay')}
      >
        Map Sent 2
      </button>
      <button
        type="button"
        onClick={() => { void props.onToggleJunk?.('map-address-1', 'Torbay', true); }}
      >
        Map Junk
      </button>
      <button
        type="button"
        onClick={() => { void props.onToggleJunk?.('map-address-1', 'Torbay', false); }}
      >
        Map Unjunk
      </button>
      <button
        type="button"
        onClick={() => props.onStatusFilterChange?.('unsent')}
      >
        Map Unsent
      </button>
      <button
        type="button"
        onClick={() => props.onSendStreet?.('Torbay', 'Glamorgan Drive', [
          { id: 'map-address-1', address: '1 Glamorgan Drive' },
          { id: 'map-address-2', address: '5 Glamorgan Drive' },
        ])}
      >
        Map Send for Street
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
let deferredSendResponses: Array<(response: { ok: boolean; json: () => Promise<{ success: boolean }> }) => void> | null = null;
let mockNoJunkMail = false;

const pdfReports = [
  { id: 'r-f', suburb: 'Fairview Heights', quarter: 'Q3', year: 2026, label: '2026-Q3', doc_label: 'Main Report', file_url: 'https://x/f.pdf', file_name: 'f.pdf' },
  { id: 'r-t', suburb: 'Torbay', quarter: 'Q3', year: 2026, label: '2026-Q3', doc_label: 'Main Report', file_url: 'https://x/t.pdf', file_name: 't.pdf' },
];

describe('Outreach map Sent modal suburb', () => {
  beforeEach(() => {
    deferredSendResponses = null;
    mockNoJunkMail = false;
    global.fetch = vi.fn((url: RequestInfo, init?: RequestInit) => {
      const s = String(url || '');
      if (s.includes('/api/admin/outreach/map-address-1') && init?.method === 'PATCH') {
        mockNoJunkMail = JSON.parse(String(init.body)).no_junk_mail;
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, quarter_junk_recorded: mockNoJunkMail }),
        });
      }
      if (s.includes('/api/admin/outreach/send') && deferredSendResponses) {
        return new Promise((resolve) => deferredSendResponses?.push(resolve));
      }
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
                no_junk_mail: mockNoJunkMail,
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

  it('keeps the map updated optimistically after dispatch and refreshes only when Map is clicked', async () => {
    deferredSendResponses = [];
    const scrollToSpy = vi.fn();
    vi.stubGlobal('scrollTo', scrollToSpy);

    render(<OutreachPage />);

    fireEvent.click(await screen.findByRole('button', { name: /Pending/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Unsent' }));
    fireEvent.click(await screen.findByRole('button', { name: /Map$/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Map Sent' }));

    await screen.findByText('Send Market Report');
    await screen.findByDisplayValue(/Torbay 2026-Q3 Market Report/);
    await screen.findByDisplayValue('2026_Q3_Torbay');
    const map = screen.getByTestId('map-stub');
    expect(map.getAttribute('data-status-filter')).toBe('unsent');

    const initialRefreshKey = map.getAttribute('data-refresh-key');
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Dispatch Log' }));
    await waitFor(() => {
      expect(deferredSendResponses).toHaveLength(1);
    });

    expect(screen.queryByRole('button', { name: 'Confirm Dispatch Log' })).toBeNull();
    expect(screen.getByTestId('map-stub')).toBe(map);
    expect(map.getAttribute('data-status-filter')).toBe('unsent');
    expect(map.getAttribute('data-refresh-key')).toBe(initialRefreshKey);
    expect(map.getAttribute('data-optimistic-sent-ids')).toBe('map-address-1');

    await act(async () => {
      deferredSendResponses?.[0]({ ok: true, json: async () => ({ success: true }) });
      await Promise.resolve();
    });
    expect(map.getAttribute('data-refresh-key')).toBe(initialRefreshKey);
    expect(map.getAttribute('data-optimistic-sent-ids')).toBe('map-address-1');

    fireEvent.click(screen.getByTitle('Card View'));
    expect(map.getAttribute('data-visible')).toBe('false');
    expect(map.getAttribute('data-refresh-key')).toBe(initialRefreshKey);

    fireEvent.click(screen.getByTitle('Map View'));
    expect(screen.getByTestId('map-stub')).toBe(map);
    expect(map.getAttribute('data-visible')).toBe('true');
    expect(map.getAttribute('data-refresh-key')).not.toBe(initialRefreshKey);
    expect(map.getAttribute('data-status-filter')).toBe('unsent');
    expect(scrollToSpy).not.toHaveBeenCalled();
  });

  it('lets a second map address be sent while the first dispatch is still recording', async () => {
    deferredSendResponses = [];
    render(<OutreachPage />);

    fireEvent.click(await screen.findByRole('button', { name: /Pending/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Map$/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Map Sent' }));
    await screen.findByText('Send Market Report');
    await screen.findByDisplayValue('2026_Q3_Torbay');
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Dispatch Log' }));

    await waitFor(() => {
      expect(deferredSendResponses).toHaveLength(1);
    });
    const map = screen.getByTestId('map-stub');
    expect(map.getAttribute('data-optimistic-sent-ids')).toBe('map-address-1');

    fireEvent.click(screen.getByRole('button', { name: 'Map Sent 2' }));
    await screen.findByText('Send Market Report');
    await screen.findByDisplayValue('2026_Q3_Torbay');
    const confirmButton = screen.getByRole('button', { name: 'Confirm Dispatch Log' });
    expect((confirmButton as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(deferredSendResponses).toHaveLength(2);
    });
    expect(map.getAttribute('data-optimistic-sent-ids')).toBe('map-address-1,map-address-2');

    deferredSendResponses[1]({ ok: true, json: async () => ({ success: true }) });
    deferredSendResponses[0]({ ok: true, json: async () => ({ success: true }) });
  });

  it('opens the street dispatch with a locked street name and sends only selected addresses', async () => {
    deferredSendResponses = [];
    render(<OutreachPage />);
    fireEvent.click(await screen.findByRole('button', { name: /Pending/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Map$/ }));

    const map = screen.getByTestId('map-stub');
    const initialRefreshKey = map.getAttribute('data-refresh-key');
    fireEvent.click(screen.getByRole('button', { name: 'Map Send for Street' }));

    expect(await screen.findByText('Send Market Report for this Street')).toBeTruthy();
    const streetField = screen.getByRole('textbox', { name: 'Street' }) as HTMLInputElement;
    expect(streetField.value).toBe('Glamorgan Drive');
    expect(streetField.readOnly).toBe(true);
    const modal = screen.getByTestId('send-report-modal');
    const modalScroll = screen.getByTestId('send-report-modal-scroll');
    expect(modal.className).toContain('max-h-[calc(100dvh-2rem)]');
    expect(modalScroll.className).toContain('overflow-y-auto');
    expect(modalScroll.contains(screen.getByRole('button', { name: 'Confirm Dispatch Log' }))).toBe(false);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();

    const addressCheckboxes = screen.getAllByRole('checkbox');
    expect(addressCheckboxes).toHaveLength(2);
    expect((addressCheckboxes[0] as HTMLInputElement).checked).toBe(true);
    expect((addressCheckboxes[1] as HTMLInputElement).checked).toBe(true);
    fireEvent.click(addressCheckboxes[1]);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Dispatch Log' }));

    await waitFor(() => expect(deferredSendResponses).toHaveLength(1));
    const sendCall = vi.mocked(global.fetch).mock.calls.find(([url]) =>
      String(url).includes('/api/admin/outreach/send')
    );
    expect(sendCall).toBeDefined();
    expect(JSON.parse(String(sendCall?.[1]?.body)).property_ids).toEqual(['map-address-1']);
    expect(map.getAttribute('data-optimistic-sent-ids')).toBe('map-address-1');
    expect(map.getAttribute('data-refresh-key')).toBe(initialRefreshKey);

    deferredSendResponses[0]({ ok: true, json: async () => ({ success: true }) });
    await waitFor(() => {
      expect(map.getAttribute('data-optimistic-sent-ids')).toBe('map-address-1');
    });
    expect(map.getAttribute('data-refresh-key')).toBe(initialRefreshKey);
  });

  it('does not refresh the map after card junk changes until Map is clicked', async () => {
    render(<OutreachPage />);
    fireEvent.click(await screen.findByRole('button', { name: /Pending/i }));
    fireEvent.click(await screen.findByRole('button', { name: /2026-Q3/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Map$/ }));

    const map = screen.getByTestId('map-stub');
    const initialRefreshKey = map.getAttribute('data-refresh-key');
    fireEvent.click(screen.getByRole('button', { name: 'Map Unsent' }));
    expect(map.getAttribute('data-status-filter')).toBe('unsent');
    fireEvent.click(screen.getByTitle('Card View'));
    fireEvent.click(await screen.findByTitle('Click to mark No Junk'));
    expect(map.getAttribute('data-optimistic-junk-ids')).toBe('map-address-1');

    await waitFor(() => {
      const junkRequests = vi.mocked(global.fetch).mock.calls.filter(([url, init]) =>
        String(url).includes('/api/admin/outreach/map-address-1') && init?.method === 'PATCH'
      );
      expect(junkRequests).toHaveLength(1);
    });
    expect(map.getAttribute('data-refresh-key')).toBe(initialRefreshKey);

    fireEvent.click(await screen.findByTitle('No Junk - Click to allow'));

    await waitFor(() => {
      const junkRequests = vi.mocked(global.fetch).mock.calls.filter(([url, init]) =>
        String(url).includes('/api/admin/outreach/map-address-1') && init?.method === 'PATCH'
      );
      expect(junkRequests).toHaveLength(2);
    });
    const junkRequests = vi.mocked(global.fetch).mock.calls.filter(([url, init]) =>
      String(url).includes('/api/admin/outreach/map-address-1') && init?.method === 'PATCH'
    );
    expect(JSON.parse(String(junkRequests[0][1]?.body)).no_junk_mail).toBe(true);
    expect(JSON.parse(String(junkRequests[1][1]?.body)).no_junk_mail).toBe(false);
    expect(map.getAttribute('data-optimistic-junk-ids')).toBe('');
    expect(map.getAttribute('data-optimistic-unjunk-ids')).toBe('map-address-1');
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

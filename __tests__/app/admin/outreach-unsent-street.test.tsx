import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, act } from '@testing-library/react';
import OutreachPage from '../../../app/admin/outreach/page';

const mockSession = {
  data: { user: { email: 'nzlouis.com@gmail.com' } },
  status: 'authenticated' as const,
};

vi.mock('next-auth/react', () => ({
  useSession: () => mockSession,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/components/admin/Skeleton', () => ({
  SkeletonOutreach: () => <div>Loading Outreach</div>,
  SkeletonOutreachCard: () => <div>Loading Card</div>,
  SkeletonOutreachListRow: () => <div>Loading Row</div>,
}));

vi.mock('@/components/admin/InlineAddressInput', () => ({
  default: () => <div data-testid="inline-input" />,
}));

vi.mock('@/components/property/AddressAutocomplete', () => ({
  default: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <input data-testid="address-autocomplete" value={value} onChange={(event) => onChange(event.target.value)} />
  ),
}));

vi.mock('@/lib/geo-data', () => ({
  getAllSuburbs: () => ['Browns Bay'],
}));

vi.mock('@/lib/permissions', () => ({
  isAdmin: () => true,
}));

vi.mock('../../../app/admin/outreach/components/TodayRunSection', () => ({
  default: ({ onSelectStreet }: { onSelectStreet: (suburb: string, street: string) => void }) => (
    <button onClick={() => onSelectStreet('Browns Bay', 'Oaktree Avenue')}>
      Choose Oaktree Avenue
    </button>
  ),
}));

const addresses = Array.from({ length: 13 }, (_, index) => ({
  id: `oaktree-${index + 1}`,
  property_address: `${index + 1} Oaktree Avenue`,
  suburb: 'Browns Bay',
  city: 'Auckland',
  region: 'North Shore',
  street: 'Oaktree Avenue',
  status: 'PENDING',
  created_at: `2026-07-${String(index + 1).padStart(2, '0')}T10:00:00Z`,
}));

let intersectionObserverCallback: ((entries: IntersectionObserverEntry[]) => void) | null = null;
class MockIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  constructor(callback: (entries: IntersectionObserverEntry[]) => void) {
    intersectionObserverCallback = callback;
  }
}

globalThis.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;

function mockOaktreeFetch() {
  const fetchMock = vi.fn((url: RequestInfo) => {
    const requestUrl = new URL(String(url), 'http://localhost');
    const path = requestUrl.pathname;

    if (path === '/api/admin/pdf/reports') {
      return Promise.resolve({ ok: true, json: async () => ({ success: true, reports: [] }) });
    }
    if (path === '/api/admin/outreach/default-report') {
      return Promise.resolve({ ok: true, json: async () => ({ success: true, defaultReport: null }) });
    }
    if (path === '/api/admin/outreach/suburb-sent-stats') {
      return Promise.resolve({ ok: true, json: async () => ({ success: true, stats: {} }) });
    }
    if (path === '/api/admin/outreach/street-clusters') {
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, suburb: 'Browns Bay', groups: [], allStreets: [], runs: [] }),
      });
    }
    if (path === '/api/admin/outreach' && requestUrl.searchParams.has('status')) {
      const page = Number(requestUrl.searchParams.get('page') || 1);
      const limit = Number(requestUrl.searchParams.get('limit') || 50);
      const matchingAddresses = requestUrl.searchParams.get('street') === 'Oaktree Avenue' ? addresses : [];
      return Promise.resolve({
        ok: true,
        json: async () => ({
          success: true,
          data: matchingAddresses.slice((page - 1) * limit, page * limit),
          pagination: {
            page,
            limit,
            total: matchingAddresses.length,
            totalPages: Math.ceil(matchingAddresses.length / limit),
          },
        }),
      });
    }

    return Promise.resolve({ ok: true, json: async () => ({ success: true, data: [] }) });
  });
  global.fetch = fetchMock as any;
  return fetchMock;
}

async function selectOaktreeStreet() {
  render(<OutreachPage />);
  fireEvent.click(await screen.findByRole('button', { name: /Pending/i }));
  fireEvent.click(await screen.findByRole('button', { name: 'Unsent' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Choose Oaktree Avenue' }));
}

describe('Unsent street pagination', () => {
  beforeEach(() => {
    intersectionObserverCallback = null;
    global.fetch = vi.fn();
    vi.stubGlobal('scrollTo', vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('displays all 13 street addresses together in List view', async () => {
    const fetchMock = mockOaktreeFetch();
    render(<OutreachPage />);
    fireEvent.click(await screen.findByRole('button', { name: /Pending/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Unsent' }));
    fireEvent.click(await screen.findByRole('button', { name: /☰ List/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Choose Oaktree Avenue' }));

    expect(await screen.findByText('13 Oaktree Avenue')).toBeTruthy();
    expect(fetchMock.mock.calls.some(([url]) => {
      const params = new URL(String(url), 'http://localhost').searchParams;
      return params.get('street') === 'Oaktree Avenue' && params.get('limit') === '500';
    })).toBe(true);
  });

  it('loads the next card page when scrolling to the end of an unsent street', async () => {
    const fetchMock = mockOaktreeFetch();
    await selectOaktreeStreet();

    expect(await screen.findByText('9 Oaktree Avenue')).toBeTruthy();
    await waitFor(() => expect(intersectionObserverCallback).toBeTruthy());
    act(() => {
      intersectionObserverCallback?.([{ isIntersecting: true } as IntersectionObserverEntry]);
    });

    expect(await screen.findByText('13 Oaktree Avenue')).toBeTruthy();
    expect(fetchMock.mock.calls.some(([url]) => {
      const params = new URL(String(url), 'http://localhost').searchParams;
      return params.get('street') === 'Oaktree Avenue' &&
        params.get('page') === '2' && params.get('limit') === '9';
    })).toBe(true);
  });

});

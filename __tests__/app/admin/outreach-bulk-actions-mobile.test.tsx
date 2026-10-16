'use client';

import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import OutreachPage from '../../../app/admin/outreach/page';

const mockPush = vi.fn();
let mockSession: { data: { user: { email: string } } | null; status: 'authenticated' | 'loading' | 'unauthenticated' } = {
  data: { user: { email: 'nzlouis.com@gmail.com' } },
  status: 'authenticated',
};

vi.mock('next-auth/react', () => ({
  useSession: () => mockSession,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
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
  default: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <input data-testid="address-autocomplete" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

vi.mock('@/lib/geo-data', () => ({
  getAllSuburbs: () => ['Takapuna'],
}));

const mockObserve = vi.fn();
const mockDisconnect = vi.fn();
class MockIntersectionObserver {
  observe = mockObserve;
  unobserve = vi.fn();
  disconnect = mockDisconnect;
  constructor(_cb: (entries: IntersectionObserverEntry[]) => void, _opts?: IntersectionObserverInit) {}
}
globalThis.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;

function makeProperty(id: string, address: string, status: string) {
  return {
    id,
    property_address: address,
    suburb: 'Takapuna',
    city: 'Auckland',
    region: 'North Shore',
    status,
    created_at: '2026-07-01T10:00:00Z',
    sent_at: status.toLowerCase() === 'sent' ? '2026-07-02T12:00:00Z' : undefined,
    no_junk_mail: false,
    joined_property_id: `prop-${id}`,
  };
}

function installFetch(status: 'pending' | 'liked' | 'sent', items: ReturnType<typeof makeProperty>[]) {
  (global.fetch as any) = vi.fn((url: RequestInfo) => {
    const s = String(url || '');
    if (s.includes('/api/admin/pdf/reports')) {
      return Promise.resolve({ ok: true, json: async () => ({ success: true, reports: [] }) });
    }
    if (s.includes('/api/admin/outreach/default-report')) {
      return Promise.resolve({ ok: true, json: async () => ({ success: true, defaultReport: null }) });
    }
    if (s.includes('/api/admin/outreach?')) {
      const matches =
        status === 'pending' ? s.includes('status=pending') : s.includes(`status=${status}`);
      if (matches) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: items,
            pagination: { page: 1, limit: 50, total: items.length, totalPages: 1 },
          }),
        });
      }
    }
    return Promise.resolve({
      ok: true,
      json: async () => ({ success: true, data: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } }),
    });
  });
}

function findBulkBar(): HTMLElement {
  const label = screen.getByText(/address(es)? selected/i);
  const bar = label.closest('div') as HTMLElement;
  expect(bar).toBeTruthy();
  return bar;
}

function findCardGrid(): HTMLElement {
  const grids = Array.from(document.querySelectorAll('div')).filter((el) => {
    const tpl = (el as HTMLElement).style.gridTemplateColumns;
    return tpl.includes('repeat(auto-fill');
  });
  expect(grids.length).toBeGreaterThanOrEqual(1);
  return grids[0] as HTMLElement;
}

describe('Outreach mobile - bulk action bars wrap instead of overflowing', () => {
  beforeEach(() => {
    mockSession = {
      data: { user: { email: 'nzlouis.com@gmail.com' } },
      status: 'authenticated',
    };
    global.fetch = vi.fn();
    window.confirm = vi.fn().mockReturnValue(true);
  });

  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  it('pending bulk action bar has flex-wrap so its buttons stay within the card column width', async () => {
    installFetch('pending', [makeProperty('out-1', '15 Marine Parade', 'PENDING')]);

    render(<OutreachPage />);

    const pendingTab = await screen.findByRole('button', { name: /Pending/i });
    fireEvent.click(pendingTab);

    const checkbox = await screen.findByRole('checkbox');
    fireEvent.click(checkbox);

    const bar = findBulkBar();
    expect(bar.style.flexWrap).toBe('wrap');
    expect(bar.className).toContain('flex');
    expect(bar.className).toContain('items-center');
    expect(within(bar).getByRole('button', { name: /Mark as Sent/i })).toBeTruthy();
    expect(within(bar).getByRole('button', { name: /Return to Pending/i })).toBeTruthy();
    expect(within(bar).getByRole('button', { name: /Return to Liked/i })).toBeTruthy();
    expect(within(bar).getByRole('button', { name: /Delete/i })).toBeTruthy();
    expect(within(bar).getByRole('button', { name: /Clear Selection/i })).toBeTruthy();
  });

  it('liked bulk action bar has flex-wrap', async () => {
    installFetch('liked', [makeProperty('out-1', '15 Marine Parade', 'liked')]);

    render(<OutreachPage />);

    const likedTab = await screen.findByRole('button', { name: /Liked/i });
    fireEvent.click(likedTab);

    const checkbox = await screen.findByRole('checkbox');
    fireEvent.click(checkbox);

    const bar = findBulkBar();
    expect(bar.style.flexWrap).toBe('wrap');
    expect(within(bar).getByRole('button', { name: /Mark as Pending/i })).toBeTruthy();
    expect(within(bar).getByRole('button', { name: /Clear Selection/i })).toBeTruthy();
  });

  it('sent bulk action bar has flex-wrap', async () => {
    installFetch('sent', [makeProperty('out-s-1', '10 Sent St', 'sent')]);

    render(<OutreachPage />);

    const sentTab = await screen.findByRole('button', { name: /✓ Sent/i });
    fireEvent.click(sentTab);

    const checkbox = await screen.findByRole('checkbox');
    fireEvent.click(checkbox);

    const bar = findBulkBar();
    expect(bar.style.flexWrap).toBe('wrap');
    expect(within(bar).getByRole('button', { name: /Start New Campaign/i })).toBeTruthy();
  });

  it('bulk action bar only appears after a selection is made', async () => {
    installFetch('pending', [makeProperty('out-1', '15 Marine Parade', 'PENDING')]);

    render(<OutreachPage />);

    const pendingTab = await screen.findByRole('button', { name: /Pending/i });
    fireEvent.click(pendingTab);

    await screen.findByRole('checkbox');
    expect(screen.queryByText(/address(es)? selected/i)).toBeNull();

    fireEvent.click(screen.getByRole('checkbox'));
    expect(findBulkBar().style.flexWrap).toBe('wrap');
  });
});

describe('Outreach mobile - card grid keeps full-width columns on narrow screens', () => {
  beforeEach(() => {
    mockSession = {
      data: { user: { email: 'nzlouis.com@gmail.com' } },
      status: 'authenticated',
    };
    global.fetch = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  it('card grid uses minmax(min(340px, 100%), 1fr) so a track never overflows a 402px viewport', async () => {
    installFetch('pending', [makeProperty('out-1', '15 Marine Parade', 'PENDING')]);

    render(<OutreachPage />);

    const pendingTab = await screen.findByRole('button', { name: /Pending/i });
    fireEvent.click(pendingTab);

    await screen.findByText('15 Marine Parade');

    const grid = findCardGrid();
    expect(grid.style.gridTemplateColumns).toContain('min(340px, 100%)');
    expect(grid.style.gridTemplateColumns).toContain('1fr');
  });

  it('grid template stays full-width when a selection is active', async () => {
    installFetch('pending', [makeProperty('out-1', '15 Marine Parade', 'PENDING')]);

    render(<OutreachPage />);

    const pendingTab = await screen.findByRole('button', { name: /Pending/i });
    fireEvent.click(pendingTab);

    const checkbox = await screen.findByRole('checkbox');
    fireEvent.click(checkbox);

    findBulkBar();
    const grid = findCardGrid();
    expect(grid.style.gridTemplateColumns).toContain('min(340px, 100%)');
  });
});

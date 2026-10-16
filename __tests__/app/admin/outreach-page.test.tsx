'use client';

import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup, within, act } from '@testing-library/react';
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

describe('Outreach page', () => {
  let scrollToSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockPush.mockReset();
    mockSession = {
      data: { user: { email: 'nzlouis.com@gmail.com' } },
      status: 'authenticated',
    };
    global.fetch = vi.fn();
    scrollToSpy = vi.fn();
    vi.stubGlobal('scrollTo', scrollToSpy);
  });

  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('renders pending address row and shows mark as sent button', async () => {
    (global.fetch as any) = vi.fn((url: RequestInfo) => {
      const s = String(url || '');
      if (s.includes('/api/admin/pdf/reports')) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, reports: [] }) });
      }
      if (s.includes('/api/admin/outreach/default-report')) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, defaultReport: null }) });
      }
      if (s.includes('/api/admin/outreach?') && s.includes('status=pending')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: [
              {
                id: 'out-1',
                property_address: '15 Marine Parade',
                suburb: 'Takapuna',
                city: 'Auckland',
                region: 'North Shore',
                status: 'PENDING',
                created_at: '2026-07-01T10:00:00Z',
              },
            ],
            pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          success: true,
          data: [],
          pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
        }),
      });
    });

    render(<OutreachPage />);

    expect(await screen.findByText('📬 Outreach')).toBeTruthy();
    const pendingTab = await screen.findByRole('button', { name: /Pending/i });
    fireEvent.click(pendingTab);
    const listBtn = await screen.findByRole('button', { name: /☰ List/i });
    fireEvent.click(listBtn);
    const suburbHeader = await screen.findByText(/Takapuna/i, { selector: 'div' });
    expect(suburbHeader).toBeTruthy();

    expect(await screen.findByText('15 Marine Parade')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /✓ Sent/i }).length).toBeGreaterThanOrEqual(1);
  });

  it('marks a pending address as sent when row button clicked', async () => {
    let markedSent = false;
    (global.fetch as any) = vi.fn((url: RequestInfo, init?: RequestInit) => {
      const s = String(url || '');
      if (s.includes('/api/admin/pdf/reports')) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, reports: [] }) });
      }
      if (s.includes('/api/admin/outreach/default-report')) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, defaultReport: null }) });
      }
      if (s.includes('/api/admin/outreach/out-1/mark-sent')) {
        markedSent = true;
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: {
              id: 'out-1',
              status: 'SENT',
              sent_by: 'nzlouis.com@gmail.com',
              sent_at: '2026-07-02T12:00:00Z',
            },
          }),
        });
      }
      if (s.includes('/api/admin/outreach?') && s.includes('status=pending')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: markedSent ? [] : [
              {
                id: 'out-1',
                property_address: '15 Marine Parade',
                suburb: 'Takapuna',
                city: 'Auckland',
                region: 'North Shore',
                status: 'PENDING',
                created_at: '2026-07-01T10:00:00Z',
              },
            ],
            pagination: { page: 1, limit: 50, total: markedSent ? 0 : 1, totalPages: markedSent ? 0 : 1 },
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          success: true,
          data: [],
          pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
        }),
      });
    });

    window.confirm = vi.fn().mockReturnValue(true);

    render(<OutreachPage />);

    const pendingTab = await screen.findByRole('button', { name: /Pending/i });
    fireEvent.click(pendingTab);
    const listBtn = await screen.findByRole('button', { name: /☰ List/i });
    fireEvent.click(listBtn);
    const suburbHeader = await screen.findByText(/Takapuna/i, { selector: 'div' });
    expect(suburbHeader).toBeTruthy();

    const sentButtons = await screen.findAllByRole('button', { name: /✓ Sent/i });
    const rowSentButton = sentButtons[sentButtons.length - 1];
    fireEvent.click(rowSentButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/admin/outreach/out-1/mark-sent', { method: 'PATCH' });
      expect(screen.queryByText('15 Marine Parade')).toBeNull();
    });
  });

  it('uses selected addresses when a card-level Send Report button is clicked', async () => {
    const pendingItems = [
      {
        id: 'out-1',
        property_address: '15 Marine Parade',
        suburb: 'Takapuna',
        city: 'Auckland',
        region: 'North Shore',
        status: 'PENDING',
        created_at: '2026-07-01T10:00:00Z',
      },
      {
        id: 'out-2',
        property_address: '22 Beach Road',
        suburb: 'Takapuna',
        city: 'Auckland',
        region: 'North Shore',
        status: 'PENDING',
        created_at: '2026-07-02T10:00:00Z',
      },
    ];

(global.fetch as any) = vi.fn((url: RequestInfo) => {
      const s = String(url || '');
      if (s.includes('/api/admin/pdf/reports')) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, reports: [{ suburb: 'Torbay', quarter: 'Q2', year: 2026, id: 'r1' }] }) });
      }
      if (s.includes('/api/admin/outreach/default-report')) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, defaultReport: null }) });
      }
      if (s.includes('/api/admin/outreach?') && s.includes('status=pending')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: pendingItems,
            pagination: { page: 1, limit: 50, total: 2, totalPages: 1 },
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true, data: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } }) });
    });

    render(<OutreachPage />);

    const pendingTab = await screen.findByRole('button', { name: /Pending/i });
    fireEvent.click(pendingTab);

    const cardCheckboxes = await screen.findAllByRole('checkbox');
    expect(cardCheckboxes.length).toBeGreaterThanOrEqual(2);
    fireEvent.click(cardCheckboxes[0]);
    fireEvent.click(cardCheckboxes[1]);

    const sendButtons = await screen.findAllByRole('button', { name: /Send Report/i });
    fireEvent.click(sendButtons[0]);

    expect(await screen.findByText(/Selected 2 target addresses/i)).toBeTruthy();
  });
});

describe('Outreach page - Dual Pagination Mode', () => {
  const mockItems = [
    {
      id: 'out-1',
      property_address: '15 Marine Parade',
      suburb: 'Takapuna',
      city: 'Auckland',
      region: 'North Shore',
      status: 'liked',
      created_at: '2026-07-01T10:00:00Z',
      no_junk_mail: false,
      joined_property_id: 'prop-1',
      build_year: 1990,
    },
    {
      id: 'out-2',
      property_address: '22 Beach Road',
      suburb: 'Takapuna',
      city: 'Auckland',
      region: 'North Shore',
      status: 'liked',
      created_at: '2026-07-02T10:00:00Z',
      no_junk_mail: true,
      joined_property_id: 'prop-2',
      build_year: 1985,
    },
  ];

  beforeEach(() => {
    mockPush.mockReset();
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

  it('renders segmented control with Infinite Scroll and Classic Pages buttons', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: mockItems, pagination: { page: 1, limit: 20, total: 45, totalPages: 3 } }),
    });

    render(<OutreachPage />);

    await waitFor(() => {
      expect(screen.getByText('Infinite Scroll')).toBeDefined();
      expect(screen.getByText('Classic Pages')).toBeDefined();
    });
  });

  it('shows counter text in infinite mode', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: mockItems, pagination: { page: 1, limit: 20, total: 45, totalPages: 3 } }),
    });

    render(<OutreachPage />);

    await waitFor(() => {
      expect(screen.getAllByText(/Displaying 1 to 2 of 45 properties/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('switches to classic mode and shows page controls', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: mockItems, pagination: { page: 1, limit: 20, total: 45, totalPages: 3 } }),
    });

    render(<OutreachPage />);

    await waitFor(() => expect(screen.getByText('❤️ Liked')).toBeDefined());

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: [mockItems[0]], pagination: { page: 1, limit: 20, total: 45, totalPages: 3 } }),
    });

    fireEvent.click(screen.getByText('Classic Pages'));

    await waitFor(() => {
      const buttons = screen.getAllByRole('button');
      const prevBtns = buttons.filter(b => b.textContent === '‹');
      expect(prevBtns.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('disables prev/first buttons on page 1 in classic mode', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: mockItems, pagination: { page: 1, limit: 20, total: 45, totalPages: 3 } }),
    });

    render(<OutreachPage />);

    await waitFor(() => expect(screen.getByText('❤️ Liked')).toBeDefined());

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: [mockItems[0]], pagination: { page: 1, limit: 20, total: 45, totalPages: 3 } }),
    });

    fireEvent.click(screen.getByText('Classic Pages'));

    await waitFor(() => {
      const buttons = screen.getAllByRole('button');
      const firstBtns = buttons.filter(b => b.textContent === '≪');
      firstBtns.forEach(b => expect((b as HTMLButtonElement).disabled).toBe(true));
    });
  });

  it('switches back to infinite mode', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: mockItems, pagination: { page: 1, limit: 20, total: 45, totalPages: 3 } }),
    });

    render(<OutreachPage />);

    await waitFor(() => expect(screen.getByText('❤️ Liked')).toBeDefined());

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: [mockItems[0]], pagination: { page: 1, limit: 20, total: 45, totalPages: 3 } }),
    });

    fireEvent.click(screen.getByText('Classic Pages'));
    await waitFor(() => {
      const buttons = screen.getAllByRole('button');
      const prevBtns = buttons.filter(b => b.textContent === '‹');
      expect(prevBtns.length).toBeGreaterThanOrEqual(1);
    });

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: mockItems, pagination: { page: 1, limit: 20, total: 45, totalPages: 3 } }),
    });

    fireEvent.click(screen.getByText('Infinite Scroll'));

    await waitFor(() => {
      expect(screen.getAllByText(/Displaying 1 to 2 of 45 properties/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows counter with range in classic mode', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: mockItems, pagination: { page: 1, limit: 20, total: 45, totalPages: 3 } }),
    });

    render(<OutreachPage />);

    await waitFor(() => expect(screen.getByText('❤️ Liked')).toBeDefined());

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: [mockItems[0]], pagination: { page: 1, limit: 20, total: 45, totalPages: 3 } }),
    });

    fireEvent.click(screen.getByText('Classic Pages'));

    await waitFor(() => {
      expect(screen.getAllByText(/Displaying 1 to 9 of 45 properties/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders only one bottom pagination bar in classic mode', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: mockItems, pagination: { page: 1, limit: 20, total: 45, totalPages: 3 } }),
    });

    render(<OutreachPage />);

    await waitFor(() => expect(screen.getByText('❤️ Liked')).toBeDefined());

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: [mockItems[0]], pagination: { page: 1, limit: 20, total: 45, totalPages: 3 } }),
    });

    fireEvent.click(screen.getByText('Classic Pages'));

    await waitFor(() => {
      // The range pagination ("1–9 of 45 …") must appear exactly once — the
      // card view previously rendered a duplicate bar below the grid.
      expect(screen.getAllByText('1–9 of 45').length).toBe(1);
    });
  });
});

describe('Outreach page - Liked icon on card image', () => {
  const mockItems = [
    {
      id: 'out-1',
      property_address: '15 Marine Parade',
      suburb: 'Takapuna',
      city: 'Auckland',
      region: 'North Shore',
      status: 'liked',
      created_at: '2026-07-01T10:00:00Z',
      image_url: '/static/media/no-photo-available.png',
      no_junk_mail: false,
      joined_property_id: 'prop-1',
      build_year: 1990,
    },
  ];

  beforeEach(() => {
    mockPush.mockReset();
    mockSession = {
      data: { user: { email: 'nzlouis.com@gmail.com' } },
      status: 'authenticated',
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: mockItems, pagination: { page: 1, limit: 20, total: 45, totalPages: 3 } }),
    });
    window.confirm = vi.fn().mockReturnValue(true);
  });

  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  it('shows "No Image Available" placeholder when image_url is no-photo-available', async () => {
    render(<OutreachPage />);
    await waitFor(() => expect(screen.getByText('❤️ Liked')).toBeDefined());
    expect(await screen.findByText('No Image Available')).toBeDefined();
  });

  it('does NOT render a standalone unlike (♥/♡) button on the image in liked tab', async () => {
    render(<OutreachPage />);
    await waitFor(() => expect(screen.getByText('❤️ Liked')).toBeDefined());

    // The old standalone heart button with title "Unlike"/"Like" must be gone.
    expect(screen.queryByTitle('Unlike')).toBeNull();
    expect(screen.queryByTitle('Like')).toBeNull();

    // Instead the liked icon is a pure red heart button.
    expect(screen.getByTitle('取消喜欢 / Unlike')).toBeDefined();
  });

  it('clicking the liked icon removes the record via DELETE without full refresh', async () => {
    render(<OutreachPage />);
    await waitFor(() => expect(screen.getByText('❤️ Liked')).toBeDefined());

    const likedIcon = screen.getByTitle('取消喜欢 / Unlike');
    fireEvent.click(likedIcon);

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalledWith('/api/admin/outreach/out-1', { method: 'DELETE' });
    });

    // After removal the property card text disappears (no page reload).
    await waitFor(() => {
      expect(screen.queryByText('15 Marine Parade')).toBeNull();
    });
  });

  it('does not delete when confirmation is cancelled', async () => {
    window.confirm = vi.fn().mockReturnValue(false);

    render(<OutreachPage />);
    await waitFor(() => expect(screen.getByText('❤️ Liked')).toBeDefined());

    fireEvent.click(screen.getByTitle('取消喜欢 / Unlike'));

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalled();
    });

    expect(global.fetch).not.toHaveBeenCalledWith('/api/admin/outreach/out-1', { method: 'DELETE' });
    // Item remains on the page.
    expect(screen.getByText('15 Marine Parade')).toBeDefined();
  });

  it('rolls back the removal if the DELETE request fails', async () => {
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockItems, pagination: { page: 1, limit: 20, total: 45, totalPages: 3 } }),
      })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Failed' }) });

    render(<OutreachPage />);
    await waitFor(() => expect(screen.getByText('❤️ Liked')).toBeDefined());

    fireEvent.click(screen.getByTitle('取消喜欢 / Unlike'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/admin/outreach/out-1', { method: 'DELETE' });
    });

    // Item should be restored (rollback) since the request failed.
    await waitFor(() => {
      expect(screen.getByText('15 Marine Parade')).toBeDefined();
    });
  });

  it('toggles no_junk_mail optimistically on outreach card', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: mockItems, pagination: { page: 1, limit: 20, total: 45, totalPages: 3 } }),
    });

    render(<OutreachPage />);
    await waitFor(() => expect(screen.getByText('❤️ Liked')).toBeDefined());

    const noJunkBtn = screen.getByTitle('Click to mark No Junk');
    expect(noJunkBtn).toBeDefined();

    fireEvent.click(noJunkBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/admin/properties/prop-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ no_junk_mail: true }),
      });
    });
  });

  it('card view content area has 16px padding', async () => {
    render(<OutreachPage />);
    await waitFor(() => expect(screen.getByText('❤️ Liked')).toBeDefined());

    const cards = document.querySelectorAll('[style*="padding: 16px"]');
    expect(cards.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Outreach page - List view mobile layout', () => {
  const mockItems = [
    {
      id: 'out-1',
      property_address: '15 Marine Parade',
      suburb: 'Takapuna',
      city: 'Auckland',
      region: 'North Shore',
      status: 'pending',
      created_at: '2026-07-01T10:00:00Z',
      no_junk_mail: false,
      joined_property_id: 'prop-1',
    },
    {
      id: 'out-2',
      property_address: '22 Beach Road',
      suburb: 'Takapuna',
      city: 'Auckland',
      region: 'North Shore',
      status: 'pending',
      created_at: '2026-07-02T10:00:00Z',
      no_junk_mail: false,
      joined_property_id: 'prop-2',
    },
  ];

  beforeEach(() => {
    mockPush.mockReset();
    mockSession = {
      data: { user: { email: 'nzlouis.com@gmail.com' } },
      status: 'authenticated',
    };
    (global.fetch as any) = vi.fn((url: RequestInfo) => {
      const s = String(url || '');
      if (s.includes('/api/admin/pdf/reports')) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, reports: [] }) });
      }
      if (s.includes('/api/admin/outreach/default-report')) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, defaultReport: null }) });
      }
      if (s.includes('/api/admin/outreach?') && s.includes('status=pending')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: mockItems, pagination: { page: 1, limit: 50, total: 2, totalPages: 1 } }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } }),
      });
    });
  });

  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  it('renders address next to checkbox in list view', async () => {
    render(<OutreachPage />);

    const pendingTab = await screen.findByRole('button', { name: /Pending/i });
    fireEvent.click(pendingTab);
    const listBtn = await screen.findByRole('button', { name: /☰ List/i });
    fireEvent.click(listBtn);

    await waitFor(() => {
      expect(screen.getByText('15 Marine Parade')).toBeDefined();
    });

    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes.length).toBeGreaterThanOrEqual(1);

    const addr = screen.getByText('15 Marine Parade');
    expect(addr.className).toContain('truncate');
  });

  it('shows action buttons in a separate wrapped container below address', async () => {
    render(<OutreachPage />);

    const pendingTab = await screen.findByRole('button', { name: /Pending/i });
    fireEvent.click(pendingTab);
    const listBtn = await screen.findByRole('button', { name: /☰ List/i });
    fireEvent.click(listBtn);

    await waitFor(() => {
      expect(screen.getByText('15 Marine Parade')).toBeDefined();
    });

    const sentBtns = screen.getAllByText('✓ Sent');
    expect(sentBtns.length).toBeGreaterThanOrEqual(1);

    const likedBtns = screen.getAllByText('↩ Liked');
    expect(likedBtns.length).toBeGreaterThanOrEqual(1);
  });

  it('does not loop when classic mode restores an empty cached page', async () => {
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [],
          pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [],
          pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
        }),
      });

    render(<OutreachPage />);
    await screen.findByRole('button', { name: /☰ List/i });

    const classicBtn = await screen.findByRole('button', { name: /Classic Pages/i });
    fireEvent.click(classicBtn);

    // If the render-phase setState loop existed, React would throw
    // "Too many re-renders" before this assertion runs.
    expect(screen.getByRole('button', { name: /☰ List/i })).toBeDefined();
  });

  it('auto-selects the default report after reports are loaded', async () => {
    (global.fetch as any) = vi.fn((url: RequestInfo) => {
      const s = String(url || '');
      if (s.includes('/api/admin/outreach/default-report')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, defaultReport: { suburb: 'Oteha', label: '2026-Q2' } }),
        });
      }
      if (s.includes('/api/admin/pdf/reports')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            reports: [
              { suburb: 'Oteha', quarter: 'Q2', year: 2026, id: 'r1' },
              { suburb: 'Torbay', quarter: 'Q1', year: 2026, id: 'r2' },
            ],
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true, data: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } }) });
    });

    render(<OutreachPage />);

    const pendingTab = await screen.findByRole('button', { name: /Pending/i });
    fireEvent.click(pendingTab);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '★ Default' })).toBeTruthy();
    });
    expect(screen.getByRole('button', { name: /2026-Q2/ })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /Oteha/ }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Unsent' })).toBeTruthy();
  });

  it('sets the selected report as default via the button', async () => {
    let postedBody: { suburb?: string; label?: string; quarter?: string } | null = null;
    (global.fetch as any) = vi.fn((url: RequestInfo, init?: RequestInit) => {
      const s = String(url || '');
      if (s.includes('/api/admin/outreach/default-report')) {
        if (init?.method === 'POST') {
          postedBody = JSON.parse(String(init.body));
          return Promise.resolve({ ok: true, json: async () => ({ success: true, defaultReport: postedBody }) });
        }
        return Promise.resolve({ ok: true, json: async () => ({ success: true, defaultReport: null }) });
      }
      if (s.includes('/api/admin/pdf/reports')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            reports: [{ suburb: 'Oteha', quarter: 'Q2', year: 2026, id: 'r1' }],
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true, data: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } }) });
    });

    render(<OutreachPage />);

    const pendingTab = await screen.findByRole('button', { name: /Pending/i });
    fireEvent.click(pendingTab);

    const reportSection = (await screen.findByText('📋 Filter by Report')).closest('div') as HTMLElement;
    fireEvent.click(await within(reportSection).findByRole('button', { name: /2026-Q2/ }));
    fireEvent.click(await within(reportSection).findByRole('button', { name: 'Oteha' }));

    const setBtn = await within(reportSection).findByRole('button', { name: /Set as default/i });
    fireEvent.click(setBtn);

    await waitFor(() => {
      expect(within(reportSection).getByRole('button', { name: /Default/i })).toBeTruthy();
    });
    expect(postedBody).toEqual({ suburb: 'Oteha', label: '2026-Q2', quarter: '2026-Q2' });
  });

  it('orders the Filter by Report suburb buttons by most recent upload first', async () => {
    (global.fetch as any) = vi.fn((url: RequestInfo) => {
      const s = String(url || '');
      if (s.includes('/api/admin/outreach/default-report')) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, defaultReport: null }) });
      }
      if (s.includes('/api/admin/pdf/reports')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            reports: [
              { suburb: 'Albany', quarter: 'Q2', year: 2026, id: 'r-alb', uploaded_at: '2025-05-01T00:00:00.000Z' },
              { suburb: 'Torbay', quarter: 'Q1', year: 2026, id: 'r-tor', uploaded_at: '2025-06-01T00:00:00.000Z' },
              { suburb: 'Oteha', quarter: 'Q2', year: 2026, id: 'r-ote', uploaded_at: '2025-07-01T00:00:00.000Z' },
            ],
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true, data: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } }) });
    });

    render(<OutreachPage />);

    const pendingTab = await screen.findByRole('button', { name: /Pending/i });
    fireEvent.click(pendingTab);

    const reportSection = (await screen.findByText('📋 Filter by Report')).closest('div') as HTMLElement;
    fireEvent.click(await within(reportSection).findByRole('button', { name: /2026-Q2/ }));
    const suburbButtons = within(reportSection).getAllByRole('button').filter(b => {
      const text = b.textContent?.trim() || '';
      return !text.match(/2026-Q\d/) && text !== 'All' && text !== 'Unsent' && text !== 'Sent ✓' && !text.includes('More') && !text.includes('Hide') && text !== '✕ Clear';
    });
    const buttonNames = suburbButtons.map(b => b.textContent?.trim() || '');
    expect(buttonNames.indexOf('Oteha')).toBeGreaterThanOrEqual(0);
    expect(buttonNames.indexOf('Oteha')).toBeLessThan(buttonNames.indexOf('Albany'));
  });

  it('filters sent properties by sent date via calendar', async () => {
    const calls: string[] = [];
    (global.fetch as any) = vi.fn((url: RequestInfo) => {
      const s = String(url || '');
      calls.push(s);
      if (s.includes('/api/admin/pdf/reports')) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, reports: [] }) });
      }
      if (s.includes('/api/admin/outreach/default-report')) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, defaultReport: null }) });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          success: true,
          data: [
            {
              id: 'out-s-1',
              property_address: '10 Sent St',
              suburb: 'Takapuna',
              city: 'Auckland',
              region: 'North Shore',
              status: 'sent',
              created_at: '2026-07-01T10:00:00Z',
              sent_at: '2026-07-02T12:00:00Z',
            },
          ],
          pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
        }),
      });
    });

    render(<OutreachPage />);

    const sentTab = await screen.findByRole('button', { name: /✓ Sent/i });
    fireEvent.click(sentTab);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Today' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Today' }));

    await waitFor(() => {
      const sentFetch = calls.find(c => c.includes('/api/admin/outreach?') && c.includes('status=sent'));
      expect(sentFetch).toBeTruthy();
      expect(sentFetch).toContain('sent_dates=');
    });
  });

  it('sends sent_dates together with report_quarter on the Sent tab', async () => {
    const calls: string[] = [];
    (global.fetch as any) = vi.fn((url: RequestInfo) => {
      const s = String(url || '');
      calls.push(s);
      if (s.includes('/api/admin/pdf/reports')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            reports: [{ id: 'r1', suburb: 'Totara Vale', quarter: 'Q2', year: 2026, uploaded_at: '2026-06-01' }],
          }),
        });
      }
      if (s.includes('/api/admin/outreach/default-report')) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, defaultReport: null }) });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          success: true,
          data: [
            {
              id: 'out-s-1',
              property_address: '36 Target Road',
              suburb: 'Totara Vale',
              city: 'North Shore',
              region: 'Auckland',
              status: 'sent',
              created_at: '2026-10-14T00:00:00Z',
              sent_at: '2026-10-13T21:14:00Z',
            },
          ],
          pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
        }),
      });
    });

    render(<OutreachPage />);

    const sentTab = await screen.findByRole('button', { name: /✓ Sent/i });
    fireEvent.click(sentTab);

    const quarterChip = await screen.findByRole('button', { name: /2026-Q2/ });
    fireEvent.click(quarterChip);

    await waitFor(() => {
      const combined = calls.find(
        c => c.includes('/api/admin/outreach?') && c.includes('status=sent') && c.includes('report_quarter=2026-Q2')
      );
      expect(combined).toBeTruthy();
      expect(combined).toContain('sent_dates=');
    }, { timeout: 3000 });
  });
});

describe('Outreach page - Card view run ordering', () => {
  const runStreetOrder = ['Alpha Street', 'Zeta Street', 'Beta Street'];

  function makeStreet(street: string, i: number) {
    return {
      street,
      suburb: 'Torbay',
      lat: -36.6 + i * 0.01,
      lng: 174.7 + i * 0.01,
      pendingCount: 1,
      addresses: [`${i + 1} ${street}`],
    };
  }

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

  it('renders cards in the Today Run street order, not the API order', async () => {
    const clusterStreets = runStreetOrder.map(makeStreet);
    (global.fetch as any) = vi.fn((url: RequestInfo) => {
      const s = String(url || '');
      if (s.includes('/api/admin/pdf/reports')) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, reports: [{ suburb: 'Torbay', quarter: 'Q2', year: 2026, id: 'r1' }] }) });
      }
      if (s.includes('/api/admin/outreach/default-report')) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, defaultReport: null }) });
      }
      if (s.includes('/api/admin/outreach/street-clusters')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            suburb: 'Torbay',
            groups: [{ groupId: 1, streets: clusterStreets, totalPending: 3, extentMeters: 500 }],
            runs: [{ runId: 1, groups: [{ groupId: 1, streets: clusterStreets, totalPending: 3, extentMeters: 500 }], totalPending: 3, streetCount: 3 }],
            totalPending: 3,
            unclusteredStreets: [],
            allStreets: runStreetOrder.map((st) => ({ street: st, count: 1 })),
          }),
        });
      }
      if (s.includes('/api/admin/outreach?')) {
        // API returns Beta first, then Alpha, then Zeta — NOT the run order.
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: [
              { id: 'out-b', property_address: '5 Beta Street', street: 'Beta Street', suburb: 'Torbay', city: 'Auckland', region: 'Auckland', status: 'PENDING', created_at: '2026-07-01T10:00:00Z' },
              { id: 'out-a', property_address: '3 Alpha Street', street: 'Alpha Street', suburb: 'Torbay', city: 'Auckland', region: 'Auckland', status: 'PENDING', created_at: '2026-07-01T10:00:00Z' },
              { id: 'out-z', property_address: '7 Zeta Street', street: 'Zeta Street', suburb: 'Torbay', city: 'Auckland', region: 'Auckland', status: 'PENDING', created_at: '2026-07-01T10:00:00Z' },
            ],
            pagination: { page: 1, limit: 50, total: 3, totalPages: 1 },
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true, data: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } }) });
    });

    render(<OutreachPage />);

    const pendingTab = await screen.findByRole('button', { name: /Pending/i });
    fireEvent.click(pendingTab);

    const reportSection = (await screen.findByText('📋 Filter by Report')).closest('div') as HTMLElement;
    fireEvent.click(await within(reportSection).findByRole('button', { name: /2026-Q2/ }));

    const unsentBtn = await screen.findByRole('button', { name: 'Unsent' });
    fireEvent.click(unsentBtn);

    await waitFor(() => {
      expect(screen.getByText('3 Alpha Street')).toBeTruthy();
      expect(screen.getByText('5 Beta Street')).toBeTruthy();
      expect(screen.getByText('7 Zeta Street')).toBeTruthy();
    }, { timeout: 3000 });

    const h3s = Array.from(document.querySelectorAll('h3')).map((h) => h.textContent || '');
    const alphaIdx = h3s.indexOf('3 Alpha Street');
    const zetaIdx = h3s.indexOf('7 Zeta Street');
    const betaIdx = h3s.indexOf('5 Beta Street');
    expect(alphaIdx).toBeGreaterThanOrEqual(0);
    expect(zetaIdx).toBeGreaterThan(alphaIdx);
    expect(betaIdx).toBeGreaterThan(zetaIdx);
  });

  it('renders ALL addresses on a multi-address street (Glamorgan Drive, 6 addresses) in card view', async () => {
    const glamorganStreets = [
      { street: 'Glamorgan Drive', suburb: 'Torbay', lat: -36.6958, lng: 174.7453, pendingCount: 6, addresses: ['98A Glamorgan Drive', '100 Glamorgan Drive', '102 Glamorgan Drive', '104 Glamorgan Drive', '106 Glamorgan Drive', '108 Glamorgan Drive'] },
    ];
    const apiAddresses = [
      { id: 'g1', property_address: '98A Glamorgan Drive', street: 'Glamorgan Drive', suburb: 'Torbay', city: 'Auckland', region: 'Auckland', status: 'PENDING', created_at: '2026-07-01T09:00:00Z' },
      { id: 'g2', property_address: '100 Glamorgan Drive', street: 'Glamorgan Drive', suburb: 'Torbay', city: 'Auckland', region: 'Auckland', status: 'PENDING', created_at: '2026-07-01T09:01:00Z' },
      { id: 'g3', property_address: '102 Glamorgan Drive', street: 'Glamorgan Drive', suburb: 'Torbay', city: 'Auckland', region: 'Auckland', status: 'PENDING', created_at: '2026-07-01T09:02:00Z' },
      { id: 'g4', property_address: '104 Glamorgan Drive', street: 'Glamorgan Drive', suburb: 'Torbay', city: 'Auckland', region: 'Auckland', status: 'PENDING', created_at: '2026-07-01T09:03:00Z' },
      { id: 'g5', property_address: '106 Glamorgan Drive', street: 'Glamorgan Drive', suburb: 'Torbay', city: 'Auckland', region: 'Auckland', status: 'PENDING', created_at: '2026-07-01T09:04:00Z' },
      { id: 'g6', property_address: '108 Glamorgan Drive', street: 'Glamorgan Drive', suburb: 'Torbay', city: 'Auckland', region: 'Auckland', status: 'PENDING', created_at: '2026-07-01T09:05:00Z' },
    ];
    (global.fetch as any) = vi.fn((url: RequestInfo) => {
      const s = String(url || '');
      if (s.includes('/api/admin/pdf/reports')) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, reports: [{ suburb: 'Torbay', quarter: 'Q2', year: 2026, id: 'r1' }] }) });
      }
      if (s.includes('/api/admin/outreach/default-report')) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, defaultReport: null }) });
      }
      if (s.includes('/api/admin/outreach/street-clusters')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            suburb: 'Torbay',
            groups: [{ groupId: 1, streets: glamorganStreets, totalPending: 6, extentMeters: 500 }],
            runs: [{ runId: 1, groups: [{ groupId: 1, streets: glamorganStreets, totalPending: 6, extentMeters: 500 }], totalPending: 6, streetCount: 1 }],
            totalPending: 6,
            unclusteredStreets: [],
            allStreets: [{ street: 'Glamorgan Drive', count: 6 }],
          }),
        });
      }
      if (s.includes('/api/admin/outreach?')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: apiAddresses,
            pagination: { page: 1, limit: 50, total: 6, totalPages: 1 },
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true, data: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } }) });
    });

    render(<OutreachPage />);

    const pendingTab = await screen.findByRole('button', { name: /Pending/i });
    fireEvent.click(pendingTab);

    await screen.findByRole('button', { name: /2026-Q2/ }, { timeout: 5000 });
    fireEvent.click(await screen.findByRole('button', { name: /2026-Q2/ }, { timeout: 5000 }));

    const unsentBtn = await screen.findByRole('button', { name: 'Unsent' });
    fireEvent.click(unsentBtn);

    await waitFor(() => {
      expect(screen.getByText('98A Glamorgan Drive')).toBeTruthy();
      expect(screen.getByText('108 Glamorgan Drive')).toBeTruthy();
    }, { timeout: 3000 });

    const h3s = Array.from(document.querySelectorAll('h3')).map((h) => h.textContent || '');
    for (const addr of apiAddresses) {
      expect(h3s).toContain(addr.property_address);
    }
    expect(h3s.filter((t) => t.includes('Glamorgan Drive'))).toHaveLength(6);
  });

  it('drops the Today Run street filter when switching from Unsent back to All, so the full count is restored', async () => {
    const clusterStreets = runStreetOrder.map(makeStreet);
    const outreachListCalls = () =>
      vi.mocked(global.fetch).mock.calls
        .map((c) => String(c[0]))
        .filter((u) => u.includes('/api/admin/outreach?') && !u.includes('/street-clusters'));

    (global.fetch as any) = vi.fn((url: RequestInfo) => {
      const s = String(url || '');
      if (s.includes('/api/admin/pdf/reports')) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, reports: [{ suburb: 'Torbay', quarter: 'Q2', year: 2026, id: 'r1' }] }) });
      }
      if (s.includes('/api/admin/outreach/default-report')) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, defaultReport: null }) });
      }
      if (s.includes('/api/admin/outreach/street-clusters')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            suburb: 'Torbay',
            groups: [{ groupId: 1, streets: clusterStreets, totalPending: 3, extentMeters: 500 }],
            runs: [{ runId: 1, groups: [{ groupId: 1, streets: clusterStreets, totalPending: 3, extentMeters: 500 }], totalPending: 3, streetCount: 3 }],
            totalPending: 3,
            unclusteredStreets: [],
            allStreets: runStreetOrder.map((st) => ({ street: st, count: 1 })),
          }),
        });
      }
      if (s.includes('/api/admin/outreach?')) {
        // Straße set is a single street; no streets param. This returns the
        // full "All" list (3 addresses) regardless of a streets filter.
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: [
              { id: 'out-b', property_address: '5 Beta Street', street: 'Beta Street', suburb: 'Torbay', city: 'Auckland', region: 'Auckland', status: 'PENDING', created_at: '2026-07-01T10:00:00Z' },
              { id: 'out-a', property_address: '3 Alpha Street', street: 'Alpha Street', suburb: 'Torbay', city: 'Auckland', region: 'Auckland', status: 'PENDING', created_at: '2026-07-01T10:00:00Z' },
              { id: 'out-z', property_address: '7 Zeta Street', street: 'Zeta Street', suburb: 'Torbay', city: 'Auckland', region: 'Auckland', status: 'PENDING', created_at: '2026-07-01T10:00:00Z' },
            ],
            pagination: { page: 1, limit: 50, total: 3, totalPages: 1 },
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true, data: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } }) });
    });

    render(<OutreachPage />);

    const pendingTab = await screen.findByRole('button', { name: /Pending/i });
    fireEvent.click(pendingTab);

    const reportSection = (await screen.findByText('📋 Filter by Report')).closest('div') as HTMLElement;
    fireEvent.click(await within(reportSection).findByRole('button', { name: /2026-Q2/ }));

    const unsentBtn = await screen.findByRole('button', { name: 'Unsent' });
    fireEvent.click(unsentBtn);

    // While in "Unsent" mode, the auto-selected Today Run streets must be sent
    // to the outreach list API via the `streets` param.
    await waitFor(() => {
      const last = outreachListCalls().pop() || '';
      expect(last).toContain('streets=');
    }, { timeout: 3000 });

    const allBtn = (await screen.findAllByRole('button', { name: /^All$/ }))[0];
    fireEvent.click(allBtn);

    // After switching back to "All", a fresh list fetch must NOT be limited to
    // the run's streets, so the full unsent + sent count is displayed again.
    await waitFor(() => {
      const last = outreachListCalls().pop() || '';
      expect(last).not.toContain('streets=');
      expect(last).not.toContain('sent_status=unsent');
    }, { timeout: 3000 });
  });

  it('does not show "Displaying 1 to 0 of 0 properties" when the default report lands after the Today Run auto-selects a stale suburb\u0027s streets', async () => {
    const northcrossStreets = [
      { street: 'Oteha Valley Road', suburb: 'Northcross', lat: -36.69, lng: 174.71, pendingCount: 1, addresses: ['35 Oteha Valley Road'] },
    ];
    const torbayStreets = [
      { street: 'Acacia Road', suburb: 'Torbay', lat: -36.6958, lng: 174.7453, pendingCount: 4, addresses: ['1 Acacia Road', '3 Acacia Road', '5 Garden Lane', '7 Helen Ryburn Place'] },
    ];
    const torbayItems = [
      { id: 't1', property_address: '1 Acacia Road', street: 'Acacia Road', suburb: 'Torbay', city: 'Auckland', region: 'Auckland', status: 'PENDING', created_at: '2026-07-01T09:00:00Z' },
      { id: 't2', property_address: '3 Acacia Road', street: 'Acacia Road', suburb: 'Torbay', city: 'Auckland', region: 'Auckland', status: 'PENDING', created_at: '2026-07-01T09:01:00Z' },
      { id: 't3', property_address: '5 Garden Lane', street: 'Garden Lane', suburb: 'Torbay', city: 'Auckland', region: 'Auckland', status: 'PENDING', created_at: '2026-07-01T09:02:00Z' },
      { id: 't4', property_address: '7 Helen Ryburn Place', street: 'Helen Ryburn Place', suburb: 'Torbay', city: 'Auckland', region: 'Auckland', status: 'PENDING', created_at: '2026-07-01T09:03:00Z' },
    ];
    const northcrossItems = [
      { id: 'n1', property_address: '35 Oteha Valley Road', street: 'Oteha Valley Road', suburb: 'Northcross', city: 'Auckland', region: 'Auckland', status: 'PENDING', created_at: '2026-07-01T09:04:00Z' },
    ];

    (global.fetch as any) = vi.fn((url: RequestInfo) => {
      const s = String(url || '');
      if (s.includes('/api/admin/pdf/reports')) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, reports: [] }) });
      }
      if (s.includes('/api/admin/outreach/default-report')) {
        // Default report lands LATE, after the user clicks Unsent, so the
        // first Pending fetch is made against the initial suburb (Northcross).
        return new Promise((resolve) => {
          setTimeout(() => resolve({ ok: true, json: async () => ({ success: true, defaultReport: { suburb: 'Torbay', label: '2026-Q2' } }) }), 600);
        });
      }
      if (s.includes('/api/admin/outreach/street-clusters')) {
        const u = new URL(s, 'http://localhost');
        const suburb = u.searchParams.get('suburb');
        if (suburb === 'Northcross') {
          // Resolves immediately, BEFORE the default report, auto-selecting the
          // Northcross run streets into the shared runStreetFilter.
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              suburb: 'Northcross',
              groups: [{ groupId: 1, streets: northcrossStreets, totalPending: 1, extentMeters: 500 }],
              runs: [{ runId: 1, groups: [{ groupId: 1, streets: northcrossStreets, totalPending: 1, extentMeters: 500 }], totalPending: 1, streetCount: 1 }],
              totalPending: 1,
              unclusteredStreets: [],
              allStreets: [{ street: 'Oteha Valley Road', count: 1 }],
            }),
          });
        }
        if (suburb === 'Torbay') {
          // Torbay street-clusters resolve very late, so the stale Northcross
          // streets remain active while the list refetches for Torbay.
          return new Promise((resolve) => {
            setTimeout(() => resolve({
              ok: true,
              json: async () => ({
                success: true,
                suburb: 'Torbay',
                groups: [{ groupId: 1, streets: torbayStreets, totalPending: 4, extentMeters: 500 }],
                runs: [{ runId: 1, groups: [{ groupId: 1, streets: torbayStreets, totalPending: 4, extentMeters: 500 }], totalPending: 4, streetCount: 3 }],
                totalPending: 4,
                unclusteredStreets: [],
                allStreets: torbayStreets.map((st) => ({ street: st.street, count: 1 })),
              }),
            }), 3000);
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({ success: true, suburb, groups: [], runs: [], totalPending: 0, unclusteredStreets: [], allStreets: [] }) });
      }
      if (s.includes('/api/admin/outreach?')) {
        const u = new URL(s, 'http://localhost');
        const suburb = u.searchParams.get('suburb') || '';
        const streets = u.searchParams.get('streets') || '';
        const sentStatus = u.searchParams.get('sent_status') || '';
        const isUnsentTorbay = sentStatus === 'unsent' && suburb === 'Torbay';
        const staleStreets = streets.includes('Oteha Valley Road');
        if (isUnsentTorbay && staleStreets) {
          // The real bug: the list is filtered to Torbay but the streets belong
          // to Northcross, so zero addresses match.
          return Promise.resolve({ ok: true, json: async () => ({ success: true, data: [], pagination: { page: 1, limit: 500, total: 0, totalPages: 0 } }) });
        }
        if (isUnsentTorbay) {
          return Promise.resolve({ ok: true, json: async () => ({ success: true, data: torbayItems, pagination: { page: 1, limit: 500, total: 4, totalPages: 1 } }) });
        }
        if (sentStatus === 'unsent' && suburb === 'Northcross') {
          return Promise.resolve({ ok: true, json: async () => ({ success: true, data: northcrossItems, pagination: { page: 1, limit: 500, total: 1, totalPages: 1 } }) });
        }
        return Promise.resolve({ ok: true, json: async () => ({ success: true, data: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true, data: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } }) });
    });

    render(<OutreachPage />);

    const pendingTab = await screen.findByRole('button', { name: /Pending/i });
    fireEvent.click(pendingTab);

    // Click Unsent before the default report (600ms) has resolved.
    const unsentBtn = await screen.findByRole('button', { name: 'Unsent' });
    fireEvent.click(unsentBtn);

    // The list must never show the empty "Displaying 1 to 0 of 0 properties"
    // state during the whole sequence, even while the stale Northcross streets
    // are active and the Torbay street-clusters have not resolved yet.
    await waitFor(() => {
      expect(screen.getByText('35 Oteha Valley Road')).toBeTruthy();
    }, { timeout: 2000 });

    // Give the default report time to land and the refetch to run.
    await new Promise((r) => setTimeout(r, 900));

    expect(screen.queryByText('Displaying 1 to 0 of 0 properties')).toBeNull();
    // Eventually the Torbay Today Run data resolves and shows the real addresses.
    await waitFor(() => {
      expect(screen.getByText('1 Acacia Road')).toBeTruthy();
    }, { timeout: 4000 });
  });

  it('keeps the correct total in infinite scroll mode after loading more pages', async () => {
    let ioCallback: ((entries: IntersectionObserverEntry[]) => void) | null = null;
    global.IntersectionObserver = vi.fn().mockImplementation((cb) => {
      ioCallback = cb;
      return { observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() };
    }) as unknown as typeof IntersectionObserver;

    const pageItems: Record<number, any[]> = {};
    for (let i = 0; i < 45; i++) {
      const p = Math.floor(i / 9) + 1;
      (pageItems[p] = pageItems[p] || []).push({
        id: `out-${i + 1}`,
        property_address: `${i + 1} Test Street`,
        street: 'Test Street',
        suburb: 'Torbay',
        city: 'Auckland',
        region: 'Auckland',
        status: 'pending',
        created_at: '2026-07-01T09:00:00Z',
      });
    }

    (global.fetch as any) = vi.fn((url: RequestInfo) => {
      const s = String(url || '');
      if (s.includes('/api/admin/pdf/reports')) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, reports: [] }) });
      }
      if (s.includes('/api/admin/outreach/default-report')) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, defaultReport: null }) });
      }
      if (s.includes('/api/admin/outreach?')) {
        const u = new URL(s, 'http://localhost');
        const page = parseInt(u.searchParams.get('page') || '1', 10);
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: pageItems[page] || [],
            // The real API only returns the total on page 1 (offset 0); later
            // pages return total 0 to skip a full-table COUNT per scroll.
            pagination: { page, limit: 9, total: page === 1 ? 45 : 0, totalPages: page === 1 ? 5 : undefined },
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true, data: [], pagination: { page: 1, limit: 9, total: 0, totalPages: 0 } }) });
    });

    render(<OutreachPage />);

    const pendingTab = await screen.findByRole('button', { name: /Pending/i });
    fireEvent.click(pendingTab);

    await waitFor(() => {
      expect(screen.getAllByText(/Displaying 1 to 9 of 45 properties/).length).toBeGreaterThanOrEqual(1);
    });

    // Scroll: the infinite-scroll sentinel fires → loadMore fetches page 2,
    // which the API answers with total 0.
    act(() => {
      ioCallback?.([{ isIntersecting: true } as IntersectionObserverEntry]);
    });

    await waitFor(() => {
      expect(screen.getAllByText(/Displaying 1 to 18 of 45 properties/).length).toBeGreaterThanOrEqual(1);
    }, { timeout: 3000 });
    expect(screen.queryByText(/Displaying 1 to 18 of 0 properties/)).toBeNull();

    global.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;
  });

  it('shows the correct total on the liked tab in infinite scroll mode after loading more pages', async () => {
    let ioCallback: ((entries: IntersectionObserverEntry[]) => void) | null = null;
    global.IntersectionObserver = vi.fn().mockImplementation((cb) => {
      ioCallback = cb;
      return { observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() };
    }) as unknown as typeof IntersectionObserver;

    const likedItems: any[] = [];
    for (let i = 0; i < 134; i++) {
      likedItems.push({
        id: `lk-${i + 1}`,
        property_address: `${i + 1} Liked Street`,
        street: 'Liked Street',
        suburb: 'Northcross',
        city: 'Auckland',
        region: 'Auckland',
        status: 'liked',
        created_at: '2026-07-01T09:00:00Z',
      });
    }

    (global.fetch as any) = vi.fn((url: RequestInfo) => {
      const s = String(url || '');
      if (s.includes('/api/admin/pdf/reports')) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, reports: [] }) });
      }
      if (s.includes('/api/admin/outreach/default-report')) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, defaultReport: null }) });
      }
      if (s.includes('/api/admin/outreach?')) {
        const u = new URL(s, 'http://localhost');
        const page = parseInt(u.searchParams.get('page') || '1', 10);
        const limit = parseInt(u.searchParams.get('limit') || '9', 10);
        const slice = likedItems.slice((page - 1) * limit, page * limit);
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: slice,
            pagination: { page, limit, total: page === 1 ? 134 : 0, totalPages: page === 1 ? 15 : undefined },
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true, data: [], pagination: { page: 1, limit: 9, total: 0, totalPages: 0 } }) });
    });

    render(<OutreachPage />);

    // The liked tab is the default and infinite scroll is the default mode.
    await waitFor(() => {
      expect(screen.getAllByText(/Displaying 1 to 9 of 134 properties/).length).toBeGreaterThanOrEqual(1);
    }, { timeout: 3000 });

    act(() => {
      ioCallback?.([{ isIntersecting: true } as IntersectionObserverEntry]);
    });

    await waitFor(() => {
      expect(screen.getAllByText(/Displaying 1 to 18 of 134 properties/).length).toBeGreaterThanOrEqual(1);
    }, { timeout: 3000 });
    expect(screen.queryByText(/Displaying 1 to 18 of 0 properties/)).toBeNull();

    global.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;
  });

  it('does not show "Displaying 1 to 9 of 0 properties" on the liked tab when the page-1 total is 0', async () => {
    const likedItems: any[] = [];
    for (let i = 0; i < 9; i++) {
      likedItems.push({
        id: `lk-${i + 1}`,
        property_address: `${i + 1} Liked Street`,
        street: 'Liked Street',
        suburb: 'Northcross',
        city: 'Auckland',
        region: 'Auckland',
        status: 'liked',
        created_at: '2026-07-01T09:00:00Z',
      });
    }

    (global.fetch as any) = vi.fn((url: RequestInfo) => {
      const s = String(url || '');
      if (s.includes('/api/admin/pdf/reports')) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, reports: [] }) });
      }
      if (s.includes('/api/admin/outreach/default-report')) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, defaultReport: null }) });
      }
      if (s.includes('/api/admin/outreach?')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: likedItems,
            pagination: { page: 1, limit: 9, total: 0, totalPages: 0 },
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true, data: [], pagination: { page: 1, limit: 9, total: 0, totalPages: 0 } }) });
    });

    render(<OutreachPage />);

    // The liked tab is the default; items load but the (glitched) page-1 total
    // is 0. The counter must fall back to the loaded item count instead of
    // showing the broken "Displaying 1 to 9 of 0 properties".
    await waitFor(() => {
      expect(screen.getAllByText(/Displaying 1 to 9 of 9 properties/).length).toBeGreaterThanOrEqual(1);
    }, { timeout: 3000 });
    expect(screen.queryByText(/Displaying 1 to 9 of 0 properties/)).toBeNull();
  });

  describe('Filter by Street', () => {
    const streetMemFetch = () => {
      (global.fetch as any) = vi.fn((url: RequestInfo) => {
        const s = String(url || '');
if (s.includes('/api/admin/pdf/reports')) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, reports: [{ suburb: 'Torbay', quarter: 'Q2', year: 2026, id: 'r1' }] }) });
      }
      if (s.includes('/api/admin/outreach/default-report')) {
          return Promise.resolve({ ok: true, json: async () => ({ success: true, defaultReport: null }) });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } }),
        });
      });
    };

    const quickSection = () =>
      within(screen.getByText('Quick Filter by Suburb').closest('div') as HTMLElement);

    it('keeps the default suburb selected when its chip is clicked again', async () => {
      streetMemFetch();
      render(<OutreachPage />);

      await waitFor(() => {
        expect(screen.getByText('🗺️ Filter by Street')).toBeDefined();
      });
      // Northcross is the default suburb on first load; clicking its chip must
      // NOT clear it because a suburb selection is mandatory.
      const quick = quickSection();
      fireEvent.click(quick.getByRole('button', { name: 'Northcross' }));
      fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /By Street \(click to cancel\)/ })).toBeDefined();
      });
      expect(screen.queryByText('Please select a suburb first before applying street filter.')).toBeNull();
    });

    it('hides other suburbs in Quick Filter by Suburb after Apply with a suburb selected', async () => {
      streetMemFetch();
      render(<OutreachPage />);

      const quick = quickSection();
      await waitFor(() => {
        expect(quick.getByRole('button', { name: 'Oteha' })).toBeDefined();
      });
      quick.getByRole('button', { name: 'Oteha' }).click();
      fireEvent.click(await screen.findByRole('button', { name: 'Apply' }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /By Street \(click to cancel\)/ })).toBeDefined();
      });
      expect(quick.getByRole('button', { name: 'Oteha' })).toBeDefined();
      expect(quick.queryByRole('button', { name: 'Albany' })).toBeNull();
      expect(quick.queryByRole('button', { name: 'Northcross' })).toBeNull();
    });

    it('restores other suburbs in Quick Filter by Suburb after cancelling street mode', async () => {
      streetMemFetch();
      render(<OutreachPage />);

      const quick = quickSection();
      await waitFor(() => {
        expect(quick.getByRole('button', { name: 'Oteha' })).toBeDefined();
      });
      quick.getByRole('button', { name: 'Oteha' }).click();
      fireEvent.click(await screen.findByRole('button', { name: 'Apply' }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /By Street \(click to cancel\)/ })).toBeDefined();
      });
      expect(quick.queryByRole('button', { name: 'Albany' })).toBeNull();

      fireEvent.click(screen.getByRole('button', { name: /By Street \(click to cancel\)/ }));
      await waitFor(() => {
        expect(quick.getByRole('button', { name: 'Albany' })).toBeDefined();
        expect(quick.getByRole('button', { name: 'Northcross' })).toBeDefined();
      });
    });

    describe('new street flow', () => {
      const streetItem = (id: string, address: string) => ({
        id,
        property_address: address,
        suburb: 'Takapuna',
        city: 'Auckland',
        region: 'North Shore',
        status: 'liked',
        created_at: '2026-07-01T10:00:00Z',
        no_junk_mail: false,
      });

      const likedFetch = (data: ReturnType<typeof streetItem>[]) => {
(global.fetch as any) = vi.fn((url: RequestInfo) => {
      const s = String(url || '');
      if (s.includes('/api/admin/pdf/reports')) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, reports: [{ suburb: 'Torbay', quarter: 'Q2', year: 2026, id: 'r1' }, { suburb: 'Northcross', quarter: 'Q2', year: 2026, id: 'r2' }] }) });
      }
      if (s.includes('/api/admin/outreach/default-report')) {
            return Promise.resolve({ ok: true, json: async () => ({ success: true, defaultReport: null }) });
          }
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true, data, pagination: { page: 1, limit: 50, total: data.length, totalPages: 1 } }),
          });
        });
      };

      const applyStreetMode = async () => {
        const quick = quickSection();
        await waitFor(() => {
          expect(quick.getByRole('button', { name: 'Oteha' })).toBeDefined();
        });
        quick.getByRole('button', { name: 'Oteha' }).click();
        fireEvent.click(await screen.findByRole('button', { name: 'Apply' }));
        await waitFor(() => {
          expect(screen.getByRole('button', { name: /By Street \(click to cancel\)/ })).toBeDefined();
        });
      };

      const panelSection = () =>
        within(screen.getByText(/Streets in Liked/).parentElement!.parentElement as HTMLElement);

      const STREETS = [
        '5 Alpha Road',
        '12 Alpha Road',
        '9 Bravo Road',
        '3 Charlie Drive',
        '7 Delta Drive',
        '4 Echo Lane',
        '8 Foxtrot Way',
        '2 Golf Avenue',
        '11 Hotel Close',
        '6 Iris Grove',
        '1 Kilo Terrace',
        '10 Lima Boulevard',
        '14 Mike Court',
      ];

      it('shows only 5 streets and reveals 5 more with each More streets click', async () => {
        likedFetch(STREETS.map((addr) => streetItem(`st-${addr}`, addr)));
        render(<OutreachPage />);
        await applyStreetMode();

        const panel = panelSection();
        await waitFor(() => {
          expect(panel.getByRole('button', { name: /Alpha Road/ })).toBeDefined();
        });
        expect(panel.getByRole('button', { name: /Bravo Road/ })).toBeDefined();
        expect(panel.getByRole('button', { name: /Charlie Drive/ })).toBeDefined();
        expect(panel.getByRole('button', { name: /Delta Drive/ })).toBeDefined();
        expect(panel.getByRole('button', { name: /Echo Lane/ })).toBeDefined();
        expect(panel.queryByRole('button', { name: /Foxtrot Way/ })).toBeNull();
        expect(panel.getByRole('button', { name: /More streets/i })).toBeDefined();

        fireEvent.click(panel.getByRole('button', { name: /More streets/i }));
        await waitFor(() => {
          expect(panel.getByRole('button', { name: /Foxtrot Way/ })).toBeDefined();
          expect(panel.getByRole('button', { name: /Kilo Terrace/ })).toBeDefined();
          expect(panel.queryByRole('button', { name: /Lima Boulevard/ })).toBeNull();
          expect(panel.getByRole('button', { name: /More streets/i })).toBeDefined();
        });

        fireEvent.click(panel.getByRole('button', { name: /More streets/i }));
        await waitFor(() => {
          expect(panel.getByRole('button', { name: /Mike Court/ })).toBeDefined();
          expect(panel.queryByRole('button', { name: /More streets/i })).toBeNull();
        });
      });

      it('auto-selects the first street without triggering a re-fetch on Apply', async () => {
        // Fix: Apply no longer mutates propertyFilter / lastSoldPreset, so no
        // debounce re-fetch is triggered that would clear displayItems before
        // likedStreetsSummary can be derived.  The street panel shows streets
        // from the already-loaded items snapshot immediately.
        const calls: string[] = [];
        likedFetch(STREETS.map((addr) => streetItem(`st-${addr}`, addr)));
        (global.fetch as any) = vi.fn((url: RequestInfo) => {
          const s = String(url || '');
          calls.push(s);
          if (s.includes('/api/admin/pdf/reports')) {
            return Promise.resolve({ ok: true, json: async () => ({ success: true, reports: [] }) });
          }
          if (s.includes('/api/admin/outreach/default-report')) {
            return Promise.resolve({ ok: true, json: async () => ({ success: true, defaultReport: null }) });
          }
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true, data: STREETS.map((addr) => streetItem(`st-${addr}`, addr)), pagination: { page: 1, limit: 50, total: STREETS.length, totalPages: 1 } }),
          });
        });

        render(<OutreachPage />);
        await applyStreetMode();

        const panel = panelSection();
        // First street auto-selected → Clear Filter button appears.
        expect(panel.getByRole('button', { name: /Clear Filter/ })).toBeDefined();
        // Other streets remain visible for the next selection (req 4).
        expect(panel.getByRole('button', { name: /Bravo Road/ })).toBeDefined();

        // Apply must NOT add standalone_only=true or change lastSoldPreset —
        // those mutations were removed so they don't trigger a debounce
        // re-fetch that clears displayItems (root cause of the "No streets" bug).
        await waitFor(() => {
          const likedCalls = calls.filter((c) => c.includes('/api/admin/outreach?') && c.includes('status=liked'));
          const last = likedCalls[likedCalls.length - 1] || '';
          expect(last).not.toContain('standalone_only=true');
        }, { timeout: 3000 });
      });

      it('shows the addresses and a counter that match the auto-selected street', async () => {
        likedFetch(STREETS.map((addr) => streetItem(`st-${addr}`, addr)));
        render(<OutreachPage />);
        await applyStreetMode();

        await waitFor(() => {
          expect(screen.getAllByText(/Displaying 1 to 2 of 2 properties/).length).toBeGreaterThanOrEqual(1);
        });
        // The displayed list shows only the selected street's addresses.
        expect(screen.getByText('5 Alpha Road')).toBeDefined();
        expect(screen.getByText('12 Alpha Road')).toBeDefined();
        expect(screen.queryByText('9 Bravo Road')).toBeNull();
      });

      it('lists all liked streets alphabetically in Start street and re-fetches from the chosen street', async () => {
        const calls: string[] = [];
        (global.fetch as any) = vi.fn((url: RequestInfo) => {
          const s = String(url || '');
          calls.push(s);
          if (s.includes('/api/admin/pdf/reports')) {
            return Promise.resolve({ ok: true, json: async () => ({ success: true, reports: [] }) });
          }
          if (s.includes('/api/admin/outreach/default-report')) {
            return Promise.resolve({ ok: true, json: async () => ({ success: true, defaultReport: null }) });
          }
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true, data: STREETS.map((addr) => streetItem(`st-${addr}`, addr)), pagination: { page: 1, limit: 50, total: STREETS.length, totalPages: 1 } }),
          });
        });

        render(<OutreachPage />);
        await applyStreetMode();

        const panel = panelSection();
        const startSelect = panel.getByRole('combobox', { name: 'Start street' }) as HTMLSelectElement;
        expect(startSelect).toBeDefined();
        // All streets listed in alphabetical order inside the selector.
        expect(startSelect.textContent).toContain('Alpha Road');
        expect(startSelect.textContent).toContain('Mike Court');
        fireEvent.change(startSelect, { target: { value: 'Foxtrot Way' } });

        await waitFor(() => {
          const likedCalls = calls.filter((c) => c.includes('/api/admin/outreach?') && c.includes('status=liked'));
          const last = likedCalls[likedCalls.length - 1] || '';
          expect(last).toContain('start_street=Foxtrot+Way');
        }, { timeout: 3000 });
      });

      it('shows the first five streets anchored on the selected Start street, wrapping alphabetically', async () => {
        window.localStorage.clear();
        likedFetch(STREETS.map((addr) => streetItem(`st-${addr}`, addr)));
        render(<OutreachPage />);
        await applyStreetMode();

        const panel = panelSection();
        // Default: no Start street selected → first five streets are alphabetical.
        expect(panel.getByRole('button', { name: /Alpha Road/ })).toBeDefined();
        expect(panel.queryByRole('button', { name: /Foxtrot Way/ })).toBeNull();

        // Select 'Foxtrot Way' as the Start street.
        const startSelect = panel.getByRole('combobox', { name: 'Start street' }) as HTMLSelectElement;
        fireEvent.change(startSelect, { target: { value: 'Foxtrot Way' } });

        await waitFor(() => {
          expect(panel.getByRole('button', { name: /Foxtrot Way/ })).toBeDefined();
        });
        // Window now starts at Foxtrot: Foxtrot/Golf/Hotel/Iris/Kilo, Alpha hidden.
        expect(panel.getByRole('button', { name: /Golf Avenue/ })).toBeDefined();
        expect(panel.getByRole('button', { name: /Hotel Close/ })).toBeDefined();
        expect(panel.getByRole('button', { name: /Iris Grove/ })).toBeDefined();
        expect(panel.getByRole('button', { name: /Kilo Terrace/ })).toBeDefined();
        expect(panel.queryByRole('button', { name: /Alpha Road/ })).toBeNull();
      });

      it('persists the selected Start street for later visits', async () => {
        window.localStorage.clear();
        likedFetch(STREETS.map((addr) => streetItem(`st-${addr}`, addr)));
        render(<OutreachPage />);
        await applyStreetMode();

        const panel = panelSection();
        const startSelect = panel.getByRole('combobox', { name: 'Start street' }) as HTMLSelectElement;
        expect(startSelect.value).toBe('');
        fireEvent.change(startSelect, { target: { value: 'Golf Avenue' } });

        await waitFor(() => {
          expect(window.localStorage.getItem('liked_start_street:Oteha')).toBe('Golf Avenue');
        });

        // Re-applying (e.g. after cancelling) restores the previous choice.
        fireEvent.click(screen.getByRole('button', { name: /By Street \(click to cancel\)/ }));
        await waitFor(() => {
          expect(screen.getByRole('button', { name: 'Apply' })).toBeDefined();
        });
        fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
        await waitFor(() => {
          const restored = panelSection().getByRole('combobox', { name: 'Start street' }) as HTMLSelectElement;
          expect(restored.value).toBe('Golf Avenue');
        });
      });
    });
  });

  it('sends streets= param in the debounced fetch after Today Run auto-selects', async () => {
    const clusterStreets = [
      { street: 'Alpha Street', suburb: 'Torbay', lat: -36.69, lng: 174.71, pendingCount: 2, addresses: ['3 Alpha Street', '5 Alpha Street'] },
      { street: 'Zeta Street', suburb: 'Torbay', lat: -36.68, lng: 174.72, pendingCount: 1, addresses: ['7 Zeta Street'] },
    ];
    const allItems = [
      { id: 'out-a1', property_address: '3 Alpha Street', street: 'Alpha Street', suburb: 'Torbay', city: 'Auckland', region: 'Auckland', status: 'PENDING', created_at: '2026-07-01T10:00:00Z' },
      { id: 'out-a2', property_address: '5 Alpha Street', street: 'Alpha Street', suburb: 'Torbay', city: 'Auckland', region: 'Auckland', status: 'PENDING', created_at: '2026-07-01T10:01:00Z' },
      { id: 'out-z', property_address: '7 Zeta Street', street: 'Zeta Street', suburb: 'Torbay', city: 'Auckland', region: 'Auckland', status: 'PENDING', created_at: '2026-07-01T10:02:00Z' },
      { id: 'out-b', property_address: '9 Beta Street', street: 'Beta Street', suburb: 'Torbay', city: 'Auckland', region: 'Auckland', status: 'PENDING', created_at: '2026-07-01T10:03:00Z' },
    ];
    const runStreets = ['Alpha Street', 'Zeta Street'];

    (global.fetch as any) = vi.fn((url: RequestInfo) => {
      const s = String(url || '');
      if (s.includes('/api/admin/pdf/reports')) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, reports: [{ suburb: 'Torbay', quarter: 'Q2', year: 2026, id: 'r1' }] }) });
      }
      if (s.includes('/api/admin/outreach/default-report')) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, defaultReport: null }) });
      }
      if (s.includes('/api/admin/outreach/street-clusters')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            suburb: 'Torbay',
            groups: [{ groupId: 1, streets: clusterStreets, totalPending: 3, extentMeters: 500 }],
            runs: [{ runId: 1, groups: [{ groupId: 1, streets: clusterStreets, totalPending: 3, extentMeters: 500 }], totalPending: 3, streetCount: 2 }],
            totalPending: 3,
            unclusteredStreets: [],
            allStreets: [{ street: 'Alpha Street', count: 2 }, { street: 'Zeta Street', count: 1 }],
          }),
        });
      }
      if (s.includes('/api/admin/outreach?')) {
        const u = new URL(s, 'http://localhost');
        const streets = u.searchParams.get('streets') || '';
        if (streets.includes('Alpha Street') && streets.includes('Zeta Street')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: allItems.filter(i => streets.split(',').includes(i.street)),
              pagination: { page: 1, limit: 500, total: 3, totalPages: 1 },
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: allItems,
            pagination: { page: 1, limit: 50, total: 4, totalPages: 1 },
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true, data: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } }) });
    });

    render(<OutreachPage />);

    const pendingTab = await screen.findByRole('button', { name: /Pending/i });
    fireEvent.click(pendingTab);

    const reportSection = (await screen.findByText('📋 Filter by Report')).closest('div') as HTMLElement;
    fireEvent.click(await within(reportSection).findByRole('button', { name: /2026-Q2/ }));

    const unsentBtn = await screen.findByRole('button', { name: 'Unsent' });
    fireEvent.click(unsentBtn);

    // Wait for Today Run to auto-select and the debounced fetch to fire
    await waitFor(() => {
      const calls = vi.mocked(global.fetch).mock.calls.map(c => String(c[0]));
      const debouncedCall = calls.find(u =>
        u.includes('/api/admin/outreach?') &&
        u.includes('streets=') &&
        u.includes('Alpha+Street') || u.includes('Alpha%20Street')
      );
      expect(debouncedCall).toBeTruthy();
    }, { timeout: 4000 });

    // Verify Beta Street is NOT in the streets param (only run streets)
    const allCalls = vi.mocked(global.fetch).mock.calls.map(c => String(c[0]));
    const debouncedCalls = allCalls.filter(u =>
      u.includes('/api/admin/outreach?') && (u.includes('Alpha+Street') || u.includes('Alpha%20Street'))
    );
    for (const call of debouncedCalls) {
      expect(call).not.toContain('Beta+Street');
      expect(call).not.toContain('Beta%20Street');
    }
  });

  it('does not send stale empty streets= after Today Run auto-selects (fetchItemsRef ensures latest closure)', async () => {
    const clusterStreets = [
      { street: 'Acacia Road', suburb: 'Torbay', lat: -36.6958, lng: 174.7453, pendingCount: 2, addresses: ['1 Acacia Road', '3 Acacia Road'] },
    ];
    const torbayItems = [
      { id: 't1', property_address: '1 Acacia Road', street: 'Acacia Road', suburb: 'Torbay', city: 'Auckland', region: 'Auckland', status: 'PENDING', created_at: '2026-07-01T09:00:00Z' },
      { id: 't2', property_address: '3 Acacia Road', street: 'Acacia Road', suburb: 'Torbay', city: 'Auckland', region: 'Auckland', status: 'PENDING', created_at: '2026-07-01T09:01:00Z' },
    ];
    const callLog: string[] = [];

    (global.fetch as any) = vi.fn((url: RequestInfo) => {
      const s = String(url || '');
      if (s.includes('/api/admin/pdf/reports')) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, reports: [{ suburb: 'Torbay', quarter: 'Q2', year: 2026, id: 'r1' }] }) });
      }
      if (s.includes('/api/admin/outreach/default-report')) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, defaultReport: null }) });
      }
      if (s.includes('/api/admin/outreach/street-clusters')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            suburb: 'Torbay',
            groups: [{ groupId: 1, streets: clusterStreets, totalPending: 2, extentMeters: 500 }],
            runs: [{ runId: 1, groups: [{ groupId: 1, streets: clusterStreets, totalPending: 2, extentMeters: 500 }], totalPending: 2, streetCount: 1 }],
            totalPending: 2,
            unclusteredStreets: [],
            allStreets: [{ street: 'Acacia Road', count: 2 }],
          }),
        });
      }
      if (s.includes('/api/admin/outreach?')) {
        callLog.push(s);
        const u = new URL(s, 'http://localhost');
        const streets = u.searchParams.get('streets') || '';
        const suburb = u.searchParams.get('suburb') || '';
        const sentStatus = u.searchParams.get('sent_status') || '';
        if (sentStatus === 'unsent' && streets.includes('Acacia Road')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: torbayItems,
              pagination: { page: 1, limit: 500, total: 2, totalPages: 1 },
            }),
          });
        }
        if (sentStatus === 'unsent') {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: torbayItems,
              pagination: { page: 1, limit: 500, total: 2, totalPages: 1 },
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: [],
            pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true, data: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } }) });
    });

render(<OutreachPage />);

    const pendingTab = await screen.findByRole('button', { name: /Pending/i });
    fireEvent.click(pendingTab);

    await screen.findByRole('button', { name: /2026-Q2/ }, { timeout: 5000 });
    fireEvent.click(await screen.findByRole('button', { name: /2026-Q2/ }, { timeout: 5000 }));

    const unsentBtn = await screen.findByRole('button', { name: 'Unsent' });
    fireEvent.click(unsentBtn);

    // Wait for the Today Run auto-select to fire and the debounced fetch to use streets
    await waitFor(() => {
      const streetsCalls = callLog.filter(u => u.includes('streets='));
      expect(streetsCalls.length).toBeGreaterThan(0);
    }, { timeout: 4000 });

    // Every streets= call must include Acacia Road (the run street), never empty streets
    const streetsCalls = callLog.filter(u => u.includes('streets='));
    for (const call of streetsCalls) {
      expect(call).toContain('Acacia+Road');
    }

    // Eventually show the correct addresses
    await waitFor(() => {
      expect(screen.getByText('1 Acacia Road')).toBeTruthy();
      expect(screen.getByText('3 Acacia Road')).toBeTruthy();
    }, { timeout: 3000 });
  });
});

describe('Outreach page - pagination size by view mode', () => {
  const outreachItem = (i: number) => ({
    id: `liked-${i}`,
    property_address: `5 Alpha Road`,
    suburb: 'Oteha',
    city: 'Auckland',
    region: 'North Shore',
    status: 'liked',
    created_at: '2026-07-01T10:00:00Z',
    image_url: '/static/media/no-photo-available.png',
    no_junk_mail: false,
    joined_property_id: `prop-${i}`,
    build_year: 1990,
  });

  const limitAwareFetch = () => {
    (global.fetch as any) = vi.fn((url: RequestInfo) => {
      const s = String(url || '');
      if (s.startsWith('/api/admin/outreach?') && s.includes('status=liked')) {
        const parsed = new URL(s, 'http://localhost');
        const limit = Number(parsed.searchParams.get('limit') || '0');
        const total = 45;
        const data = Array.from({ length: Math.min(limit, total) }, (_, i) => outreachItem(i));
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data,
            pagination: { page: 1, limit, total, totalPages: Math.ceil(total / limit) },
          }),
        });
      }
      if (s.includes('/api/admin/outreach/default-report')) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, defaultReport: null }) });
      }
      if (s.includes('/api/admin/outreach/liked-streets')) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, all_streets: [], ordered_streets: [] }) });
      }
      if (s.includes('/api/admin/outreach/like')) {
        return Promise.resolve({ ok: true, json: async () => ({ liked_ids: [] }) });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } }),
      });
    });
  };

  const outreachListUrls = () =>
    (global.fetch as any).mock.calls
      .map((c: any[]) => String(c[0] || ''))
      .filter((u: string) => u.includes('/api/admin/outreach?'));

  beforeEach(() => {
    mockPush.mockReset();
    mockSession = {
      data: { user: { email: 'nzlouis.com@gmail.com' } },
      status: 'authenticated',
    };
    limitAwareFetch();
  });

  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
    window.localStorage.clear();
  });

  it('requests 9 properties per page in card view', async () => {
    render(<OutreachPage />);

    await waitFor(() => {
      const urls = outreachListUrls();
      expect(urls.some((u: string) => u.includes('limit=9'))).toBe(true);
      expect(urls.every((u: string) => !u.includes('limit=18'))).toBe(true);
    });
  });

  it('requests 18 properties per page after switching to list view', async () => {
    render(<OutreachPage />);
    await waitFor(() => expect(screen.getByText('❤️ Liked')).toBeDefined());

    fireEvent.click(screen.getByRole('button', { name: /☰ List/i }));

    await waitFor(() => {
      const urls = outreachListUrls();
      expect(urls.some((u: string) => u.includes('limit=18'))).toBe(true);
    });
  });

  it('shows 9 per page in card classic mode and 18 after switching to list', async () => {
    render(<OutreachPage />);
    await waitFor(() => expect(screen.getByText('❤️ Liked')).toBeDefined());

    fireEvent.click(screen.getByText('Classic Pages'));
    await waitFor(() => {
      expect(screen.getAllByText(/Displaying 1 to 9 of 45 properties/).length).toBeGreaterThanOrEqual(1);
    });

    fireEvent.click(screen.getByRole('button', { name: /☰ List/i }));
    await waitFor(() => {
      expect(screen.getAllByText(/Displaying 1 to 18 of 45 properties/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('resets classic page to 1 when switching from card to list', async () => {
    render(<OutreachPage />);
    await waitFor(() => expect(screen.getByText('❤️ Liked')).toBeDefined());

    fireEvent.click(screen.getByText('Classic Pages'));
    await waitFor(() => {
      expect(screen.getAllByText('1–9 of 45').length).toBeGreaterThanOrEqual(1);
    });

    // Move to page 2 in card classic mode.
    fireEvent.click(screen.getAllByText('›')[0]);
    await waitFor(() => {
      expect(screen.getAllByText(/1[0-9]–18 of 45/).length).toBeGreaterThanOrEqual(1);
    });

    // Switching to list resets to page 1 and uses the 18-per-page footer.
    fireEvent.click(screen.getByRole('button', { name: /☰ List/i }));
    await waitFor(() => {
      expect(screen.getAllByText('1–18 of 45').length).toBeGreaterThanOrEqual(1);
    });
  });
});

describe('Outreach page - Last Sold resets to All when default report applies', () => {
  const records = [
    {
      id: 'out-1',
      property_address: '15 Marine Parade',
      suburb: 'Oteha',
      city: 'Auckland',
      region: 'North Shore',
      status: 'PENDING',
      created_at: '2026-07-01T10:00:00Z',
    },
  ];

  const filterPanel = () => screen.getByText('Search Filters').parentElement!.parentElement as HTMLElement;
  const lastSoldScope = () => within(within(filterPanel()).getByText('Last Sold').closest('div') as HTMLElement);
  const outreachListUrls = () =>
    (global.fetch as any).mock.calls
      .map((c: any[]) => String(c[0] || ''))
      .filter((u: string) => u.includes('/api/admin/outreach?') && u.includes('status=pending'));

  function defaultReportFetch(calls: string[]) {
    (global.fetch as any) = vi.fn((url: RequestInfo) => {
      const s = String(url || '');
      calls.push(s);
      if (s.includes('/api/admin/outreach/default-report')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, defaultReport: { suburb: 'Oteha', label: '2026-Q2' } }),
        });
      }
      if (s.includes('/api/admin/pdf/reports')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            reports: [{ suburb: 'Oteha', quarter: 'Q2', year: 2026, id: 'r1' }],
          }),
        });
      }
      if (s.includes('/api/admin/outreach?')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: records,
            pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true, data: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } }) });
    });
  }

  beforeEach(() => {
    mockPush.mockReset();
    mockSession = {
      data: { user: { email: 'nzlouis.com@gmail.com' } },
      status: 'authenticated',
    };
    global.fetch = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
    window.localStorage.clear();
  });

  it('defaults Last Sold to All when first entering the page (Liked tab)', async () => {
    defaultReportFetch([]);
    render(<OutreachPage />);

    await waitFor(() => {
      const allBtn = lastSoldScope().getByRole('button', { name: 'All' });
      expect(allBtn.style.backgroundColor).not.toBe('white');
    });
    // The old "5-15 years" default preset is no longer pre-selected.
    const presetBtn = lastSoldScope().getByRole('button', { name: '★ 5-15 years' });
    expect(presetBtn.style.backgroundColor).toBe('white');
  });

  it('does not send last_sold query params on the initial Liked request', async () => {
    const calls: string[] = [];
    defaultReportFetch(calls);
    render(<OutreachPage />);

    await waitFor(() => {
      const likedUrls = calls.filter(
        (c) => c.includes('/api/admin/outreach?') && c.includes('status=liked')
      );
      expect(likedUrls.length).toBeGreaterThan(0);
      for (const url of likedUrls) {
        expect(url).not.toContain('last_sold_min_years');
        expect(url).not.toContain('last_sold_max_years');
      }
    }, { timeout: 3000 });
  });

  it('resets Last Sold to All after clicking Pending and the default report auto-applies', async () => {
    defaultReportFetch([]);
    render(<OutreachPage />);

    const pendingTab = await screen.findByRole('button', { name: /Pending/i });
    fireEvent.click(pendingTab);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Oteha ★' })).toBeTruthy();
    }, { timeout: 3000 });

    await waitFor(() => {
      const allBtn = lastSoldScope().getByRole('button', { name: 'All' });
      expect(allBtn.style.backgroundColor).not.toBe('white');
    }, { timeout: 3000 });

    // The old preset is no longer highlighted.
    const presetBtn = lastSoldScope().getByRole('button', { name: '★ 5-15 years' });
    expect(presetBtn.style.backgroundColor).toBe('white');
  });

  it('omits last_sold query params from the Pending list request once the default report applies', async () => {
    const calls: string[] = [];
    defaultReportFetch(calls);
    render(<OutreachPage />);

    const pendingTab = await screen.findByRole('button', { name: /Pending/i });
    fireEvent.click(pendingTab);

    await waitFor(() => {
      const urls = outreachListUrls();
      expect(urls.length).toBeGreaterThan(0);
      const last = urls[urls.length - 1];
      expect(last).toContain('status=pending');
      expect(last).not.toContain('last_sold_min_years');
      expect(last).not.toContain('last_sold_max_years');
    }, { timeout: 3000 });
  });

  it('does not reset Property Type or Market Status when the default report applies', async () => {
    defaultReportFetch([]);
    render(<OutreachPage />);

    const propTypeScope = () => within(within(filterPanel()).getByText('Property Type').closest('div') as HTMLElement);
    const marketScope = () => within(within(filterPanel()).getByText('Market Status').closest('div') as HTMLElement);

    const pendingTab = await screen.findByRole('button', { name: /Pending/i });
    fireEvent.click(pendingTab);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Oteha ★' })).toBeTruthy();
    }, { timeout: 3000 });

    // Only Last Sold is touched — Property Type and Market Status keep their values (All).
    await waitFor(() => {
      expect(propTypeScope().getByRole('button', { name: 'All' }).style.backgroundColor).not.toBe('white');
    }, { timeout: 3000 });
    expect(marketScope().getByRole('button', { name: 'All' }).style.backgroundColor).not.toBe('white');
    expect(propTypeScope().getByRole('button', { name: 'House' }).style.backgroundColor).toBe('white');
  });
});

describe('Outreach page - scroll to top after actions', () => {
  let scrollToSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    scrollToSpy = vi.fn();
    vi.stubGlobal('scrollTo', scrollToSpy);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  function makeOutreachFetch() {
    return (global.fetch as any) = vi.fn((url: RequestInfo, init?: RequestInit) => {
      const s = String(url || '');
      if (s.includes('/api/admin/pdf/reports')) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, reports: [] }) });
      }
      if (s.includes('/api/admin/outreach/default-report')) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, defaultReport: null }) });
      }
      if (s.includes('/api/admin/outreach?')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: [
              { id: 'addr-1', property_address: '1 Main St', suburb: 'Takapuna', city: 'North Shore', region: 'Auckland', status: 'liked', created_at: '2024-01-01', bedrooms: 3, bathrooms: 1, car_spaces: 1, capital_value: 500000, last_sold_price: 400000, last_sold_date: '2020-01-01', build_year: 1990, image_url: '', property_url: '' },
              { id: 'addr-2', property_address: '2 Oak Ave', suburb: 'Takapuna', city: 'North Shore', region: 'Auckland', status: 'liked', created_at: '2024-01-02', bedrooms: 4, bathrooms: 2, car_spaces: 2, capital_value: 600000, last_sold_price: 500000, last_sold_date: '2021-01-01', build_year: 1995, image_url: '', property_url: '' },
            ],
            pagination: { page: 1, limit: 9, total: 2, totalPages: 1 },
          }),
        });
      }
      if (s.includes('/api/admin/outreach/') && s.includes('/status') && init?.method === 'PATCH') {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, data: {} }) });
      }
      if (s.includes('/api/admin/outreach/') && init?.method === 'DELETE') {
        return Promise.resolve({ ok: true, json: async () => ({}) });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
  }

  it('scrolls to top after marking selected addresses as Pending', async () => {
    makeOutreachFetch();
    render(<OutreachPage />);

    await waitFor(() => {
      expect(screen.getByText('1 Main St')).toBeTruthy();
    }, { timeout: 3000 });

    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.forEach((cb) => fireEvent.click(cb));

    const pendingBtn = screen.getByRole('button', { name: /Mark as Pending/i });
    fireEvent.click(pendingBtn);

    await waitFor(() => {
      expect(scrollToSpy).toHaveBeenCalledWith(0, 0);
    }, { timeout: 3000 });
  });

  it('scrolls to top after deleting selected addresses', async () => {
    makeOutreachFetch();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<OutreachPage />);

    await waitFor(() => {
      expect(screen.getByText('1 Main St')).toBeTruthy();
    }, { timeout: 3000 });

    const checkbox = screen.getAllByRole('checkbox')[0];
    fireEvent.click(checkbox);

    const deleteBtn = screen.getAllByRole('button', { name: /Delete/i })[0];
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(scrollToSpy).toHaveBeenCalledWith(0, 0);
    }, { timeout: 3000 });

    confirmSpy.mockRestore();
  });

  it('scrolls to top after inline Pending action on a liked card', async () => {
    makeOutreachFetch();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<OutreachPage />);

    await waitFor(() => {
      expect(screen.getByText('1 Main St')).toBeTruthy();
    }, { timeout: 3000 });

    const pendingBtn = screen.getAllByRole('button', { name: /⇨ Pending/i })[0];
    fireEvent.click(pendingBtn);

    await waitFor(() => {
      expect(scrollToSpy).toHaveBeenCalledWith(0, 0);
    }, { timeout: 3000 });

    confirmSpy.mockRestore();
  });
});

describe('Outreach page - Return to Pending actions', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockSession = {
      data: { user: { email: 'nzlouis.com@gmail.com' } },
      status: 'authenticated',
    };
    global.fetch = vi.fn();
    vi.stubGlobal('scrollTo', vi.fn());
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  function makeOutreachFetch(sentStatus = 'sent') {
    return (global.fetch as any) = vi.fn((url: RequestInfo, init?: RequestInit) => {
      const s = String(url || '');
      if (s.includes('/api/admin/pdf/reports')) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, reports: [] }) });
      }
      if (s.includes('/api/admin/outreach/default-report')) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, defaultReport: null }) });
      }
      if (s.includes('/api/admin/outreach?')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: [
              { id: 'addr-1', property_address: '1 Main St', suburb: 'Oteha', city: 'North Shore', region: 'Auckland', status: sentStatus, created_at: '2024-01-01', bedrooms: 3, bathrooms: 1, car_spaces: 1, capital_value: 500000, last_sold_price: 400000, last_sold_date: '2020-01-01', build_year: 1990, image_url: '', property_url: '' },
              { id: 'addr-2', property_address: '2 Oak Ave', suburb: 'Oteha', city: 'North Shore', region: 'Auckland', status: sentStatus, created_at: '2024-01-02', bedrooms: 4, bathrooms: 2, car_spaces: 2, capital_value: 600000, last_sold_price: 500000, last_sold_date: '2021-01-01', build_year: 1995, image_url: '', property_url: '' },
            ],
            pagination: { page: 1, limit: 9, total: 2, totalPages: 1 },
          }),
        });
      }
      if (s.includes('/api/admin/outreach/') && s.includes('/status') && init?.method === 'PATCH') {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, data: {} }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
  }

  it('shows Return to Pending before Return to Liked on the Pending tab and PATCHes status to pending', async () => {
    makeOutreachFetch('pending');
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<OutreachPage />);

    await waitFor(() => {
      expect(screen.getByText('1 Main St')).toBeTruthy();
    }, { timeout: 3000 });

    fireEvent.click(screen.getByRole('button', { name: '⏳ Pending' }));

    await waitFor(() => {
      expect(screen.getByText('1 Main St')).toBeTruthy();
    }, { timeout: 3000 });

    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.forEach((cb) => fireEvent.click(cb));

    const returnToPendingBtn = screen.getByRole('button', { name: /Return to Pending/i });
    const returnToLikedBtn = screen.getByRole('button', { name: /Return to Liked/i });
    const allButtons = screen.getAllByRole('button');
    expect(allButtons.indexOf(returnToPendingBtn)).toBeLessThan(allButtons.indexOf(returnToLikedBtn));

    fireEvent.click(returnToPendingBtn);
    expect(confirmSpy).toHaveBeenCalled();

    await waitFor(() => {
      const statusCalls = (global.fetch as any).mock.calls.filter(
        (c: unknown[]) => String(c[0]).includes('/status') && (c[1] as RequestInit)?.method === 'PATCH'
      );
      expect(statusCalls.length).toBeGreaterThan(0);
      expect(JSON.parse((statusCalls[0][1] as RequestInit).body as string).status).toBe('pending');
    }, { timeout: 3000 });

    confirmSpy.mockRestore();
  });

  it('confirms and PATCHes status to pending from the Sent tab bulk bar', async () => {
    makeOutreachFetch('sent');
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<OutreachPage />);

    await waitFor(() => {
      expect(screen.getByText('1 Main St')).toBeTruthy();
    }, { timeout: 3000 });

    fireEvent.click(screen.getByRole('button', { name: '✓ Sent' }));

    await waitFor(() => {
      expect(screen.getByText('1 Main St')).toBeTruthy();
    }, { timeout: 3000 });

    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.forEach((cb) => fireEvent.click(cb));

    const returnToPendingBtn = screen.getByRole('button', { name: /Return to Pending/i });
    fireEvent.click(returnToPendingBtn);
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('Return 2 addresses to Pending?'));

    await waitFor(() => {
      const statusCalls = (global.fetch as any).mock.calls.filter(
        (c: unknown[]) => String(c[0]).includes('/status') && (c[1] as RequestInit)?.method === 'PATCH'
      );
      expect(statusCalls.length).toBe(2);
      for (const call of statusCalls) {
        expect(JSON.parse((call[1] as RequestInit).body as string).status).toBe('pending');
      }
    }, { timeout: 3000 });

    confirmSpy.mockRestore();
  });

  it('does not PATCH when the Return to Pending confirm is cancelled on the Sent tab', async () => {
    makeOutreachFetch('sent');
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(<OutreachPage />);

    await waitFor(() => {
      expect(screen.getByText('1 Main St')).toBeTruthy();
    }, { timeout: 3000 });

    fireEvent.click(screen.getByRole('button', { name: '✓ Sent' }));

    await waitFor(() => {
      expect(screen.getByText('1 Main St')).toBeTruthy();
    }, { timeout: 3000 });

    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.forEach((cb) => fireEvent.click(cb));

    fireEvent.click(screen.getByRole('button', { name: /Return to Pending/i }));

    await new Promise((r) => setTimeout(r, 300));
    const statusCalls = (global.fetch as any).mock.calls.filter(
      (c: unknown[]) => String(c[0]).includes('/status') && (c[1] as RequestInit)?.method === 'PATCH'
    );
    expect(statusCalls).toHaveLength(0);

    confirmSpy.mockRestore();
  });
});


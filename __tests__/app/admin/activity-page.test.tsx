import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';

let useSessionMock: any;

vi.mock('next-auth/react', () => ({
  useSession: () => useSessionMock(),
}));

vi.mock('@/components/admin/Skeleton', () => ({
  SkeletonBookings: () => <div>Loading appraisals</div>,
  SkeletonDownloads: () => <div>Loading downloads</div>,
  SkeletonOutreach: () => <div />,
  SkeletonOutreachCard: () => <div />,
  SkeletonOutreachListRow: () => <div />,
}));

vi.mock('@/components/admin/DispatchStatsPanel', () => ({
  default: () => <div data-testid="dispatch-stats-panel" />,
}));

const mockBookings = [
  {
    id: 'booking-1',
    client_name: 'Test Client',
    email: 'client@example.com',
    phone: '+64210000000',
    property_address: '1 Test Street, Torbay',
    suburb: 'Torbay',
    contact_status: 'new',
    priority: 'high',
    created_at: '2026-10-20T10:00:00.000Z',
  },
];

function mockFetchSuccess() {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      data: mockBookings,
      pagination: { page: 1, limit: 50, total: mockBookings.length, totalPages: 1 },
    }),
  });
}

async function loadActivityPage() {
  const ActivityPage = (await import('../../../app/admin/activity/page')).default;
  return render(<ActivityPage />);
}

describe('Activity page tabs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.pushState({}, '', '/admin/activity');
    useSessionMock = vi.fn().mockReturnValue({
      data: { user: { email: 'admin@test.com', name: 'Admin' } },
      status: 'authenticated',
    });
    vi.stubGlobal('fetch', mockFetchSuccess());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('renders Appraisals as the first tab and as the default active tab', async () => {
    await loadActivityPage();

    await waitFor(() => {
      expect(screen.getByText('Appraisal List')).toBeTruthy();
    });

    const appraisalsButton = screen.getByRole('button', { name: 'Appraisals' });
    const nav = appraisalsButton.closest('nav') as HTMLElement;
    const tabLabels = Array.from(nav.querySelectorAll('button')).map((button) =>
      button.textContent?.trim()
    );
    expect(tabLabels).toEqual(['Appraisals', 'Dispatch Stats', 'Downloads']);

    expect(appraisalsButton.className).toContain('border-indigo-600');
    expect(appraisalsButton.className).toContain('text-indigo-600');
    expect(screen.getByText('Test Client')).toBeTruthy();

    const dispatchWrapper = screen.getByTestId('dispatch-stats-panel').parentElement as HTMLElement;
    expect(dispatchWrapper.className).toContain('hidden');
  });

  it('switches to Dispatch Stats when its tab is clicked', async () => {
    await loadActivityPage();

    await waitFor(() => {
      expect(screen.getByText('Appraisal List')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Dispatch Stats' }));

    const dispatchButton = screen.getByRole('button', { name: 'Dispatch Stats' });
    expect(dispatchButton.className).toContain('border-indigo-600');

    const dispatchWrapper = screen.getByTestId('dispatch-stats-panel').parentElement as HTMLElement;
    expect(dispatchWrapper.className).not.toContain('hidden');

    const appraisalsButton = screen.getByRole('button', { name: 'Appraisals' });
    expect(appraisalsButton.className).not.toContain('border-indigo-600');
  });

  it('opens the Dispatch Stats tab from the ?tab=dispatch query parameter', async () => {
    window.history.pushState({}, '', '/admin/activity?tab=dispatch');

    await loadActivityPage();

    await waitFor(() => {
      const dispatchWrapper = screen.getByTestId('dispatch-stats-panel').parentElement as HTMLElement;
      expect(dispatchWrapper.className).not.toContain('hidden');
    });

    expect(screen.getByRole('button', { name: 'Dispatch Stats' }).className).toContain(
      'border-indigo-600'
    );
  });
});

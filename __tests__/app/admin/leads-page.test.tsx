import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import LeadsPage from '../../../app/admin/leads/page';

let mockSession: { data: { user: { email: string; name?: string } } | null; status: string } = {
  data: { user: { email: 'nzmarie.com@gmail.com' } },
  status: 'authenticated',
};

const mockPush = vi.fn();

vi.mock('next-auth/react', () => ({
  useSession: () => mockSession,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock('next/image', () => ({
  default: ({ src, alt }: any) => <img src={src} alt={alt} />,
}));

vi.mock('@/components/admin/LeadEditModal', () => ({ LeadEditModal: () => null }));
vi.mock('@/components/admin/PropertyEditModal', () => ({ PropertyEditModal: () => null }));
vi.mock('@/components/admin/PropertyHistoryView', () => ({ PropertyHistoryView: () => null }));
vi.mock('@/app/admin/leads/components/LeadReportsView', () => ({ default: () => null }));

class MockIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const mockLeads = [
  {
    id: 'lead-1',
    property_address: '249 Sunset Road',
    suburb: 'Sunnynook',
    source: 'manual',
    status: 'contacted',
    priority: 'medium',
    created_at: '2026-10-01T00:00:00.000Z',
    updated_at: '2026-10-01T00:00:00.000Z',
    image_url: 'https://example.com/one.jpg',
    property_url: 'https://example.com/listing/249',
  },
  {
    id: 'lead-2',
    property_address: '11 Honour Avenue',
    suburb: 'Northcross',
    source: 'manual',
    status: 'new',
    priority: 'high',
    created_at: '2026-10-05T00:00:00.000Z',
    updated_at: '2026-10-05T00:00:00.000Z',
    image_url: 'https://example.com/two.jpg',
    property_url: null,
  },
];

function headingCalls() {
  return (global.fetch as any).mock.calls.filter(
    (call: any[]) => typeof call[0] === 'string' && call[0].includes('/api/admin/leads?')
  ).length;
}

describe('LeadsPage refresh behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPush.mockReset();
    mockSession = {
      data: { user: { email: 'nzmarie.com@gmail.com' } },
      status: 'authenticated',
    };
    (global as any).IntersectionObserver = MockIntersectionObserver;
    (global.fetch as any) = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: mockLeads,
            pagination: { page: 1, limit: 50, total: mockLeads.length, totalPages: 1 },
          }),
      })
    );
  });

  afterEach(() => {
    cleanup();
  });

  it('does not refetch leads when the session object identity changes for the same user', async () => {
    const { rerender } = render(<LeadsPage />);

    await waitFor(() => {
      expect(screen.getByText('249 Sunset Road')).toBeTruthy();
    });

    expect(headingCalls()).toBe(1);

    mockSession = {
      data: { user: { email: 'nzmarie.com@gmail.com' } },
      status: 'authenticated',
    };

    rerender(<LeadsPage />);

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(headingCalls()).toBe(1);
  });

  it('only wraps the card image in a link when the lead has a property url', async () => {
    render(<LeadsPage />);

    await waitFor(() => {
      expect(screen.getByText('249 Sunset Road')).toBeTruthy();
    });

    const linked = screen.getByRole('link', { name: '249 Sunset Road' });
    expect(linked.getAttribute('href')).toBe('https://example.com/listing/249');
    expect(linked.getAttribute('target')).toBe('_blank');

    expect(screen.queryByRole('link', { name: '11 Honour Avenue' })).toBeNull();
  });
});

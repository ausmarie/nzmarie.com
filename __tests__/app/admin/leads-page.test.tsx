import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
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
    owner_name: 'Jane Owner',
    owner_email: 'jane@example.com',
    owner_phone: '0211234567',
    summary: 'Considering a sale next year',
    bedrooms: 4,
    bathrooms: 2,
    garages: 2,
    rv: 1450000,
    sale_price: '$1,520,000',
    on_market_sale: true,
    events: [
      {
        id: 'event-1',
        lead_id: 'lead-1',
        event_type: 'phone_call',
        title: 'Discussed appraisal',
        description: 'Owner wants a market update',
        created_by: 'admin@example.com',
        created_at: '2026-10-20T00:00:00.000Z',
      },
    ],
    documents: [
      {
        id: 'document-1',
        lead_id: 'lead-1',
        doc_type: 'appraisal_pdf',
        file_name: 'sunset-road-appraisal.pdf',
        file_url: 'https://reports.nzmarie.com/leads/lead-1/appraisal/sunset-road-appraisal.pdf',
        file_size: 2048,
        mime_type: 'application/pdf',
        uploaded_by: 'admin@example.com',
        created_at: '2026-10-21T00:00:00.000Z',
      },
    ],
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

  it('renders all lead, property, PDF and timeline data in each AI data chamber', async () => {
    render(<LeadsPage />);

    await waitFor(() => {
      expect(screen.getByText('249 Sunset Road')).toBeTruthy();
    });

    const chamber = screen.getByTestId('lead-ai-data-lead-1');
    expect(chamber.textContent).toContain('[AI-DATA-START]');
    expect(chamber.textContent).toContain('Address: 249 Sunset Road');
    expect(chamber.textContent).toContain('Owner Name: Jane Owner');
    expect(chamber.textContent).toContain('Summary: Considering a sale next year');
    expect(chamber.textContent).toContain('Bedrooms: 4');
    expect(chamber.textContent).toContain('Capital Value (RV): 1450000');
    expect(chamber.textContent).toContain('For Sale: Yes');
    expect(chamber.textContent).toContain('Appraisal PDF Count: 1');
    expect(chamber.textContent).toContain('sunset-road-appraisal.pdf');
    expect(chamber.textContent).toContain('Timeline Event Count: 1');
    expect(chamber.textContent).toContain('Discussed appraisal');
    expect(chamber.textContent).toContain('[AI-DATA-END]');
  });

  it('opens the appraisal PDF history from a lead card', async () => {
    render(<LeadsPage />);

    await waitFor(() => {
      expect(screen.getByText('249 Sunset Road')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('lead-pdf-lead-1'));

    expect(screen.getByText('Appraisal PDFs')).toBeTruthy();
    expect(screen.getAllByText('sunset-road-appraisal.pdf').length).toBeGreaterThan(0);
    expect(screen.getByText('Latest')).toBeTruthy();
    expect(screen.getByRole('link', { name: /View/i }).getAttribute('href')).toBe(
      'https://reports.nzmarie.com/leads/lead-1/appraisal/sunset-road-appraisal.pdf'
    );
  });
});

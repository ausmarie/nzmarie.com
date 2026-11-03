import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent, within } from '@testing-library/react';
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
    city: 'North Shore City',
    region: 'Auckland',
    postcode: '0620',
    summary: 'Considering a sale next year',
    notes: 'Call after the school holidays',
    bedrooms: 4,
    bathrooms: 2,
    garages: 2,
    rv: 1450000,
    build_year: 2021,
    floor_area: '296.0',
    land_area: '506.0',
    last_sold_price: 719130,
    last_sold_date: '2022-05-01',
    land_value: 810000,
    improvement_value: 640000,
    property_type: 'Residential',
    sale_status: 'not for sale',
    latitude: -36.7421,
    longitude: 174.721,
    property_history: 'Sold in 2020 for $1,100,000',
    sale_price: '$1,520,000',
    on_market_sale: true,
    address_notes: [
      { lead_id: 'lead-1', notes: 'Call after the school holidays', created_at: '2026-10-01T00:00:00.000Z' },
      { lead_id: 'lead-old', notes: 'Previous owner requested a valuation', created_at: '2025-08-12T00:00:00.000Z' },
    ],
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
      {
        id: 'event-old',
        lead_id: 'lead-old',
        event_type: 'note',
        title: 'Prior appraisal discussion',
        description: 'Earlier owner asked for a valuation',
        created_by: 'previous-agent@example.com',
        created_at: '2025-08-13T00:00:00.000Z',
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

const mockSendHistory = [
  {
    log_id: 'send-1',
    outreach_property_id: 'outreach-1',
    report_title: 'Sunnynook Market Update',
    campaign_key: '2026_Q3_Sunnynook',
    suburb: 'Sunnynook',
    sent_at: '2026-10-18T00:00:00.000Z',
    sent_by: 'admin@example.com',
    notes: 'Owner requested a follow-up',
    pdf_file_url: 'https://example.com/report.pdf',
    pdf_file_name: 'sunnynook-report.pdf',
    scan_count: 7,
  },
  {
    log_id: 'send-2',
    outreach_property_id: 'outreach-2',
    report_title: 'Winter Report',
    campaign_key: '2026_Winter',
    suburb: 'Sunnynook',
    sent_at: '2026-06-18T00:00:00.000Z',
    sent_by: 'agent@example.com',
    notes: null,
    pdf_file_url: null,
    pdf_file_name: null,
    scan_count: 2,
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
    (global.fetch as any) = vi.fn().mockImplementation((input: string) => {
      if (input.includes('/send-history')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ history: input.includes('lead-1') ? mockSendHistory : [] }),
        });
      }
      if (input.includes('/events')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [] }) });
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: mockLeads,
            pagination: { page: 1, limit: 50, total: mockLeads.length, totalPages: 1 },
          }),
      });
    });
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

  it('renders only one lead card when the API returns duplicate addresses', async () => {
    const duplicateLead = { ...mockLeads[0], id: 'lead-duplicate' };
    (global.fetch as any).mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [mockLeads[0], duplicateLead],
            pagination: { page: 1, limit: 50, total: 2, totalPages: 1 },
          }),
      })
    );

    render(<LeadsPage />);

    await waitFor(() => {
      expect(screen.getAllByRole('heading', { name: '249 Sunset Road' })).toHaveLength(1);
    });
  });

  it('renders all address notes, property, sent history, PDF and timeline data in the AI data chamber', async () => {
    render(<LeadsPage />);

    await waitFor(() => {
      expect(screen.getByText('249 Sunset Road')).toBeTruthy();
    });

    const chamber = screen.getByTestId('lead-ai-data-lead-1');
    await waitFor(() => {
      expect(chamber.textContent).toContain('Sent History Count: 2');
    });
    expect(chamber.textContent).toContain('[AI-DATA-START]');
    expect(chamber.textContent).toContain('Address: 249 Sunset Road');
    expect(chamber.textContent).toContain('Postcode: 0620');
    expect(chamber.textContent).toContain('Owner Name: Jane Owner');
    expect(chamber.textContent).toContain('Summary: Considering a sale next year');
    expect(chamber.textContent).toContain('Bedrooms: 4');
    expect(chamber.textContent).toContain('Capital Value (RV): 1450000');
    expect(chamber.textContent).toContain('Land Value: 810000');
    expect(chamber.textContent).toContain('Improvement Value: 640000');
    expect(chamber.textContent).toContain('Property Type: Residential');
    expect(chamber.textContent).toContain('Coordinates: -36.7421, 174.721');
    expect(chamber.textContent).toContain('For Sale: Yes');
    expect(chamber.textContent).toContain('Call after the school holidays');
    expect(chamber.textContent).toContain('Previous owner requested a valuation');
    expect(chamber.textContent).toContain('Property History: Sold in 2020 for $1,100,000');
    expect(chamber.textContent).toContain('Sunnynook Market Update');
    expect(chamber.textContent).toContain('Owner requested a follow-up');
    expect(chamber.textContent).toContain('sunnynook-report.pdf');
    expect(chamber.textContent).toContain('2026_Winter');
    expect(chamber.textContent).toContain('Appraisal PDF Count: 1');
    expect(chamber.textContent).toContain('sunset-road-appraisal.pdf');
    expect(chamber.textContent).toContain('Timeline Event Count: 2');
    expect(chamber.textContent).toContain('Discussed appraisal');
    expect(chamber.textContent).toContain('Prior appraisal discussion');
    expect(chamber.textContent).toContain('previous-agent@example.com');
    expect(chamber.textContent).toContain('[AI-DATA-END]');
  });

  it('keeps the AI data chamber available when switching to list view', async () => {
    render(<LeadsPage />);

    await waitFor(() => {
      expect(screen.getByText('249 Sunset Road')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: '☰ List' }));

    const chamber = screen.getByTestId('lead-ai-data-lead-1');
    await waitFor(() => {
      expect(chamber.textContent).toContain('Sent History Count: 2');
    });
    expect(chamber.textContent).toContain('Previous owner requested a valuation');
  });

  it('shows read-only Edit Property details between Notes and Property History in Lead details', async () => {
    render(<LeadsPage />);

    await waitFor(() => {
      expect(screen.getByText('249 Sunset Road')).toBeTruthy();
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Lead' })[0]);

    const info = await screen.findByTestId('lead-property-basic-info');
    const propertyInfo = within(info);
    expect(propertyInfo.getByText('Address')).toBeTruthy();
    expect(propertyInfo.getByText('249 Sunset Road')).toBeTruthy();
    expect(propertyInfo.getByText('Suburb')).toBeTruthy();
    expect(propertyInfo.getByText('Sunnynook')).toBeTruthy();
    expect(propertyInfo.getByText('City')).toBeTruthy();
    expect(propertyInfo.getByText('North Shore City')).toBeTruthy();
    expect(propertyInfo.getByText('Region')).toBeTruthy();
    expect(propertyInfo.getByText('Auckland')).toBeTruthy();
    expect(propertyInfo.getByText('Postcode')).toBeTruthy();
    expect(propertyInfo.getByText('0620')).toBeTruthy();
    expect(propertyInfo.getByText('Bedrooms')).toBeTruthy();
    expect(propertyInfo.getByText('4')).toBeTruthy();
    expect(propertyInfo.getByText('Bathrooms')).toBeTruthy();
    expect(propertyInfo.getAllByText('2')).toHaveLength(2);
    expect(propertyInfo.getByText('Car Spaces')).toBeTruthy();
    expect(propertyInfo.getByText('Year Built')).toBeTruthy();
    expect(propertyInfo.getByText('2021')).toBeTruthy();
    expect(propertyInfo.getByText('Floor Size (m²)')).toBeTruthy();
    expect(propertyInfo.getByText('296.0')).toBeTruthy();
    expect(propertyInfo.getByText('Land Area')).toBeTruthy();
    expect(propertyInfo.getByText('506.0')).toBeTruthy();
    expect(propertyInfo.getByText('Last Sold Price')).toBeTruthy();
    expect(propertyInfo.getByText('719130')).toBeTruthy();
    expect(propertyInfo.getByText('Last Sold Date')).toBeTruthy();
    expect(propertyInfo.getByText('2022-05-01')).toBeTruthy();
    expect(propertyInfo.getByText('Capital Value (RV)')).toBeTruthy();
    expect(propertyInfo.getByText('1450000')).toBeTruthy();
    expect(info.querySelector('input, textarea, select, button')).toBeNull();

    const detailContent = info.closest('.space-y-6');
    expect(detailContent).toBeTruthy();
    const content = detailContent!.textContent || '';
    expect(content.indexOf('Notes')).toBeLessThan(content.indexOf('Property Basic Information'));
    expect(content.indexOf('Property Basic Information')).toBeLessThan(content.indexOf('Property History'));
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

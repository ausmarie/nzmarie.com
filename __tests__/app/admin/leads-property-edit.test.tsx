import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import React from 'react';
import LeadsPage from '../../../app/admin/leads/page';

vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { user: { email: 'nzmarie.com@gmail.com', name: 'Marie' } },
    status: 'authenticated',
  }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

vi.mock('@/components/admin/LeadEditModal', () => ({ LeadEditModal: () => null }));
vi.mock('@/components/admin/PropertyHistoryView', () => ({ PropertyHistoryView: () => null }));
vi.mock('@/app/admin/leads/components/LeadReportsView', () => ({ default: () => null }));

class MockIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const ORIGINAL_ADDRESS = '4 Carnmore Place, Torbay, Auckland 0630';
const UPDATED_ADDRESS = '4 Carnmore Place';

const mockLead = {
  id: 'lead-1',
  joined_property_id: 'prop-1',
  joined_property_address: ORIGINAL_ADDRESS,
  joined_property_suburb: 'Torbay',
  joined_property_city: 'Auckland',
  joined_property_region: 'Auckland',
  property_address: ORIGINAL_ADDRESS,
  suburb: 'Torbay',
  city: 'Auckland',
  region: 'Auckland',
  source: 'appraisal',
  status: 'new',
  priority: 'low',
  created_at: '2026-10-27T01:48:37.302Z',
  updated_at: '2026-10-27T01:48:37.302Z',
  owner_name: 'Margaret McDonald',
  owner_email: 'owner@example.com',
  owner_phone: '0211234567',
  bedrooms: 4,
  bathrooms: 2,
  garages: 2,
  rv: 1125000,
  build_year: 1994,
  last_sold_price: 1100000,
  last_sold_date: '2024-05-01',
  property_url: 'https://example.com/listing/4-carnmore',
  image_url: 'https://example.com/4-carnmore.jpg',
  description: 'A family home in Torbay.',
};

const updatedProperty = {
  id: 'prop-1',
  address: UPDATED_ADDRESS,
  suburb: 'Torbay',
  city: 'Auckland',
  region: 'Auckland',
  bedrooms: 4,
  bathrooms: 2,
  garages: 2,
  build_year: 1994,
  floor_area: '180',
  land_area: '600',
  last_sold_price: 1100000,
  last_sold_date: '2024-05-01',
  rv: 1125000,
  property_url: 'https://example.com/listing/4-carnmore',
  image_url: 'https://example.com/4-carnmore.jpg',
  description: 'A family home in Torbay.',
};

function jsonResponse(body: unknown) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve(body),
  });
}

describe('Leads page — property card', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    (global as unknown as { IntersectionObserver: unknown }).IntersectionObserver = MockIntersectionObserver;

    fetchMock = vi.fn((url: string, init?: { method?: string }) => {
      if (url.startsWith('/api/admin/leads?')) {
        return jsonResponse({
          data: [mockLead],
          pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
        });
      }
      if (url === '/api/admin/properties/prop-1' && init?.method === 'PATCH') {
        return jsonResponse({ success: true, property: updatedProperty });
      }
      return jsonResponse({ data: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } });
    });
    (global.fetch as unknown) = fetchMock;
  });

  afterEach(() => {
    cleanup();
  });

  it('shows the address on its own row and the action buttons on the next row', async () => {
    render(<LeadsPage />);

    await waitFor(() => {
      expect(screen.getByText(ORIGINAL_ADDRESS)).toBeTruthy();
    });

    const heading = screen.getByText(ORIGINAL_ADDRESS);
    const header = heading.parentElement as HTMLElement;
    expect(header.style.flexDirection).toBe('column');

    const buttons = screen.getAllByRole('button').filter((button) =>
      ['Lead', 'PDF', 'Property'].includes(button.textContent?.trim() ?? '')
    );
    expect(buttons).toHaveLength(3);
    buttons.forEach((button) => {
      // Buttons live in the second row, not beside the address.
      expect(button.closest('h3')).toBeNull();
      expect(header.contains(button)).toBe(true);
    });
  });

  it('saves an edited property address with PATCH and updates the card', async () => {
    render(<LeadsPage />);

    await waitFor(() => {
      expect(screen.getByText(ORIGINAL_ADDRESS)).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Property' }));

    const addressInput = screen.getByDisplayValue(ORIGINAL_ADDRESS) as HTMLInputElement;
    fireEvent.change(addressInput, { target: { value: UPDATED_ADDRESS } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      const propertyCall = fetchMock.mock.calls.find((call) => call[0] === '/api/admin/properties/prop-1');
      expect(propertyCall).toBeTruthy();
      expect(propertyCall?.[1]).toEqual(expect.objectContaining({ method: 'PATCH' }));

      const body = JSON.parse((propertyCall?.[1] as { body: string }).body);
      expect(body.address).toBe(UPDATED_ADDRESS);
      // Fields must use the properties-table column names the API accepts.
      expect(body.car_spaces).toBe(2);
      expect(body.year_built).toBe(1994);
      expect(body.capital_value).toBe(1125000);
      expect(body.cover_image_url).toBe('https://example.com/4-carnmore.jpg');
      expect(body).not.toHaveProperty('garages');
      expect(body).not.toHaveProperty('build_year');
      expect(body).not.toHaveProperty('floor_area');
      expect(body).not.toHaveProperty('rv');
      expect(body).not.toHaveProperty('image_url');
    });

    await waitFor(() => {
      expect(screen.getByText(UPDATED_ADDRESS)).toBeTruthy();
      expect(screen.queryByText(ORIGINAL_ADDRESS)).toBeNull();
    });
  });
});

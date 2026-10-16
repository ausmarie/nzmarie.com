import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockSession = { user: { email: 'nzmarie.com@gmail.com' } };
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: mockSession, status: 'authenticated' }),
}));

const mockSetQueryData = vi.fn();
const mockSetQueriesData = vi.fn();
const mockInvalidateQueries = vi.fn();

const defaultProperties = [
  {
    id: 'prop-1',
    address: '15 Marine Parade',
    suburb: 'Takapuna',
    city: 'North Shore City',
    region: 'Auckland',
    description: 'Beautiful home with sea views and modern renovations throughout the entire property',
    bedrooms: 4,
    bathrooms: 2,
    garages: 2,
    rv: 1200000,
    last_sold_price: 1150000,
    last_sold_date: '2018-05-10',
    build_year: 1990,
    floor_area: '220',
    land_area: '801',
    image_url: 'https://example.com/image.jpg',
    property_url: 'https://example.com/prop1',
    postcode: '0632',
    land_value: 1075000,
    improvement_value: 200000,
    estimated_value_low: 1200000,
    estimated_value_high: 1300000,
    property_type: 'Residential',
    sale_status: 'unknown',
    has_rental_history: false,
    is_currently_rented: false,
    latitude: -36.7061,
    longitude: 174.7297,
    on_market_sale: true,
    sale_listing_status: 'Under Offer',
    sale_price: '$1,150,000',
    sale_agent: 'Mike Pero',
    on_market_rent: false,
    rent_listing_status: null,
    rent_price: null,
    no_junk_mail: false,
  },
  {
    id: 'prop-2',
    address: '2/910 East Coast Road',
    suburb: 'Albany',
    city: 'North Shore City',
    bedrooms: 3,
    bathrooms: 2,
    garages: 1,
    rv: 950000,
    last_sold_price: 920000,
    last_sold_date: '2022-11-20',
    image_url: 'https://example.com/image2.jpg',
    property_url: 'https://example.com/prop2',
    no_junk_mail: true,
    on_market_sale: false,
    sale_listing_status: null,
    sale_price: null,
    sale_agent: null,
    on_market_rent: true,
    rent_listing_status: 'To Rent',
    rent_price: '$650/week',
  },
  {
    id: 'prop-3',
    address: '42 Sunrise Avenue',
    suburb: 'Browns Bay',
    city: 'North Shore City',
    bedrooms: 3,
    bathrooms: 1,
    garages: 1,
    rv: 850000,
    last_sold_price: 780000,
    last_sold_date: '2019-08-10',
    image_url: 'https://example.com/image3.jpg',
    property_url: 'https://example.com/prop3',
    has_rental_history: true,
    is_currently_rented: false,
    on_market_sale: false,
    sale_listing_status: null,
    sale_price: null,
    sale_agent: null,
    on_market_rent: false,
    rent_listing_status: null,
    rent_price: null,
  }
];

const { mockUseInfiniteQuery, mockUseQuery, defaultInfiniteQueryImpl, defaultUseQueryImpl } = vi.hoisted(() => {
  const defaultInfiniteQueryImpl = () => ({
    data: { pages: [{ properties: defaultProperties, total: 45 }] },
    isLoading: false,
    isFetchingNextPage: false,
    hasNextPage: false,
    fetchNextPage: vi.fn(),
  });
  const defaultUseQueryImpl = (...args: any[]) => {
    const key = (Array.isArray(args[0]) ? args[0] : args[0] && args[0].queryKey) || [];
    const flatKey = JSON.stringify(key);
    if (flatKey.includes('street-addresses')) {
      return { data: defaultProperties, isLoading: false, isFetching: false };
    }
    if (flatKey.includes('street-list')) {
      return {
        data: {
          streets: [
            { street: 'Marine Parade', count: 1 },
            { street: 'East Coast Road', count: 1 },
            { street: 'Sunrise Avenue', count: 1 },
          ],
          totalStreets: 3,
          start: null,
          saved_start: null,
          has_next: false,
        },
        isLoading: false,
        isFetching: false,
      };
    }
    return { data: { properties: defaultProperties, total: 45 }, isLoading: false, isFetching: false };
  };
  const iq = vi.fn(defaultInfiniteQueryImpl);
  const uq = vi.fn(defaultUseQueryImpl);
  return { mockUseInfiniteQuery: iq, mockUseQuery: uq, defaultInfiniteQueryImpl, defaultUseQueryImpl };
});

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ setQueryData: mockSetQueryData, setQueriesData: mockSetQueriesData, invalidateQueries: mockInvalidateQueries }),
  useInfiniteQuery: (...args: any[]) => (mockUseInfiniteQuery as any)(...args),
  useQuery: (...args: any[]) => (mockUseQuery as any)(...args),
  keepPreviousData: vi.fn(),
}));

vi.mock('@/components/property/AddressAutocomplete', () => ({
  default: ({ onChange, value, placeholder }: { onChange: (v: string) => void; value: string; placeholder?: string }) => (
    <input
      data-testid="address-autocomplete"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

vi.mock('@/components/admin/Skeleton', () => ({
  SkeletonProperties: () => <div>Loading Properties</div>,
  SkeletonPropertyCard: () => <div>Loading Property Card</div>,
}));

vi.mock('next/image', () => ({
  default: ({ src, alt, ...rest }: { src: string; alt: string; [key: string]: unknown }) => {
    const { unoptimized, onError, ...safeProps } = rest;
    void unoptimized;
    void onError;
    return <img src={src} alt={alt} {...safeProps} />;
  },
}));

global.fetch = vi.fn();

let intersectionCallback: ((entries: IntersectionObserverEntry[]) => void) | null = null;
let intersectionOptions: IntersectionObserverInit | null = null;
const mockObserve = vi.fn();
const mockDisconnect = vi.fn();

global.IntersectionObserver = vi.fn().mockImplementation((callback, options) => {
  intersectionCallback = callback;
  intersectionOptions = options;
  return {
    observe: mockObserve,
    unobserve: vi.fn(),
    disconnect: mockDisconnect,
  };
}) as any;

function triggerIntersection(isIntersecting: boolean) {
  if (intersectionCallback) {
    intersectionCallback([{ isIntersecting } as IntersectionObserverEntry]);
  }
}

const mockLikeFetch = () => {
  (global.fetch as any).mockImplementation((url: string, init?: RequestInit) => {
    if (typeof url === 'string' && String(url).startsWith('/api/admin/properties/street')) {
      if (init?.method === 'POST') {
        return Promise.resolve({ ok: true, json: async () => ({ success: true }) });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          success: true,
          streets: [
            { street: 'Marine Parade', count: 1 },
            { street: 'East Coast Road', count: 1 },
            { street: 'Sunrise Avenue', count: 1 },
          ],
          totalStreets: 3,
          start: null,
          saved_start: null,
          next_offset: null,
          has_next: false,
        }),
      });
    }
    if (typeof url === 'string' && url.startsWith('/api/admin/properties')) {
      return Promise.resolve({ ok: true, json: async () => ({ success: true, properties: defaultProperties, total: 45 }) });
    }
    return Promise.resolve({ ok: true, json: async () => ({ liked_ids: [] }) });
  });
};

const mockLikeFetchOnce = () => {
  (global.fetch as any).mockResolvedValueOnce({
    ok: true,
    json: async () => ({ liked_ids: [] }),
  });
};

const installStreetTestQueries = () => {
  mockUseQuery.mockImplementation((...args: any[]) => {
    const key = (Array.isArray(args[0]) ? args[0] : args[0] && args[0].queryKey) || [];
    const flatKey = JSON.stringify(key);
    if (flatKey.includes('street-addresses')) {
      return { data: defaultProperties, isLoading: false, isFetching: false };
    }
    if (flatKey.includes('street-list')) {
      return {
        data: {
          streets: [
            { street: 'Marine Parade', count: 1 },
            { street: 'East Coast Road', count: 1 },
            { street: 'Sunrise Avenue', count: 1 },
          ],
          totalStreets: 3,
          start: null,
          saved_start: null,
          has_next: false,
        },
        isLoading: false,
        isFetching: false,
      };
    }
    return { data: { properties: defaultProperties, total: 45 }, isLoading: false, isFetching: false };
  });
  mockUseInfiniteQuery.mockImplementation(() => ({
    data: { pages: [{ properties: defaultProperties, total: 45 }] },
    isLoading: false,
    isFetchingNextPage: false,
    hasNextPage: false,
    fetchNextPage: vi.fn(),
  }));
};

describe('Properties Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLikeFetch();
  });

  afterEach(() => {
    cleanup();
  });

  it('shows full description text with CSS truncation on the property card', async () => {
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    const description = await screen.findByTitle('Beautiful home with sea views and modern renovations throughout the entire property');
    expect(description).toBeDefined();
    expect(description.textContent).toContain('Beautiful home with sea views and modern renovations throughout the entire property');
  });

  it('renders off-screen AI data chamber with all property fields for sidebar Gemini', async () => {
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    const startMarkers = screen.getAllByText(/\[AI-DATA-START\]/);
    expect(startMarkers.length).toBe(3);

    const endMarkers = screen.getAllByText(/\[AI-DATA-END\]/);
    expect(endMarkers.length).toBe(3);

    expect(screen.getByText(/Address: 15 Marine Parade/)).toBeDefined();
    expect(screen.getByText(/Bedrooms: 4/)).toBeDefined();
    expect(screen.getByText(/Car Spaces: 2/)).toBeDefined();
    expect(screen.getByText(/Land Value/)).toBeDefined();
    expect(screen.getByText(/Improvement Value/)).toBeDefined();
    expect(screen.getByText(/Property Type: Residential/)).toBeDefined();
    expect(screen.getByText(/Sale Status: unknown/)).toBeDefined();
    expect(screen.getByText(/Coordinates: -36\.7061/)).toBeDefined();

    expect(screen.getByText(/Address: 2\/910 East Coast Road/)).toBeDefined();
    expect(screen.getAllByText(/Bedrooms: 3/).length).toBe(2);
    expect(screen.getAllByText(/Car Spaces: 1/).length).toBe(2);

    expect(screen.getAllByText(/Capital Value \(RV\)/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/Bathrooms:/).length).toBe(3);
    expect(screen.getAllByText(/Estimated Value/).length).toBeGreaterThanOrEqual(1);
  });

  it('shows No description fallback for properties without description', async () => {
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    const noDesc = screen.getAllByText('No description');
    expect(noDesc.length).toBe(2);
  });

  it('renders House type button selected by default', async () => {
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    const houseBtn = screen.getByText('House');
    const allBtns = screen.getAllByText('All');
    const townhouseBtn = screen.getByText('Townhouse/Unit');
    expect(houseBtn).toBeDefined();
    expect(allBtns.length).toBeGreaterThanOrEqual(2);
    expect(townhouseBtn).toBeDefined();
    expect(houseBtn.parentElement).toBeDefined();
  });

  it('changes property filter when a different type button is clicked', async () => {
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    const houseBtn = screen.getByText('House');
    const allBtns = screen.getAllByText('All');
    const townhouseBtn = screen.getByText('Townhouse/Unit');

    fireEvent.click(allBtns[0]);
    fireEvent.click(townhouseBtn);
    fireEvent.click(houseBtn);
  });

  it('does not reset Property Type when status filter toggles', async () => {
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    const houseBtn = screen.getByText('House');
    fireEvent.click(houseBtn);

    const pendingBtn = screen.getByRole('button', { name: 'Pending' });
    fireEvent.click(pendingBtn);

    await waitFor(() => {
      expect(houseBtn.style.backgroundColor).toBe('rgb(59, 130, 246)');
    });

    const sentBtn = screen.getByRole('button', { name: 'Sent' });
    fireEvent.click(sentBtn);

    await waitFor(() => {
      expect(houseBtn.style.backgroundColor).toBe('rgb(59, 130, 246)');
    });
  });

  it('displays all properties regardless of selected property type (server-side filtering)', async () => {
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    expect(screen.getByText('15 Marine Parade')).toBeDefined();
    expect(screen.getByText('2/910 East Coast Road')).toBeDefined();
  });

  it('renders Market Status filter buttons next to Property Type', async () => {
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    expect(screen.getByText('Market Status')).toBeDefined();
    const allBtns = screen.getAllByText('All');
    expect(allBtns.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole('button', { name: 'For Sale' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'To Rent' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Rented' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Never Rented' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Not Listed' })).toBeDefined();
  });

  it('shows For Sale badge on properties with on_market_sale=true', async () => {
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    const badge = await screen.findByText(/For Sale \$1,150,000/);
    expect(badge).toBeDefined();
  });

  it('shows To Rent badge on properties with on_market_rent=true', async () => {
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    const badges = await screen.findAllByText(/To Rent \$650\/week/);
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });

  it('shows Rented badge on properties with has_rental_history=true', async () => {
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    const badges = await screen.findAllByText('Rented');
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });

  it('includes market status info in AI data chamber', async () => {
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    expect(screen.getByText(/For Sale: Under Offer/)).toBeDefined();
    expect(screen.getByText(/For Rent: To Rent/)).toBeDefined();
    expect(screen.getByText(/Mike Pero/)).toBeDefined();
  });

  it('switches market status filter when a button is clicked', async () => {
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    const forSaleBtn = screen.getByRole('button', { name: 'For Sale' });
    fireEvent.click(forSaleBtn);

    const toRentBtn = screen.getByRole('button', { name: 'To Rent' });
    fireEvent.click(toRentBtn);

    const rentedBtn = screen.getByRole('button', { name: 'Rented' });
    fireEvent.click(rentedBtn);

    const neverRentedBtn = screen.getByRole('button', { name: 'Never Rented' });
    fireEvent.click(neverRentedBtn);

    const notListedBtn = screen.getByRole('button', { name: 'Not Listed' });
    fireEvent.click(notListedBtn);
  });

  it('renders Last Sold preset buttons with 5-15 years selected by default', async () => {
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    expect(screen.getByText('★ 5-15 years')).toBeDefined();
    expect(screen.getByText('5-10 years')).toBeDefined();
    expect(screen.getByText('3-5 years')).toBeDefined();
    expect(screen.getByText('0-3 years')).toBeDefined();
    expect(screen.getByText('10-15 years')).toBeDefined();
    expect(screen.getByText('15+ years')).toBeDefined();
  });

  it('switches Last Sold preset when a different preset button is clicked', async () => {
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    fireEvent.click(screen.getByText('3-5 years'));
    fireEvent.click(screen.getByText('0-3 years'));
    fireEvent.click(screen.getByText('15+ years'));
    fireEvent.click(screen.getByText('★ 5-15 years'));
  });

  it('renders custom Min Years and Max Years inputs for Last Sold', async () => {
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    expect(screen.getByText('Min Years')).toBeDefined();
    expect(screen.getByText('Max Years')).toBeDefined();
  });

});

describe('Properties Page - Edit Functionality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLikeFetch();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders Edit button on each property card', async () => {
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    await waitFor(() => {
      const editButtons = screen.getAllByText('Edit');
      expect(editButtons.length).toBe(3);
    });
  });

  it('opens edit modal when Edit button is clicked', async () => {
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    const editButtons = await screen.findAllByText('Edit');
    fireEvent.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Edit Property')).toBeDefined();
      expect(screen.getByDisplayValue('15 Marine Parade')).toBeDefined();
      expect(screen.getByDisplayValue('Takapuna')).toBeDefined();
    });
  });

  it('pre-fills form fields with current property data', async () => {
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    const editButtons = await screen.findAllByText('Edit');
    fireEvent.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByDisplayValue('15 Marine Parade')).toBeDefined();
      expect(screen.getByDisplayValue('Takapuna')).toBeDefined();
    });
  });

  it('calls PATCH API with updated data when Save Changes is clicked', async () => {
    mockLikeFetchOnce();
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, property: { id: 'prop-1', address: '16 Marine Parade' } }),
    });

    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    const editButtons = await screen.findAllByText('Edit');
    fireEvent.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Edit Property')).toBeDefined();
    });

    const addressInput = screen.getByDisplayValue('15 Marine Parade') as HTMLInputElement;
    fireEvent.change(addressInput, { target: { value: '16 Marine Parade' } });

    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/admin/properties/prop-1',
        expect.objectContaining({
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    const patchCall = (global.fetch as any).mock.calls.find((c: unknown[]) =>
      c[0] === '/api/admin/properties/prop-1' && (c[1] as any)?.method === 'PATCH'
    );
    const body = JSON.parse(patchCall[1].body);
    expect(body.address).toBe('16 Marine Parade');
    expect(body.suburb).toBe('Takapuna');
  });

  it('shows success notification after successful edit', async () => {
    mockLikeFetchOnce();
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, property: { id: 'prop-1' } }),
    });

    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    const editButtons = await screen.findAllByText('Edit');
    fireEvent.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Edit Property')).toBeDefined();
    });

    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Property updated successfully')).toBeDefined();
    });
  });

  it('shows error notification on failed edit', async () => {
    mockLikeFetchOnce();
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Update failed' }),
    });

    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    const editButtons = await screen.findAllByText('Edit');
    fireEvent.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Edit Property')).toBeDefined();
    });

    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Update failed')).toBeDefined();
    });
  });

  it('closes modal when Cancel is clicked', async () => {
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    const editButtons = await screen.findAllByText('Edit');
    fireEvent.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Edit Property')).toBeDefined();
    });

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(screen.queryByText('Edit Property')).toBeNull();
    });
  });
});

describe('Properties Page - Quick Filter by Suburb clears Address Input', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLikeFetch();
  });

  afterEach(() => {
    cleanup();
  });

  it('clears address input when a different suburb button is clicked', async () => {
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    const addressInput = screen.getByTestId('address-autocomplete') as HTMLInputElement;
    fireEvent.change(addressInput, { target: { value: '15 Marine Parade' } });
    expect(addressInput.value).toBe('15 Marine Parade');

    // Northcross is the default selection; clicking Albany switches suburbs.
    const suburbBtn = screen.getByRole('button', { name: 'Albany' });
    fireEvent.click(suburbBtn);

    await waitFor(() => {
      expect(addressInput.value).toBe('');
    });
  });

  it('keeps the active suburb selected when its button is clicked again', async () => {
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    const addressInput = screen.getByTestId('address-autocomplete') as HTMLInputElement;
    fireEvent.change(addressInput, { target: { value: '15 Marine Parade' } });
    expect(addressInput.value).toBe('15 Marine Parade');

    const northcrossBtn = screen.getByRole('button', { name: 'Northcross' }) as HTMLElement;
    expect(northcrossBtn.style.backgroundColor).toBe('rgb(59, 130, 246)');

    // Re-clicking the active suburb must not clear the selection or the input.
    fireEvent.click(northcrossBtn);

    expect(addressInput.value).toBe('15 Marine Parade');
    expect(northcrossBtn.style.backgroundColor).toBe('rgb(59, 130, 246)');
  });

  it('does not toggle off the selected suburb when re-clicked', async () => {
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    const addressInput = screen.getByTestId('address-autocomplete') as HTMLInputElement;

    fireEvent.change(addressInput, { target: { value: '10 Some Street' } });
    const albanyBtn = screen.getByRole('button', { name: 'Albany' }) as HTMLElement;
    fireEvent.click(albanyBtn);
    expect(addressInput.value).toBe('');

    fireEvent.change(addressInput, { target: { value: '20 Other Road' } });
    fireEvent.click(albanyBtn);
    // Re-clicking the active suburb keeps it selected and leaves the input alone.
    expect(addressInput.value).toBe('20 Other Road');
    expect(albanyBtn.style.backgroundColor).toBe('rgb(59, 130, 246)');
  });

  it('renders new suburb buttons in the quick filter section', async () => {
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    expect(screen.getByRole('button', { name: 'Long Bay' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Forrest Hill' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Schnapper Rock' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Unsworth Heights' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Sunnynook' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Greenhithe' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Chatswood' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Mairangi Bay' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Campbells Bay' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Castor Bay' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Milford' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Glenfield' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Hillcrest' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Birkenhead' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Hauraki' })).toBeDefined();
  });

  it('selects a new suburb when its button is clicked', async () => {
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    const longBayBtn = screen.getByRole('button', { name: 'Long Bay' });
    fireEvent.click(longBayBtn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Long Bay' })).toBeDefined();
    });
  });
});

describe('Properties Page - Like Icon', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLikeFetch();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders a like button on each property card', async () => {
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    const likeButtons = await screen.findAllByTitle('Like');
    expect(likeButtons.length).toBe(3);
  });

  it('calls like API when like button is clicked', async () => {
    (global.fetch as any)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ liked_ids: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ liked: true }) });

    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    const likeButtons = await screen.findAllByTitle('Like');
    fireEvent.click(likeButtons[0]);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/admin/outreach/like',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });
  });

  it('toggles like icon state on click', async () => {
    (global.fetch as any)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ liked_ids: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ liked: true }) });

    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    const likeButtons = await screen.findAllByTitle('Like');
    expect(likeButtons.length).toBe(3);
    fireEvent.click(likeButtons[0]);

    await waitFor(() => {
      expect(screen.getByTitle('Unlike')).toBeTruthy();
    });
  });
});

describe('Properties Page - Infinite Scroll', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    intersectionCallback = null;
    intersectionOptions = null;
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ liked_ids: [] }),
    });
  });

  afterEach(() => {
    cleanup();
    intersectionCallback = null;
    intersectionOptions = null;
  });

  it('creates IntersectionObserver with threshold 0 and rootMargin 200px', async () => {
    mockUseInfiniteQuery.mockReturnValue({
      data: { pages: [{ properties: defaultProperties, total: 45 }] },
      isLoading: false,
      isFetchingNextPage: false,
      hasNextPage: true,
      fetchNextPage: vi.fn(),
    });

    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    await waitFor(() => {
      expect(global.IntersectionObserver).toHaveBeenCalled();
      expect(intersectionOptions).toEqual({ threshold: 0, rootMargin: '200px' });
    });
  });

  it('observes the last property card element', async () => {
    mockUseInfiniteQuery.mockReturnValue({
      data: { pages: [{ properties: defaultProperties, total: 45 }] },
      isLoading: false,
      isFetchingNextPage: false,
      hasNextPage: true,
      fetchNextPage: vi.fn(),
    });

    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    await waitFor(() => {
      expect(mockObserve).toHaveBeenCalled();
    });
  });

  it('calls fetchNextPage when sentinel intersects, hasNextPage=true, and isFetchingNextPage=false', async () => {
    const fetchNextPage = vi.fn();
    mockUseInfiniteQuery.mockReturnValue({
      data: { pages: [{ properties: defaultProperties, total: 45 }] },
      isLoading: false,
      isFetchingNextPage: false,
      hasNextPage: true,
      fetchNextPage,
    });

    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    triggerIntersection(true);

    await waitFor(() => {
      expect(fetchNextPage).toHaveBeenCalledTimes(1);
    });
  });

  it('does NOT call fetchNextPage when hasNextPage is false', async () => {
    const fetchNextPage = vi.fn();
    mockUseInfiniteQuery.mockReturnValue({
      data: { pages: [{ properties: defaultProperties, total: 45 }] },
      isLoading: false,
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage,
    });

    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    triggerIntersection(true);

    await waitFor(() => {
      expect(fetchNextPage).not.toHaveBeenCalled();
    });
  });

  it('does NOT call fetchNextPage when isFetchingNextPage is true', async () => {
    const fetchNextPage = vi.fn();
    mockUseInfiniteQuery.mockReturnValue({
      data: { pages: [{ properties: defaultProperties, total: 45 }] },
      isLoading: false,
      isFetchingNextPage: true,
      hasNextPage: true,
      fetchNextPage,
    });

    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    triggerIntersection(true);

    await waitFor(() => {
      expect(fetchNextPage).not.toHaveBeenCalled();
    });
  });
});

describe('Properties Page - Dual Pagination Mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLikeFetch();
    mockUseInfiniteQuery.mockReturnValue({
      data: { pages: [{ properties: defaultProperties, total: 45 }] },
      isLoading: false,
      isFetchingNextPage: false,
      hasNextPage: true,
      fetchNextPage: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    intersectionCallback = null;
    intersectionOptions = null;
    // Restore the hoisted default implementations: mockReturnValue /
    // mockImplementation in these tests would otherwise leak into later
    // describe blocks that rely on the defaults (vi.clearAllMocks does not
    // restore implementations).
    mockUseInfiniteQuery.mockImplementation(defaultInfiniteQueryImpl);
    mockUseQuery.mockImplementation(defaultUseQueryImpl);
  });

  it('renders segmented control with Infinite Scroll and Classic Pages buttons', async () => {
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    await waitFor(() => {
      expect(screen.getByText('Infinite Scroll')).toBeDefined();
      expect(screen.getByText('Classic Pages')).toBeDefined();
    });
  });

  it('shows counter text showing record range in infinite mode', async () => {
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    await waitFor(() => {
      expect(screen.getByText(/Displaying 1 to 3 of 45 properties/)).toBeDefined();
    });
  });

  it('switches to classic mode when Classic Pages button is clicked', async () => {
    mockUseQuery.mockReturnValue({
      data: { properties: defaultProperties, total: 45 },
      isLoading: false,
      isFetching: false,
    });

    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    await waitFor(() => {
      expect(screen.getByText('Infinite Scroll')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Classic Pages'));

    await waitFor(() => {
      const buttons = screen.getAllByRole('button');
      const classicBtns = buttons.filter(b => b.textContent === 'Classic Pages');
      expect(classicBtns.length).toBeGreaterThanOrEqual(1);
      const prevBtns = buttons.filter(b => b.textContent === '‹');
      expect(prevBtns.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('renders classic pagination controls (first, prev, page input, next, last) in classic mode', async () => {
    mockUseQuery.mockReturnValue({
      data: { properties: defaultProperties, total: 45 },
      isLoading: false,
      isFetching: false,
    });

    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    fireEvent.click(screen.getByText('Classic Pages'));

    await waitFor(() => {
      const buttons = screen.getAllByRole('button');
      const lastBtns = buttons.filter(b => b.textContent === '≫');
      expect(lastBtns.length).toBeGreaterThanOrEqual(2);
      const nextBtns = buttons.filter(b => b.textContent === '›');
      expect(nextBtns.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('disables prev/first buttons on page 1 in classic mode', async () => {
    mockUseQuery.mockReturnValue({
      data: { properties: defaultProperties, total: 45 },
      isLoading: false,
      isFetching: false,
    });

    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    fireEvent.click(screen.getByText('Classic Pages'));

    await waitFor(() => {
      const allButtons = screen.getAllByRole('button');
      const firstBtns = allButtons.filter(b => b.textContent === '≪');
      const prevBtns = allButtons.filter(b => b.textContent === '‹');
      expect(firstBtns.length).toBeGreaterThanOrEqual(2);
      expect(prevBtns.length).toBeGreaterThanOrEqual(2);
      firstBtns.forEach(b => expect((b as HTMLButtonElement).disabled).toBe(true));
      prevBtns.forEach(b => expect((b as HTMLButtonElement).disabled).toBe(true));
    });
  });

  it('displays counter text with correct range in classic mode', async () => {
    mockUseQuery.mockReturnValue({
      data: { properties: defaultProperties, total: 45 },
      isLoading: false,
      isFetching: false,
    });

    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    fireEvent.click(screen.getByText('Classic Pages'));

    await waitFor(() => {
      expect(screen.getByText(/Displaying 1 to 9 of 45 properties/)).toBeDefined();
    });
  });

  it('shows bottom pagination with range info in classic mode', async () => {
    mockUseQuery.mockReturnValue({
      data: { properties: defaultProperties, total: 45 },
      isLoading: false,
      isFetching: false,
    });

    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    fireEvent.click(screen.getByText('Classic Pages'));

    await waitFor(() => {
      expect(screen.getByText('1–9 of 45')).toBeDefined();
    });
  });

  it('shows loading text in classic mode when isFetching is true', async () => {
    mockUseQuery.mockReturnValue({
      data: { properties: defaultProperties, total: 45 },
      isLoading: false,
      isFetching: true,
    });

    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    fireEvent.click(screen.getByText('Classic Pages'));

    await waitFor(() => {
      expect(screen.getAllByText('Loading Property Card').length).toBe(9);
    });
  });

  it('switches back to infinite mode when Infinite Scroll button is clicked', async () => {
    mockUseQuery.mockReturnValue({
      data: { properties: defaultProperties, total: 45 },
      isLoading: false,
      isFetching: false,
    });

    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    fireEvent.click(screen.getByText('Classic Pages'));
    await waitFor(() => {
      const buttons = screen.getAllByRole('button');
      const prevBtns = buttons.filter(b => b.textContent === '‹');
      expect(prevBtns.length).toBeGreaterThanOrEqual(2);
    });

    fireEvent.click(screen.getByText('Infinite Scroll'));

    await waitFor(() => {
      expect(screen.getByText(/Displaying 1 to 3 of 45 properties/)).toBeDefined();
    });
  });

  it('does not render IntersectionObserver sentinel in classic mode', async () => {
    mockUseQuery.mockReturnValue({
      data: { properties: defaultProperties, total: 45 },
      isLoading: false,
      isFetching: false,
    });

    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    expect(intersectionOptions).toEqual({ threshold: 0, rootMargin: '200px' });

    fireEvent.click(screen.getByText('Classic Pages'));

    await waitFor(() => {
      expect(mockDisconnect).toHaveBeenCalled();
    });
  });

  it('keeps the valid total when switching to classic before the classic query resolves (no "Page 2 of 1")', async () => {
    // Classic query key has never resolved for page 2 → data is undefined
    // while the first classic fetch is in flight.
    mockUseQuery.mockImplementation((...args: any[]) => {
      const opts = args[0] || {};
      const key = (Array.isArray(opts) ? opts : opts.queryKey) || [];
      const flatKey = JSON.stringify(key);
      if (flatKey.includes('street-addresses') || flatKey.includes('street-list')) {
        return { data: undefined as never, isLoading: false, isFetching: false };
      }
      return { data: undefined as never, isLoading: true, isFetching: true };
    });

    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    const { rerender } = render(<PropertiesPage />);

    // User scrolls infinite mode: a second page loads (total=45) and
    // currentPage syncs to 2 via the pages-length effect.
    mockUseInfiniteQuery.mockReturnValue({
      data: {
        pages: [
          { properties: defaultProperties, total: 45 },
          { properties: defaultProperties, total: 45 },
        ],
      },
      isLoading: false,
      isFetchingNextPage: false,
      hasNextPage: true,
      fetchNextPage: vi.fn(),
    });
    rerender(<PropertiesPage />);

    fireEvent.click(screen.getByText('Classic Pages'));

    await waitFor(() => {
      // Must not flash the broken "Displaying 0 of 0 properties"
      expect(screen.queryByText('Displaying 0 of 0 properties')).toBeNull();
      // Classic range text uses the last valid total (45), not 0
      expect(screen.getByText(/Displaying 10 to 18 of 45 properties/)).toBeDefined();
      // Still on page 2, and totalPages = ceil(45/9) = 5 — never "Page 2 of 1"
      expect(screen.getByDisplayValue('2')).toBeDefined();
      expect(screen.getByText(/of 5/)).toBeDefined();
    });
  });

  it('shows a genuine empty classic result as "Displaying 0 of 0 properties"', async () => {
    mockUseInfiniteQuery.mockReturnValue({
      data: undefined as never,
      isLoading: false,
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage: vi.fn(),
    });
    // Loaded-but-empty classic result: data IS defined (not a transition)
    mockUseQuery.mockReturnValue({
      data: { properties: [], total: 0 },
      isLoading: false,
      isFetching: false,
    });

    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    fireEvent.click(screen.getByText('Classic Pages'));

    await waitFor(() => {
      expect(screen.getAllByText('Displaying 0 of 0 properties').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('requests include_total from the API in classic mode', async () => {
    (global.fetch as any).mockImplementation((url: string) => {
      if (typeof url === 'string' && url.startsWith('/api/admin/properties?')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            properties: defaultProperties,
            pagination: { total: 45, page: 1, limit: 9, totalPages: 5 },
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ liked_ids: [] }) });
    });
    mockUseQuery.mockImplementation((...args: any[]) => {
      const opts = args[0] || {};
      const key = (Array.isArray(opts) ? opts : opts.queryKey) || [];
      const flatKey = JSON.stringify(key);
      if (flatKey.includes('street-addresses') || flatKey.includes('street-list')) {
        return { data: undefined as never, isLoading: false, isFetching: false };
      }
      if (typeof opts.queryFn === 'function') void opts.queryFn();
      return { data: { properties: defaultProperties, total: 45 }, isLoading: false, isFetching: false };
    });

    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    fireEvent.click(screen.getByText('Classic Pages'));

    await waitFor(() => {
      const urls = (global.fetch as any).mock.calls.map((c: any[]) => String(c[0]));
      const classicListQuery = urls.find((u: string) => u.startsWith('/api/admin/properties?') && u.includes('page=1'));
      expect(classicListQuery).toBeDefined();
      expect(classicListQuery).toContain('include_total=true');
    });
  });

  it('stays on page 2 when the page-2 response skips the COUNT (total=0)', async () => {
    // Infinite scroll loaded 2 pages (total=45) → currentPage syncs to 2.
    mockUseInfiniteQuery.mockReturnValue({
      data: {
        pages: [
          { properties: defaultProperties, total: 45 },
          { properties: defaultProperties, total: 45 },
        ],
      },
      isLoading: false,
      isFetchingNextPage: false,
      hasNextPage: true,
      fetchNextPage: vi.fn(),
    });
    // Classic page-2 response arrived with total=0 (COUNT skipped — the API
    // optimisation for infinite scroll, or a response cached before
    // include_total existed). Must reuse the cached total, NOT bounce to page 1.
    mockUseQuery.mockImplementation((...args: any[]) => {
      const opts = args[0] || {};
      const key = (Array.isArray(opts) ? opts : opts.queryKey) || [];
      const flatKey = JSON.stringify(key);
      if (flatKey.includes('street-addresses') || flatKey.includes('street-list')) {
        return { data: undefined as never, isLoading: false, isFetching: false };
      }
      return { data: { properties: defaultProperties, total: 0 }, isLoading: false, isFetching: false };
    });

    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    const { rerender } = render(<PropertiesPage />);

    mockUseInfiniteQuery.mockReturnValue({
      data: {
        pages: [
          { properties: defaultProperties, total: 45 },
          { properties: defaultProperties, total: 45 },
        ],
      },
      isLoading: false,
      isFetchingNextPage: false,
      hasNextPage: true,
      fetchNextPage: vi.fn(),
    });
    rerender(<PropertiesPage />);

    fireEvent.click(screen.getByText('Classic Pages'));

    await waitFor(() => {
      expect(screen.queryByText('Displaying 0 of 0 properties')).toBeNull();
      // Cached total (45) is used → page 2 range text stays correct
      expect(screen.getByText(/Displaying 10 to 18 of 45 properties/)).toBeDefined();
      // Still on page 2 — the pager must not bounce back to page 1
      expect(screen.getAllByDisplayValue('2').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/of 5/).length).toBeGreaterThanOrEqual(1);
    });
  });
});

describe('Properties Page - Built Year Filter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ liked_ids: [] }),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders built year filter buttons', async () => {
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    const allBtns = screen.getAllByText('All');
    expect(allBtns.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('< 5 years')).toBeDefined();
    expect(screen.getByText('★ 5-10 years')).toBeDefined();
    expect(screen.getByText('10-20 years')).toBeDefined();
    expect(screen.getByText('20+ years')).toBeDefined();
  });

  it('switches built year preset buttons when clicked', async () => {
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    fireEvent.click(screen.getByText('< 5 years'));
    fireEvent.click(screen.getByText('★ 5-10 years'));
    fireEvent.click(screen.getByText('10-20 years'));
    fireEvent.click(screen.getByText('20+ years'));
  });

  it('selects < 5 years preset and verifies button exists', async () => {
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    const btn = screen.getByText('< 5 years');
    fireEvent.click(btn);

    await waitFor(() => {
      expect(screen.getByText('< 5 years')).toBeDefined();
    });
  });
});

describe('Properties Page - Stacked Property Metrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ liked_ids: [] }),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('displays floor size as F: value m²', async () => {
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    await waitFor(() => {
      expect(screen.getByText('F: 220 m²')).toBeDefined();
    });
  });

  it('displays land size as L: value m²', async () => {
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    await waitFor(() => {
      expect(screen.getByText('L: 801 m²')).toBeDefined();
    });
  });

  it('shows stacked layout with both F and L values', async () => {
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    await waitFor(() => {
      const fText = screen.getByText('F: 220 m²');
      const lText = screen.getByText('L: 801 m²');
      expect(fText).toBeDefined();
      expect(lText).toBeDefined();
    });
  });
});

describe('Properties Page - Extended Advanced Filters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ liked_ids: [] }),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('shows RV, Floor Area, Market Premium in permanent panel by default', async () => {
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    expect(screen.getByText('Min RV ($)')).toBeDefined();
    expect(screen.getByText('Max RV ($)')).toBeDefined();
    expect(screen.getByText('Market Premium')).toBeDefined();
  });

  it('hides advanced panel (Max Beds, Baths, Car Spaces, Region) by default', async () => {
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    expect(screen.queryByText('Max Bedrooms')).toBeNull();
    expect(screen.queryByText('Min Bathrooms')).toBeNull();
    expect(screen.queryByText('Max Bathrooms')).toBeNull();
    expect(screen.queryByText('Max Car Spaces')).toBeNull();
  });

  it('shows hidden filters when + More is clicked', async () => {
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    fireEvent.click(screen.getByText('+ More'));

    await waitFor(() => {
      expect(screen.getByText('Max Bedrooms')).toBeDefined();
      expect(screen.getByText('Min Bathrooms')).toBeDefined();
      expect(screen.getByText('Max Bathrooms')).toBeDefined();
      expect(screen.getByText('Min Car Spaces')).toBeDefined();
      expect(screen.getByText('Max Car Spaces')).toBeDefined();
    });
  });

  it('hides advanced panel when Hide is clicked', async () => {
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    fireEvent.click(screen.getByText('+ More'));
    await waitFor(() => {
      expect(screen.getByText('Max Bedrooms')).toBeDefined();
    });

    fireEvent.click(screen.getByText('− Hide'));
    await waitFor(() => {
      expect(screen.queryByText('Max Bedrooms')).toBeNull();
    });
  });

  it('renders Region/City/Suburb selects inside the advanced panel', async () => {
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    fireEvent.click(screen.getByText('+ More'));

    await waitFor(() => {
      expect(screen.getByText('Region')).toBeDefined();
      expect(screen.getByText('City / District')).toBeDefined();
      expect(screen.getByText('Suburb')).toBeDefined();
    });
  });

  it('renders Core Metrics row with Min Beds, RV, Floor, Land, Premium', async () => {
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    expect(screen.getByText('Min Beds')).toBeDefined();
    expect(screen.getByText('Min RV ($)')).toBeDefined();
    expect(screen.getByText('Max RV ($)')).toBeDefined();
    expect(screen.getByText('Min Floor (m²)')).toBeDefined();
    expect(screen.getByText('Min Land (m²)')).toBeDefined();
    expect(screen.getByText('Market Premium')).toBeDefined();
  });

  it('shows Max Land (m²) inside the advanced panel', async () => {
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    fireEvent.click(screen.getByText('+ More'));

    await waitFor(() => {
      expect(screen.getByText('Max Land (m²)')).toBeDefined();
    });
  });

  it('shows new suburbs in the hidden Suburb dropdown options', async () => {
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    fireEvent.click(screen.getByText('+ More'));

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Long Bay' })).toBeDefined();
      expect(screen.getByRole('option', { name: 'Unsworth Heights' })).toBeDefined();
      expect(screen.getByRole('option', { name: 'Chatswood' })).toBeDefined();
    });
  });
});

describe('Properties Page — Address Search Resets Filters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLikeFetch();
  });

  afterEach(() => {
    cleanup();
  });

  it('resets property type to All when search input has text', async () => {
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    const addressInput = screen.getByTestId('address-autocomplete') as HTMLInputElement;
    fireEvent.change(addressInput, { target: { value: '25 Canyon Drive' } });

    await waitFor(() => {
      expect(screen.getByText('Property Type')).toBeDefined();
      expect(screen.getByText('Market Status')).toBeDefined();
    });
  });

  it('resets Last Sold to All and Built Year to All when search is active', async () => {
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    const addressInput = screen.getByTestId('address-autocomplete') as HTMLInputElement;
    fireEvent.change(addressInput, { target: { value: '25 Canyon Drive' } });

    await waitFor(() => {
      const allLabels = screen.getAllByText('All');
      expect(allLabels.length).toBeGreaterThanOrEqual(4);
    });
  });

  it('clears address input when a suburb quick filter button is clicked', async () => {
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    const addressInput = screen.getByTestId('address-autocomplete') as HTMLInputElement;
    fireEvent.change(addressInput, { target: { value: 'Some Address' } });
    expect(addressInput.value).toBe('Some Address');

    const suburbBtn = screen.getByRole('button', { name: 'Albany' });
    fireEvent.click(suburbBtn);

    await waitFor(() => {
      expect(addressInput.value).toBe('');
    });
  });

  it('resets Last Sold filter params when search input has text', async () => {
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    const stars = screen.getAllByText('★ 5-10 years');
    expect(stars.length).toBeGreaterThanOrEqual(1);

    const addressInput = screen.getByTestId('address-autocomplete') as HTMLInputElement;
    fireEvent.change(addressInput, { target: { value: 'Test Address' } });

    await waitFor(() => {
      const allLabels = screen.getAllByText('All');
      expect(allLabels.length).toBeGreaterThanOrEqual(4);
    });
  });

  it('keeps Market Status as All when search clears', async () => {
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    const addressInput = screen.getByTestId('address-autocomplete') as HTMLInputElement;
    fireEvent.change(addressInput, { target: { value: '25 Canyon Drive' } });

    await waitFor(() => {
      expect(screen.getByText('Market Status')).toBeDefined();
    });

    fireEvent.change(addressInput, { target: { value: '' } });
  });

  it('toggles no_junk_mail optimistically when 🚫 is clicked (false->true)', async () => {
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    await waitFor(() => {
      expect(screen.getAllByTitle('Click to mark No Junk').length).toBeGreaterThan(0);
    });

    const buttons = screen.getAllByTitle('Click to mark No Junk');
    fireEvent.click(buttons[0]);

    await waitFor(() => {
      expect(screen.getAllByTitle('No Junk - Click to allow').length).toBeGreaterThan(0);
    });
  });

  it('toggles no_junk_mail optimistically when 🚫 is clicked (true->false)', async () => {
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    await waitFor(() => {
      expect(screen.getAllByTitle('No Junk - Click to allow').length).toBeGreaterThan(0);
    });

    const buttons = screen.getAllByTitle('No Junk - Click to allow');
    fireEvent.click(buttons[0]);

    await waitFor(() => {
      expect(screen.getAllByTitle('Click to mark No Junk').length).toBeGreaterThan(0);
    });
  });

  it('sends PATCH request with correct URL and body when 🚫 is clicked', async () => {
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    await waitFor(() => {
      expect(screen.getAllByTitle('Click to mark No Junk').length).toBeGreaterThan(0);
    });

    (global.fetch as any).mockClear();

    const buttons = screen.getAllByTitle('Click to mark No Junk');
    fireEvent.click(buttons[0]);

    await waitFor(() => {
      const calls = (global.fetch as any).mock.calls;
      const patchCall = calls.find((c: any[]) =>
        typeof c[0] === 'string' && c[0].startsWith('/api/admin/properties/')
      );
      expect(patchCall).toBeDefined();
      expect(patchCall[1].method).toBe('PATCH');
      expect(JSON.parse(patchCall[1].body)).toEqual({ no_junk_mail: true });
    });
  });

  it('updates cache in-place after 🚫 toggle (no refetch)', async () => {
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    await waitFor(() => {
      expect(screen.getAllByTitle('Click to mark No Junk').length).toBeGreaterThan(0);
    });

    mockSetQueriesData.mockClear();

    const buttons = screen.getAllByTitle('Click to mark No Junk');
    fireEvent.click(buttons[0]);

    await waitFor(() => {
      expect(mockSetQueriesData).toHaveBeenCalledWith(
        { queryKey: ['admin-properties'] },
        expect.any(Function)
      );
      expect(mockInvalidateQueries).not.toHaveBeenCalled();
    });
  });

  it('renders Filter by Street with an Apply button when a suburb is selected', async () => {
    installStreetTestQueries();
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    await waitFor(() => {
      expect(screen.getByText('🗺️ Filter by Street')).toBeDefined();
    });
    expect(screen.getAllByText('Apply')[0]).toBeDefined();
  });

  it('applying street mode hides other suburb buttons and expands the street list', async () => {
    installStreetTestQueries();
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    await waitFor(() => {
      expect(screen.getByText('🗺️ Filter by Street')).toBeDefined();
    });
    expect(screen.getByText('Oteha')).toBeDefined();

    fireEvent.click(screen.getAllByText('Apply')[0]);

    await waitFor(() => {
      expect(screen.getByText('\u2713 Applied by street (click to cancel)')).toBeDefined();
    });
    expect(screen.queryByText('Oteha')).toBeNull();
    expect(screen.getByText(/Collapse streets \(3\)/)).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText('1. Marine Parade')).toBeDefined();
      expect(screen.getByText('2. East Coast Road')).toBeDefined();
    });
  });

  it('clicking a street shows only that street addresses and cancelling restores all suburbs', async () => {
    installStreetTestQueries();
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    await waitFor(() => {
      expect(screen.getAllByText('Apply')[0]).toBeDefined();
    });
    fireEvent.click(screen.getAllByText('Apply')[0]);
    await waitFor(async () => {
      expect(screen.getByText('1. Marine Parade')).toBeDefined();
    });
    fireEvent.click(await screen.findByText('1. Marine Parade'));

    await waitFor(() => {
      expect(screen.getByText('15 Marine Parade')).toBeDefined();
    });
    expect(screen.queryByText('42 Sunrise Avenue')).toBeNull();
    expect(screen.getByText(/Displaying 1 of 1 properties/)).toBeDefined();

    fireEvent.click(screen.getByText('\u2713 Applied by street (click to cancel)'));
    await waitFor(() => {
      expect(screen.getByText('Oteha')).toBeDefined();
    });
  });

  it('saves the selected start street via POST', async () => {
    installStreetTestQueries();
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    await waitFor(() => {
      expect(screen.getAllByText('Apply')[0]).toBeDefined();
    });
    fireEvent.click(screen.getAllByText('Apply')[0]);
    await waitFor(() => {
      expect(screen.getByText('Collapse streets (3) \u25b4')).toBeDefined();
    });

    (global.fetch as any).mockClear();

    const select = screen.getByDisplayValue('Auto (first available)') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'Marine Parade' } });

    await waitFor(() => {
      const calls = (global.fetch as any).mock.calls;
      const postCall = calls.find((c: any[]) =>
        typeof c[0] === 'string' && c[0].startsWith('/api/admin/properties/street') && c[1]?.method === 'POST'
      );
      expect(postCall).toBeDefined();
      expect(JSON.parse(postCall[1].body)).toEqual({ suburb: 'Northcross', start: 'Marine Parade' });
    });
  });
});

describe('Properties Page - pagination size by view mode', () => {
  // Makes /api/admin/properties return exactly `limit` properties so page count
  // and per-page behaviour mirror the real server.
  const limitAwareFetch = () => {
    (global.fetch as any).mockImplementation((url: string, init?: RequestInit) => {
      if (typeof url === 'string' && url.startsWith('/api/admin/properties?')) {
        const parsed = new URL(url, 'http://localhost');
        const limit = Number(parsed.searchParams.get('limit') || '0');
        const total = 45;
        const properties = Array.from({ length: Math.min(limit, total) }, (_, i) => ({
          ...defaultProperties[0],
          id: `page-prop-${i}`,
        }));
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            properties,
            total: 45,
            pagination: { page: 1, limit, total, totalPages: Math.ceil(total / limit) },
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ liked_ids: [] }) });
    });
  };

  const captureQueryOptions = () => {
    const captured: { infinite: any[]; classic: any[] } = { infinite: [], classic: [] };
    mockUseInfiniteQuery.mockImplementation((...args: any[]) => {
      captured.infinite.push(args[0]);
      const opts = args[0] || {};
      if (typeof opts.queryFn === 'function') void opts.queryFn({ pageParam: 1 });
      return {
        data: { pages: [] },
        isLoading: false,
        isFetchingNextPage: false,
        hasNextPage: false,
        fetchNextPage: vi.fn(),
      };
    });
    mockUseQuery.mockImplementation((...args: any[]) => {
      captured.classic.push(args[0]);
      const opts = args[0] || {};
      if (typeof opts.queryFn === 'function') void opts.queryFn();
      return { data: { properties: defaultProperties, total: 45 }, isLoading: false, isFetching: false };
    });
    return captured;
  };

  const pagesOf = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ ...defaultProperties[0], id: `p${i}` }));

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('requests limit=9 from the API in card mode (classic + infinite)', async () => {
    limitAwareFetch();
    const captured = captureQueryOptions();
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    await waitFor(() => {
      const urls = (global.fetch as any).mock.calls.map((c: any[]) => String(c[0]));
      const listQuery = urls.find((u: string) => u.startsWith('/api/admin/properties?'));
      expect(listQuery).toBeDefined();
      expect(listQuery).toContain('limit=9');
      expect(listQuery).not.toContain('limit=18');
    });

    // getNextPageParam uses the card page size (9): a full 9-item page continues.
    const infiniteOpts = captured.infinite[captured.infinite.length - 1] || {};
    expect(typeof infiniteOpts.getNextPageParam).toBe('function');
    const page = { properties: pagesOf(9), total: 45 };
    expect(infiniteOpts.getNextPageParam(page, [page])).toBe(2);
    // A short page (e.g. the last one) stops the infinite scroll.
    const lastPage = { properties: pagesOf(5), total: 45 };
    expect(infiniteOpts.getNextPageParam(lastPage, [lastPage])).toBeUndefined();
  });

  it('requests limit=18 from the API after switching to list view', async () => {
    limitAwareFetch();
    captureQueryOptions();
    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    fireEvent.click(screen.getByText('List'));

    await waitFor(() => {
      const urls = (global.fetch as any).mock.calls.map((c: any[]) => String(c[0]));
      expect(urls.some((u: string) => u.startsWith('/api/admin/properties?') && u.includes('limit=18'))).toBe(true);
    });
  });

  it('shows 9 per page in card classic mode and 18 after switching to list', async () => {
    mockUseInfiniteQuery.mockImplementation(() => ({
      data: undefined as never,
      isLoading: false,
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage: vi.fn(),
    }));
    mockUseQuery.mockImplementation(() => ({
      data: { properties: defaultProperties, total: 45 },
      isLoading: false,
      isFetching: false,
    }));

    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    fireEvent.click(screen.getByText('Classic Pages'));
    await waitFor(() => {
      expect(screen.getByText('1–9 of 45')).toBeDefined();
    });

    fireEvent.click(screen.getByText('List'));
    await waitFor(() => {
      expect(screen.getByText('1–18 of 45')).toBeDefined();
    });
  });

  it('resets classic pagination to page 1 when the view mode changes', async () => {
    mockUseInfiniteQuery.mockImplementation(() => ({
      data: undefined as never,
      isLoading: false,
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage: vi.fn(),
    }));
    mockUseQuery.mockImplementation(() => ({
      data: { properties: defaultProperties, total: 45 },
      isLoading: false,
      isFetching: false,
    }));

    const PropertiesPage = (await import('../../../app/admin/properties/page')).default;
    render(<PropertiesPage />);

    fireEvent.click(screen.getByText('Classic Pages'));
    await waitFor(() => {
      expect(screen.getByText('1–9 of 45')).toBeDefined();
    });

    // Navigate to page 2 in card classic mode.
    fireEvent.click(screen.getAllByText('›')[0]);
    await waitFor(() => {
      expect(screen.getByText('10–18 of 45')).toBeDefined();
    });

    // Switching to list resets to page 1 (and uses the 18-per-page footer).
    fireEvent.click(screen.getByText('List'));
    await waitFor(() => {
      expect(screen.getByText('1–18 of 45')).toBeDefined();
      expect(screen.queryByText('10–18 of 45')).toBeNull();
    });
  });
});

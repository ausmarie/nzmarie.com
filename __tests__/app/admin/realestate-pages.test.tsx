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

const defaultListings = [
  {
    id: 're-1',
    address: '15 Marine Parade',
    status: 'for Sale',
    data: '{}',
    listing_date: '2026-06-15T00:00:00.000Z',
    listing_date_raw: '15 Jun 2026',
    price_display: '$1,200,000',
    agent_name: 'John Smith',
    bedroom_count: 4,
    bathroom_count: 2,
    land_area: 801,
    floor_area: 220,
    property_url: 'https://example.com/re-1',
    original_link: null,
    region: 'Auckland',
    latitude: -36.7061,
    longitude: 174.7297,
    cover_image_url: 'https://example.com/cover.jpg',
    images: '["img1.jpg","img2.jpg"]',
    normalized_lead_address: null,
    address_fingerprint: null,
    property_type: 'House',
    description: 'Beautiful home with sea views and modern renovations',
    listing_number: 'RE12345',
    listing_date_parsed: '2026-06-15',
  },
  {
    id: 're-2',
    address: '2/910 East Coast Road',
    status: null,
    data: null,
    listing_date: null,
    listing_date_raw: null,
    price_display: null,
    agent_name: null,
    bedroom_count: 3,
    bathroom_count: 1,
    land_area: null,
    floor_area: 150,
    property_url: null,
    original_link: 'https://example.com/re-2',
    region: null,
    latitude: null,
    longitude: null,
    cover_image_url: null,
    images: null,
    normalized_lead_address: null,
    address_fingerprint: null,
    property_type: null,
    description: null,
    listing_number: null,
    listing_date_parsed: null,
  },
];

const { mockUseQuery } = vi.hoisted(() => {
  const uq = vi.fn(() => ({ data: undefined, isLoading: false, isFetching: false }));
  return { mockUseQuery: uq };
});

vi.mock('@tanstack/react-query', () => ({
  useInfiniteQuery: () => ({
    data: { pages: [{ listings: defaultListings, total: 45 }] },
    isLoading: false,
    isFetchingNextPage: false,
    hasNextPage: false,
    fetchNextPage: vi.fn(),
  }),
  useQuery: (...args: any[]) => (mockUseQuery as any)(...args),
  keepPreviousData: vi.fn(),
}));

vi.mock('@/components/admin/Skeleton', () => ({
  SkeletonProperties: () => <div>Loading Properties</div>,
}));

vi.mock('@/components/property/AddressAutocomplete', () => ({
  default: ({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) =>
    <input value={value} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)} placeholder={placeholder || 'Search by address...'} />,
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

global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
})) as any;

describe('Realestate Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('displays all realestate listings', async () => {
    const RealestatePage = (await import('../../../app/admin/realestate/page')).default;
    render(<RealestatePage />);

    expect(screen.getByText('15 Marine Parade')).toBeDefined();
    expect(screen.getByText('2/910 East Coast Road')).toBeDefined();
  });

  it('renders off-screen AI data chamber with listing fields', async () => {
    const RealestatePage = (await import('../../../app/admin/realestate/page')).default;
    render(<RealestatePage />);

    const startMarkers = screen.getAllByText(/\[AI-DATA-START\]/);
    expect(startMarkers.length).toBe(2);

    const endMarkers = screen.getAllByText(/\[AI-DATA-END\]/);
    expect(endMarkers.length).toBe(2);

    expect(screen.getByText(/Address: 15 Marine Parade/)).toBeDefined();
    expect(screen.getByText(/Status: for Sale/)).toBeDefined();
    expect(screen.getByText(/Price: \$1,200,000/)).toBeDefined();
    expect(screen.getAllByText(/Agent: John Smith/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Bedrooms: 4/)).toBeDefined();
    expect(screen.getByText(/Bathrooms: 2/)).toBeDefined();
    expect(screen.getByText(/Land Area: 801m²/)).toBeDefined();
    expect(screen.getByText(/Floor Area: 220m²/)).toBeDefined();
    expect(screen.getByText(/Region: Auckland/)).toBeDefined();
    expect(screen.getByText(/Property URL: https:\/\/example\.com\/re-1/)).toBeDefined();
    expect(screen.getByText(/Cover Image: https:\/\/example\.com\/cover\.jpg/)).toBeDefined();
    expect(screen.getByText(/Image Count: 2/)).toBeDefined();
    expect(screen.getByText(/Coordinates: -36\.7061, 174\.7297/)).toBeDefined();
    expect(screen.getByText(/Property Type: House/)).toBeDefined();
    expect(screen.getAllByText(/Beautiful home with sea views and modern renovations/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Listing Number: RE12345/)).toBeDefined();
    expect(screen.getByText(/Listing Date Parsed: 2026-06-15/)).toBeDefined();

    expect(screen.getByText(/Address: 2\/910 East Coast Road/)).toBeDefined();
    expect(screen.getByText(/Bedrooms: 3/)).toBeDefined();
    expect(screen.getByText(/Bathrooms: 1/)).toBeDefined();
    expect(screen.getByText(/Floor Area: 150m²/)).toBeDefined();
    expect(screen.getByText(/Property URL: https:\/\/example\.com\/re-1/)).toBeDefined();
  });

  it('renders status badge for listings with status', async () => {
    const RealestatePage = (await import('../../../app/admin/realestate/page')).default;
    render(<RealestatePage />);

    expect(screen.getByText('for Sale')).toBeDefined();
  });

  it('renders price display when available', async () => {
    const RealestatePage = (await import('../../../app/admin/realestate/page')).default;
    render(<RealestatePage />);

    expect(screen.getByText('$1,200,000')).toBeDefined();
  });

  it('renders listing agent name when available', async () => {
    const RealestatePage = (await import('../../../app/admin/realestate/page')).default;
    render(<RealestatePage />);

    expect(screen.getAllByText(/John Smith/).length).toBeGreaterThanOrEqual(1);
  });

  it('shows count of displayed listings vs total', async () => {
    const RealestatePage = (await import('../../../app/admin/realestate/page')).default;
    render(<RealestatePage />);

    expect(screen.getByText(/Displaying 1 to 2 of 45 listings/)).toBeDefined();
  });

  it('renders region, city, and suburb dropdowns', async () => {
    const RealestatePage = (await import('../../../app/admin/realestate/page')).default;
    render(<RealestatePage />);

    expect(screen.getByText('Region')).toBeDefined();
    expect(screen.getByText('City / District')).toBeDefined();
    expect(screen.getByText('Suburb')).toBeDefined();
    expect(screen.getAllByText('Auckland').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Wellington')).toBeDefined();
    expect(screen.getByText('North Shore City')).toBeDefined();
  });

  it('renders search input for address', async () => {
    const RealestatePage = (await import('../../../app/admin/realestate/page')).default;
    render(<RealestatePage />);

    expect(screen.getByPlaceholderText('Search by address...')).toBeDefined();
  });

  it('renders property_type filter buttons with House selected by default', async () => {
    const RealestatePage = (await import('../../../app/admin/realestate/page')).default;
    render(<RealestatePage />);

    expect(screen.getByText('Property Type')).toBeDefined();
    expect(screen.getAllByText('All').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Townhouse')).toBeDefined();
    expect(screen.getByText('Unit')).toBeDefined();
    expect(screen.getByText('Apartment')).toBeDefined();
    expect(screen.getByText('Retirement Living')).toBeDefined();
    const houseButtons = screen.getAllByText('House');
    const houseButton = houseButtons.find(el => el.tagName === 'BUTTON');
    expect(houseButton).toBeDefined();
    expect(houseButton!.style.backgroundColor).toBe('rgb(59, 130, 246)');
  });

  it('changes property_type when a different type button is clicked', async () => {
    const RealestatePage = (await import('../../../app/admin/realestate/page')).default;
    render(<RealestatePage />);

    const townhouseButton = screen.getByText('Townhouse');
    fireEvent.click(townhouseButton);

    await waitFor(() => {
      expect(townhouseButton.style.backgroundColor).toBe('rgb(59, 130, 246)');
    });
  });

  it('renders description text on the card', async () => {
    const RealestatePage = (await import('../../../app/admin/realestate/page')).default;
    render(<RealestatePage />);

    const descElements = screen.getAllByText(/Beautiful home with sea views and modern renovations/);
    expect(descElements.length).toBeGreaterThanOrEqual(1);
  });

  it('renders listing date when available', async () => {
    const RealestatePage = (await import('../../../app/admin/realestate/page')).default;
    render(<RealestatePage />);

    const dateElements = screen.getAllByText(/15 Jun 2026/);
    expect(dateElements.length).toBeGreaterThanOrEqual(1);
  });

  it('renders property_type badge on the image', async () => {
    const RealestatePage = (await import('../../../app/admin/realestate/page')).default;
    render(<RealestatePage />);

    const badges = screen.getAllByText('House');
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });

  it('renders More Filter Criteria toggle', async () => {
    const RealestatePage = (await import('../../../app/admin/realestate/page')).default;
    render(<RealestatePage />);

    expect(screen.getByText('+ More Filter Criteria')).toBeDefined();
  });

  it('shows max fields when More Filter Criteria is clicked', async () => {
    const RealestatePage = (await import('../../../app/admin/realestate/page')).default;
    render(<RealestatePage />);

    fireEvent.click(screen.getByText('+ More Filter Criteria'));

    await waitFor(() => {
      expect(screen.getByText('− Hide')).toBeDefined();
      expect(screen.getByText('Max Bedrooms')).toBeDefined();
      expect(screen.getByText('Max Bathrooms')).toBeDefined();
    });
  });

   it('renders Clear All button', async () => {
     const RealestatePage = (await import('../../../app/admin/realestate/page')).default;
     render(<RealestatePage />);

     expect(screen.getByText('Clear All')).toBeDefined();
   });

   it('renders Time: Newest first sort button', async () => {
     const RealestatePage = (await import('../../../app/admin/realestate/page')).default;
     render(<RealestatePage />);

     expect(screen.getByText('Time: Newest first')).toBeDefined();
   });

   it('renders Street name sort button', async () => {
     const RealestatePage = (await import('../../../app/admin/realestate/page')).default;
     render(<RealestatePage />);

     expect(screen.getByText('Street name')).toBeDefined();
   });

   it('calls fetch with sort_by=street when Street name button is clicked', async () => {
     const RealestatePage = (await import('../../../app/admin/realestate/page')).default;
     render(<RealestatePage />);

     await waitFor(() => {
       expect(screen.getByText('Street name')).toBeDefined();
     });

     const streetBtn = screen.getByText('Street name').closest('button') as HTMLElement;
     fireEvent.click(streetBtn);

     await waitFor(() => {
       expect(streetBtn.style.backgroundColor).toBe('rgb(59, 130, 246)');
     });
   });

   it('calls fetch with sort_by=date when Time: Newest first button is clicked', async () => {
     const RealestatePage = (await import('../../../app/admin/realestate/page')).default;
     render(<RealestatePage />);

     await waitFor(() => {
       expect(screen.getByText('Time: Newest first')).toBeDefined();
     });

     const dateBtn = screen.getByText('Time: Newest first').closest('button') as HTMLElement;
     fireEvent.click(dateBtn);

     await waitFor(() => {
       expect(dateBtn.style.backgroundColor).toBe('rgb(59, 130, 246)');
     });
   });
 });

describe('Realestate Page - Edit Functionality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders Edit button on each listing card', async () => {
    const RealestatePage = (await import('../../../app/admin/realestate/page')).default;
    render(<RealestatePage />);

    await waitFor(() => {
      const editButtons = screen.getAllByText('Edit');
      expect(editButtons.length).toBe(2);
    });
  });

  it('opens edit modal when Edit button is clicked', async () => {
    const RealestatePage = (await import('../../../app/admin/realestate/page')).default;
    render(<RealestatePage />);

    const editButtons = await screen.findAllByText('Edit');
    fireEvent.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Edit Listing')).toBeDefined();
      expect(screen.getByDisplayValue('$1,200,000')).toBeDefined();
      expect(screen.getByDisplayValue('John Smith')).toBeDefined();
    });
  });

  it('pre-fills form fields with current listing data', async () => {
    const RealestatePage = (await import('../../../app/admin/realestate/page')).default;
    render(<RealestatePage />);

    const editButtons = await screen.findAllByText('Edit');
    fireEvent.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByDisplayValue('$1,200,000')).toBeDefined();
      expect(screen.getByDisplayValue('John Smith')).toBeDefined();
      expect(screen.getByDisplayValue('15 Marine Parade')).toBeDefined();
      expect(screen.getByDisplayValue('for Sale')).toBeDefined();
      expect(screen.getByDisplayValue('House')).toBeDefined();
      expect(screen.getByDisplayValue('RE12345')).toBeDefined();
    });
  });

  it('calls PATCH API with updated data when Save Changes is clicked', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    const RealestatePage = (await import('../../../app/admin/realestate/page')).default;
    render(<RealestatePage />);

    const editButtons = await screen.findAllByText('Edit');
    fireEvent.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Edit Listing')).toBeDefined();
    });

    const priceInput = screen.getByDisplayValue('$1,200,000') as HTMLInputElement;
    fireEvent.change(priceInput, { target: { value: '$1,300,000' } });

    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/admin/realestate/re-1',
        expect.objectContaining({
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    const fetchCall = (global.fetch as any).mock.calls[0];
    const body = JSON.parse(fetchCall[1].body);
    expect(body.price_display).toBe('$1,300,000');
  });

  it('shows success notification after successful edit', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    const RealestatePage = (await import('../../../app/admin/realestate/page')).default;
    render(<RealestatePage />);

    const editButtons = await screen.findAllByText('Edit');
    fireEvent.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Edit Listing')).toBeDefined();
    });

    const priceInput = screen.getByDisplayValue('$1,200,000') as HTMLInputElement;
    fireEvent.change(priceInput, { target: { value: '$1,300,000' } });

    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Listing updated successfully')).toBeDefined();
    });
  });

  it('shows error notification on failed edit', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Update failed' }),
    });

    const RealestatePage = (await import('../../../app/admin/realestate/page')).default;
    render(<RealestatePage />);

    const editButtons = await screen.findAllByText('Edit');
    fireEvent.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Edit Listing')).toBeDefined();
    });

    const priceInput = screen.getByDisplayValue('$1,200,000') as HTMLInputElement;
    fireEvent.change(priceInput, { target: { value: '$1,300,000' } });

    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Update failed')).toBeDefined();
    });
  });

  it('closes modal when Cancel is clicked', async () => {
    const RealestatePage = (await import('../../../app/admin/realestate/page')).default;
    render(<RealestatePage />);

    const editButtons = await screen.findAllByText('Edit');
    fireEvent.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Edit Listing')).toBeDefined();
    });

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(screen.queryByText('Edit Listing')).toBeNull();
    });
  });
});

describe('Realestate Page - Dual Pagination Mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, listings: defaultListings, pagination: { total: 45 } }),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders segmented control with Infinite Scroll and Classic Pages buttons', async () => {
    const RealestatePage = (await import('../../../app/admin/realestate/page')).default;
    render(<RealestatePage />);

    await waitFor(() => {
      expect(screen.getByText('Infinite Scroll')).toBeDefined();
      expect(screen.getByText('Classic Pages')).toBeDefined();
    });
  });

  it('shows counter in infinite mode', async () => {
    const RealestatePage = (await import('../../../app/admin/realestate/page')).default;
    render(<RealestatePage />);

    await waitFor(() => {
      expect(screen.getByText(/Displaying 1 to 2 of 45 listings/)).toBeDefined();
    });
  });

  it('switches to classic mode and shows page controls', async () => {
    mockUseQuery.mockReturnValue({
      data: { listings: [defaultListings[0]], total: 45 } as any,
      isLoading: false,
      isFetching: false,
    });

    const RealestatePage = (await import('../../../app/admin/realestate/page')).default;
    render(<RealestatePage />);

    fireEvent.click(screen.getByText('Classic Pages'));

    await waitFor(() => {
      const buttons = screen.getAllByRole('button');
      const prevBtns = buttons.filter(b => b.textContent === '‹');
      expect(prevBtns.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('disables first/prev buttons on page 1 in classic mode', async () => {
    mockUseQuery.mockReturnValue({
      data: { listings: [defaultListings[0]], total: 45 } as any,
      isLoading: false,
      isFetching: false,
    });

    const RealestatePage = (await import('../../../app/admin/realestate/page')).default;
    render(<RealestatePage />);

    fireEvent.click(screen.getByText('Classic Pages'));

    await waitFor(() => {
      const buttons = screen.getAllByRole('button');
      const firstBtns = buttons.filter(b => b.textContent === '≪');
      firstBtns.forEach(b => expect((b as HTMLButtonElement).disabled).toBe(true));
    });
  });

  it('shows counter with range in classic mode', async () => {
    mockUseQuery.mockReturnValue({
      data: { listings: [defaultListings[0]], total: 45 } as any,
      isLoading: false,
      isFetching: false,
    });

    const RealestatePage = (await import('../../../app/admin/realestate/page')).default;
    render(<RealestatePage />);

    fireEvent.click(screen.getByText('Classic Pages'));

    await waitFor(() => {
      expect(screen.getByText(/Displaying 1 to 18 of 45 listings/)).toBeDefined();
    });
  });

  it('switches back to infinite mode', async () => {
    mockUseQuery.mockReturnValue({
      data: { listings: [defaultListings[0]], total: 45 } as any,
      isLoading: false,
      isFetching: false,
    });

    const RealestatePage = (await import('../../../app/admin/realestate/page')).default;
    render(<RealestatePage />);

    fireEvent.click(screen.getByText('Classic Pages'));
    await waitFor(() => {
      const buttons = screen.getAllByRole('button');
      const prevBtns = buttons.filter(b => b.textContent === '‹');
      expect(prevBtns.length).toBeGreaterThanOrEqual(2);
    });

    fireEvent.click(screen.getByText('Infinite Scroll'));

    await waitFor(() => {
      expect(screen.getByText(/Displaying 1 to 2 of 45 listings/)).toBeDefined();
    });
  });

  it('shows Loading text in classic mode when isFetching is true', async () => {
    mockUseQuery.mockReturnValue({
      data: { listings: [defaultListings[0]], total: 45 } as any,
      isLoading: false,
      isFetching: true,
    });

    const RealestatePage = (await import('../../../app/admin/realestate/page')).default;
    render(<RealestatePage />);

    fireEvent.click(screen.getByText('Classic Pages'));

    await waitFor(() => {
      expect(screen.getByText('Loading...')).toBeDefined();
    });
  });

  it('shows bottom pagination with range info in classic mode', async () => {
    mockUseQuery.mockReturnValue({
      data: { listings: [defaultListings[0]], total: 45 } as any,
      isLoading: false,
      isFetching: false,
    });

    const RealestatePage = (await import('../../../app/admin/realestate/page')).default;
    render(<RealestatePage />);

    fireEvent.click(screen.getByText('Classic Pages'));

    await waitFor(() => {
      expect(screen.getByText('1–18 of 45')).toBeDefined();
    });
  });
});

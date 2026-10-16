import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import React from 'react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const defaultProperty = {
  id: 'prop-1',
  address: '15 Marine Parade',
  suburb: 'Takapuna',
  city: 'North Shore City',
  bedrooms: 4,
  bathrooms: 2,
  garages: 2,
  rv: 1200000,
  last_sold_price: 1150000,
  last_sold_date: '2023-01-15',
  build_year: 1990,
  floor_area: '220',
  land_area: '801',
  image_url: 'https://example.com/image.jpg',
  property_url: 'https://example.com/prop1',
  latitude: -36.7061,
  longitude: 174.7297,
  description: 'Beautiful home',
  estimated_value_low: 1200000,
  estimated_value_high: 1300000,
  has_rental_history: false,
  is_currently_rented: false,
};

const { mockUsePropertiesData } = vi.hoisted(() => {
  const fn = vi.fn(() => ({
    data: { pages: [[defaultProperty]] },
    isLoading: false,
    isFetchingNextPage: false,
    isError: false,
    error: null,
    fetchNextPage: vi.fn(),
    hasNextPage: true,
  }));
  return { mockUsePropertiesData: fn };
});

vi.mock('@/lib/hooks/usePropertiesData', () => ({
  usePropertiesData: (...args: any[]) => (mockUsePropertiesData as any)(...args),
  useRegions: () => ({ regions: [], loading: false, error: null }),
}));

vi.mock('@/components/property/PropertyList', () => ({
  default: ({ properties, lastPropertyElementRef }: {
    properties: unknown[];
    lastPropertyElementRef: React.RefObject<HTMLDivElement | null>;
  }) => (
    <div data-testid="property-list">
      {(properties as any[]).map((p: any, index: number) => (
        <div key={p.id} ref={index === properties.length - 1 ? lastPropertyElementRef : undefined}>
          {p.address}
        </div>
      ))}
    </div>
  ),
}));

vi.mock('@/components/property/LocationSelector', () => ({
  default: () => <div data-testid="location-selector" />,
}));

vi.mock('@/components/property/AddressAutocomplete', () => ({
  default: () => <div data-testid="address-autocomplete" />,
}));

let intersectionCallback: ((entries: IntersectionObserverEntry[]) => void) | null = null;
let intersectionOptions: IntersectionObserverInit | null = null;
const mockObserve = vi.fn();

global.IntersectionObserver = vi.fn().mockImplementation((callback, options) => {
  intersectionCallback = callback;
  intersectionOptions = options;
  return {
    observe: mockObserve,
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  };
}) as any;

function triggerIntersection(isIntersecting: boolean) {
  if (intersectionCallback) {
    intersectionCallback([{ isIntersecting } as IntersectionObserverEntry]);
  }
}

describe('Property Page - Infinite Scroll', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    intersectionCallback = null;
    intersectionOptions = null;
  });

  afterEach(() => {
    cleanup();
    intersectionCallback = null;
    intersectionOptions = null;
  });

  it('creates IntersectionObserver with threshold 0 and rootMargin 200px', async () => {
    const PropertyPage = (await import('../../../app/property/page')).default;
    render(<PropertyPage />);

    await waitFor(() => {
      expect(global.IntersectionObserver).toHaveBeenCalled();
      expect(intersectionOptions).toEqual({ threshold: 0, rootMargin: '200px' });
    });
  });

  it('observes the last property element', async () => {
    const PropertyPage = (await import('../../../app/property/page')).default;
    render(<PropertyPage />);

    await waitFor(() => {
      expect(mockObserve).toHaveBeenCalled();
    });
  });

  it('calls fetchNextPage when sentinel intersects with hasNextPage=true', async () => {
    const fetchNextPage = vi.fn();
    mockUsePropertiesData.mockReturnValue({
      data: { pages: [[defaultProperty]] },
      isLoading: false,
      isFetchingNextPage: false,
      isError: false,
      error: null,
      fetchNextPage,
      hasNextPage: true,
    });

    const PropertyPage = (await import('../../../app/property/page')).default;
    render(<PropertyPage />);

    triggerIntersection(true);

    await waitFor(() => {
      expect(fetchNextPage).toHaveBeenCalledTimes(1);
    });
  });

  it('does NOT call fetchNextPage when hasNextPage is false', async () => {
    const fetchNextPage = vi.fn();
    mockUsePropertiesData.mockReturnValue({
      data: { pages: [[]] },
      isLoading: false,
      isFetchingNextPage: false,
      isError: false,
      error: null,
      fetchNextPage,
      hasNextPage: false,
    });

    const PropertyPage = (await import('../../../app/property/page')).default;
    render(<PropertyPage />);

    triggerIntersection(true);

    await waitFor(() => {
      expect(fetchNextPage).not.toHaveBeenCalled();
    });
  });

  it('does NOT call fetchNextPage when isFetchingNextPage is true', async () => {
    const fetchNextPage = vi.fn();
    mockUsePropertiesData.mockReturnValue({
      data: { pages: [[]] },
      isLoading: false,
      isFetchingNextPage: true,
      isError: false,
      error: null,
      fetchNextPage,
      hasNextPage: true,
    });

    const PropertyPage = (await import('../../../app/property/page')).default;
    render(<PropertyPage />);

    triggerIntersection(true);

    await waitFor(() => {
      expect(fetchNextPage).not.toHaveBeenCalled();
    });
  });
});

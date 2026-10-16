import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';

const openGoogleMapsMock = vi.fn();
vi.mock('@/lib/clipboard', async () => {
  const actual = await vi.importActual<typeof import('@/lib/clipboard')>('@/lib/clipboard');
  return {
    ...actual,
    openGoogleMaps: (...args: unknown[]) => openGoogleMapsMock(...args),
  };
});

import { buildPropertyAddress, openGoogleMaps } from '@/lib/clipboard';

function StreetButton({
  address,
  suburb,
  city,
  region,
  postcode,
}: {
  address: string;
  suburb: string;
  city: string;
  region?: string;
  postcode?: string | null;
}) {
  return (
    <button
      type="button"
      aria-label={`Open ${address} in Google Maps`}
      onClick={() => {
        const full = buildPropertyAddress(address, suburb, city, region, postcode ?? null);
        openGoogleMaps(full || address);
      }}
    >
      Street
    </button>
  );
}

describe('Street address button', () => {
  beforeEach(() => {
    openGoogleMapsMock.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders Street label', () => {
    render(<StreetButton address="4 Cairnbrae Court" suburb="Northcross" city="Auckland" region="Auckland" postcode="0632" />);
    expect(screen.getByText('Street')).toBeTruthy();
    expect(screen.queryByText('Copy')).toBeNull();
  });

  it('opens Google Maps with full address on click', () => {
    render(<StreetButton address="4 Cairnbrae Court" suburb="Northcross" city="Auckland" region="Auckland" postcode="0632" />);
    const btn = screen.getByRole('button', { name: /Open.*Google Maps/i });
    fireEvent.click(btn);
    expect(openGoogleMapsMock).toHaveBeenCalledWith('4 Cairnbrae Court, Northcross, Auckland, Auckland, 0632');
  });

  it('buildPropertyAddress joins parts correctly', () => {
    render(<StreetButton address="4 Cairnbrae Court" suburb="" city="Auckland" />);
    const btn = screen.getByRole('button', { name: /Open.*Google Maps/i });
    fireEvent.click(btn);
    expect(openGoogleMapsMock).toHaveBeenCalledWith('4 Cairnbrae Court, Auckland');
  });

  it('uses raw address when buildPropertyAddress returns empty', () => {
    render(<StreetButton address="" suburb="" city="" />);
    const btn = screen.getByRole('button', { name: /Open.*Google Maps/i });
    fireEvent.click(btn);
    expect(openGoogleMapsMock).toHaveBeenCalledWith('');
  });
});

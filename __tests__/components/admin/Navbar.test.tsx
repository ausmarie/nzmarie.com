import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import React from 'react';
import { AdminNavbar } from '@/components/admin/Navbar';

const mockUsePathname = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { email: 'admin@test.com' } }, status: 'authenticated' }),
  signOut: vi.fn(),
}));

vi.mock('@/lib/permissions', () => ({
  isSuperAdmin: vi.fn().mockReturnValue(true),
}));

function reportsLink() {
  return screen.getByRole('link', { name: 'Reports' });
}

describe('AdminNavbar active state', () => {
  afterEach(() => {
    cleanup();
  });

  it('highlights Reports on the reports list page', () => {
    mockUsePathname.mockReturnValue('/admin/reports');
    render(<AdminNavbar />);
    expect(reportsLink().className).toContain('text-blue-600');
  });

  it('highlights Reports on a nested report document page', () => {
    mockUsePathname.mockReturnValue('/admin/reports/torbay-q2-2026');
    render(<AdminNavbar />);
    expect(reportsLink().className).toContain('text-blue-600');
  });

  it('does not highlight Reports on other pages', () => {
    mockUsePathname.mockReturnValue('/admin/analytics');
    render(<AdminNavbar />);
    expect(reportsLink().className).not.toContain('text-blue-600');
  });
});

describe('AdminNavbar scroll behaviour', () => {
  let scroller: HTMLDivElement;

  beforeEach(() => {
    mockUsePathname.mockReturnValue('/admin/reports/torbay-q2-2026');
    vi.stubGlobal('requestAnimationFrame', (cb: () => void) => {
      cb();
      return 1;
    });
  });

  afterEach(() => {
    cleanup();
    scroller?.remove();
    vi.unstubAllGlobals();
  });

  function renderNavbar() {
    const { container } = render(<AdminNavbar />);
    scroller = document.createElement('div');
    document.body.appendChild(scroller);
    return container;
  }

  it('hides the navbar when an inner container scrolls down', () => {
    const container = renderNavbar();

    Object.defineProperty(scroller, 'scrollTop', { value: 200, configurable: true });
    fireEvent.scroll(scroller);

    expect(container.querySelector('nav')?.className).toContain('-translate-y-full');
  });

  it('shows the navbar again when the inner container scrolls up', () => {
    const container = renderNavbar();

    Object.defineProperty(scroller, 'scrollTop', { value: 200, configurable: true });
    fireEvent.scroll(scroller);
    expect(container.querySelector('nav')?.className).toContain('-translate-y-full');

    Object.defineProperty(scroller, 'scrollTop', { value: 50, configurable: true });
    fireEvent.scroll(scroller);

    expect(container.querySelector('nav')?.className).toContain('translate-y-0');
    expect(container.querySelector('nav')?.className).not.toContain('-translate-y-full');
  });

  it('keeps the navbar visible when the inner container is near the top', () => {
    const container = renderNavbar();

    Object.defineProperty(scroller, 'scrollTop', { value: 20, configurable: true });
    fireEvent.scroll(scroller);

    expect(container.querySelector('nav')?.className).toContain('translate-y-0');
  });

  it('keeps the navbar visible when the window is at the top', () => {
    const container = renderNavbar();

    fireEvent.scroll(document);

    expect(container.querySelector('nav')?.className).toContain('translate-y-0');
  });
});
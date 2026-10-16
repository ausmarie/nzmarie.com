import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import React from 'react';

import {
  SkeletonBlock,
  SkeletonStatCard,
  SkeletonTableRows,
  SkeletonPageHeader,
  SkeletonDashboard,
  SkeletonAnalytics,
  SkeletonDownloads,
  SkeletonOutreach,
  SkeletonPDFManager,
  SkeletonBookings,
  SkeletonProperties,
} from '../../components/admin/Skeleton';

// Clean up after each test
afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// SkeletonBlock
// ---------------------------------------------------------------------------
describe('SkeletonBlock', () => {
  it('renders with default classes', () => {
    const { container } = render(<SkeletonBlock />);
    const el = container.querySelector('[data-testid="skeleton-block"]');
    expect(el).toBeDefined();
    expect(el?.className).toContain('animate-pulse');
    expect(el?.className).toContain('bg-gray-200');
  });

  it('merges extra className prop', () => {
    const { container } = render(<SkeletonBlock className="h-4 w-24" />);
    const el = container.querySelector('[data-testid="skeleton-block"]');
    expect(el?.className).toContain('h-4');
    expect(el?.className).toContain('w-24');
  });
});

// ---------------------------------------------------------------------------
// SkeletonStatCard
// ---------------------------------------------------------------------------
describe('SkeletonStatCard', () => {
  it('renders with testid', () => {
    const { container } = render(<SkeletonStatCard />);
    expect(container.querySelector('[data-testid="skeleton-stat-card"]')).toBeDefined();
  });

  it('contains 3 skeleton blocks', () => {
    const { container } = render(<SkeletonStatCard />);
    const blocks = container.querySelectorAll('[data-testid="skeleton-block"]');
    expect(blocks.length).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// SkeletonTableRows
// ---------------------------------------------------------------------------
describe('SkeletonTableRows', () => {
  const Wrapper = ({ rows, cols }: { rows?: number; cols?: number }) => (
    <table>
      <tbody>
        <SkeletonTableRows rows={rows} cols={cols} />
      </tbody>
    </table>
  );

  it('renders default 5 rows', () => {
    const { container } = render(<Wrapper />);
    const rows = container.querySelectorAll('[data-testid="skeleton-table-row"]');
    expect(rows.length).toBe(5);
  });

  it('renders custom row count', () => {
    const { container } = render(<Wrapper rows={3} />);
    const rows = container.querySelectorAll('[data-testid="skeleton-table-row"]');
    expect(rows.length).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// SkeletonPageHeader
// ---------------------------------------------------------------------------
describe('SkeletonPageHeader', () => {
  it('renders with testid', () => {
    const { container } = render(<SkeletonPageHeader />);
    expect(container.querySelector('[data-testid="skeleton-page-header"]')).toBeDefined();
  });

  it('contains 2 skeleton blocks (title + subtitle)', () => {
    const { container } = render(<SkeletonPageHeader />);
    const blocks = container.querySelectorAll('[data-testid="skeleton-block"]');
    expect(blocks.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Page-level skeletons — presence + key structure
// ---------------------------------------------------------------------------
describe('SkeletonDashboard', () => {
  it('renders with testid', () => {
    const { container } = render(<SkeletonDashboard />);
    expect(container.querySelector('[data-testid="skeleton-dashboard"]')).toBeDefined();
  });

  it('renders 3 stat cards', () => {
    const { container } = render(<SkeletonDashboard />);
    const cards = container.querySelectorAll('[data-testid="skeleton-stat-card"]');
    expect(cards.length).toBe(3);
  });

  it('renders page header', () => {
    const { container } = render(<SkeletonDashboard />);
    expect(container.querySelector('[data-testid="skeleton-page-header"]')).toBeDefined();
  });

  it('renders table rows', () => {
    const { container } = render(<SkeletonDashboard />);
    const rows = container.querySelectorAll('[data-testid="skeleton-table-row"]');
    expect(rows.length).toBeGreaterThan(0);
  });
});

describe('SkeletonAnalytics', () => {
  it('renders with testid', () => {
    const { container } = render(<SkeletonAnalytics />);
    expect(container.querySelector('[data-testid="skeleton-analytics"]')).toBeDefined();
  });

  it('renders 4 stat cards', () => {
    const { container } = render(<SkeletonAnalytics />);
    const cards = container.querySelectorAll('[data-testid="skeleton-stat-card"]');
    expect(cards.length).toBe(4);
  });
});

describe('SkeletonDownloads', () => {
  it('renders with testid', () => {
    const { container } = render(<SkeletonDownloads />);
    expect(container.querySelector('[data-testid="skeleton-downloads"]')).toBeDefined();
  });

  it('renders 3 stat cards', () => {
    const { container } = render(<SkeletonDownloads />);
    const cards = container.querySelectorAll('[data-testid="skeleton-stat-card"]');
    expect(cards.length).toBe(3);
  });

  it('renders table rows', () => {
    const { container } = render(<SkeletonDownloads />);
    const rows = container.querySelectorAll('[data-testid="skeleton-table-row"]');
    expect(rows.length).toBeGreaterThan(0);
  });
});

describe('SkeletonOutreach', () => {
  it('renders with testid', () => {
    const { container } = render(<SkeletonOutreach />);
    expect(container.querySelector('[data-testid="skeleton-outreach"]')).toBeDefined();
  });

  it('contains skeleton blocks', () => {
    const { container } = render(<SkeletonOutreach />);
    const blocks = container.querySelectorAll('[data-testid="skeleton-block"]');
    expect(blocks.length).toBeGreaterThan(0);
  });
});

describe('SkeletonPDFManager', () => {
  it('renders with testid', () => {
    const { container } = render(<SkeletonPDFManager />);
    expect(container.querySelector('[data-testid="skeleton-pdf-manager"]')).toBeDefined();
  });

  it('contains skeleton blocks', () => {
    const { container } = render(<SkeletonPDFManager />);
    const blocks = container.querySelectorAll('[data-testid="skeleton-block"]');
    expect(blocks.length).toBeGreaterThan(0);
  });
});

describe('SkeletonBookings', () => {
  it('renders with testid', () => {
    const { container } = render(<SkeletonBookings />);
    expect(container.querySelector('[data-testid="skeleton-bookings"]')).toBeDefined();
  });

  it('renders 3 stat cards', () => {
    const { container } = render(<SkeletonBookings />);
    const cards = container.querySelectorAll('[data-testid="skeleton-stat-card"]');
    expect(cards.length).toBe(3);
  });

  it('renders table rows', () => {
    const { container } = render(<SkeletonBookings />);
    const rows = container.querySelectorAll('[data-testid="skeleton-table-row"]');
    expect(rows.length).toBeGreaterThan(0);
  });
});

describe('SkeletonProperties', () => {
  it('renders with testid', () => {
    const { container } = render(<SkeletonProperties />);
    expect(container.querySelector('[data-testid="skeleton-properties"]')).toBeDefined();
  });

  it('renders 9 property card skeletons', () => {
    const { container } = render(<SkeletonProperties />);
    const cards = container.querySelectorAll('[data-testid="skeleton-property-card"]');
    expect(cards.length).toBe(9);
  });

  it('renders filter panel skeleton blocks', () => {
    const { container } = render(<SkeletonProperties />);
    const blocks = container.querySelectorAll('[data-testid="skeleton-block"]');
    expect(blocks.length).toBeGreaterThan(9);
  });
});

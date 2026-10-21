import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import TodayRunSection, { TodayRunData } from '../../app/admin/outreach/components/TodayRunSection';

function makeRun(runId: number, streetCount: number, perStreet = 2): TodayRunData['runs'][number] {
  const groups = [];
  for (let g = 0; g < streetCount; g++) {
    groups.push({
      groupId: runId * 100 + g,
      streets: [
        {
          street: `Street ${runId}-${g}`,
          suburb: 'Torbay',
          lat: -36.69,
          lng: 174.74,
          pendingCount: perStreet,
          addresses: Array.from({ length: perStreet }, (_, i) => `${i + 1} Street ${runId}-${g}`),
        },
      ],
      totalPending: perStreet,
      extentMeters: 100,
    });
  }
  return {
    runId,
    groups,
    totalPending: streetCount * perStreet,
    streetCount,
  };
}

const data: TodayRunData = {
  suburb: 'Torbay',
  groups: [],
  runs: [makeRun(1, 3), makeRun(2, 2), makeRun(3, 1), makeRun(4, 1)],
  unclusteredStreets: [],
};

function baseProps(overrides: Record<string, unknown> = {}) {
  return {
    status: 'unsent' as const,
    data,
    loading: false,
    error: null,
    onSelectStreet: vi.fn(),
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
});

describe('TodayRunSection', () => {
  it('renders nothing when status is not unsent', () => {
    const { container } = render(<TodayRunSection {...baseProps({ status: 'all' })} />);
    expect(container.innerHTML).toBe('');
  });

  it('shows the route header and nearby street summary', () => {
    render(<TodayRunSection {...baseProps()} />);
    expect(screen.getByText("🚀 Today's Route")).toBeTruthy();
    expect(screen.getByText(/6 addresses · 3 streets/)).toBeTruthy();
    expect(screen.getByText('Nearby streets in walking order')).toBeTruthy();
    expect(screen.queryByText(/Run 1/)).toBeNull();
    expect(screen.queryByText('Manual Run')).toBeNull();
    expect(screen.queryByRole('spinbutton')).toBeNull();
  });

  it('shows only the first route batch as ordered street chips', () => {
    render(<TodayRunSection {...baseProps()} />);
    expect(screen.getByRole('button', { name: 'Street 1-0 (2)' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Street 1-1 (2)' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Street 1-2 (2)' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Street 2-/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /More runs/ })).toBeNull();
  });

  it('shows loading state', () => {
    render(<TodayRunSection {...baseProps({ data: null, loading: true })} />);
    expect(screen.getByText('Loading…')).toBeTruthy();
  });

  it('shows error state', () => {
    render(<TodayRunSection {...baseProps({ data: null, error: 'oops' })} />);
    expect(screen.getByText('oops')).toBeTruthy();
  });

  it('shows empty message when no route streets', () => {
    render(<TodayRunSection {...baseProps({ data: { ...data, runs: [] } })} />);
    expect(screen.getByText('No pending addresses in this suburb.')).toBeTruthy();
  });

  it('calls onSelectStreet when a nearby street is clicked', () => {
    const onSelectStreet = vi.fn();
    render(<TodayRunSection {...baseProps({ onSelectStreet })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Street 1-1 (2)' }));
    expect(onSelectStreet).toHaveBeenCalledWith('Torbay', 'Street 1-1');
  });

  it('shows a warning when some streets have no coordinates', () => {
    render(
      <TodayRunSection
        {...baseProps({ data: { ...data, unclusteredStreets: [{ street: 'X', has_coords: false }] } })}
      />
    );
    expect(screen.getByText(/1 street without location data/)).toBeTruthy();
  });

  it('renders a start-street dropdown when allStreets are available', () => {
    render(
      <TodayRunSection
        {...baseProps({
          data: {
            ...data,
            allStreets: [
              { street: 'Alpha Street', count: 5 },
              { street: 'Beta Street', count: 3 },
            ],
            startStreet: 'Alpha Street',
          },
        })}
      />
    );
    expect(screen.getByLabelText('Start street')).toBeTruthy();
    expect(screen.getByText(/Auto \(default: Alpha Street\)/)).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Alpha Street (5)' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Beta Street (3)' })).toBeTruthy();
  });

  it('calls onStartStreetChange when the start street changes', () => {
    const onStartStreetChange = vi.fn();
    render(
      <TodayRunSection
        {...baseProps({
          data: {
            ...data,
            allStreets: [
              { street: 'Alpha Street', count: 5 },
              { street: 'Beta Street', count: 3 },
            ],
            startStreet: 'Alpha Street',
          },
          onStartStreetChange,
        })}
      />
    );
    fireEvent.change(screen.getByLabelText('Start street'), { target: { value: 'Beta Street' } });
    expect(onStartStreetChange).toHaveBeenCalledWith('Torbay', 'Beta Street');
  });

  it('keeps the start-street dropdown enabled when a legacy manual order exists', () => {
    render(
      <TodayRunSection
        {...baseProps({
          data: {
            ...data,
            allStreets: [
              { street: 'Alpha Street', count: 5 },
              { street: 'Beta Street', count: 3 },
            ],
            startStreet: 'Alpha Street',
            manualOrder: true,
            manualOrderCount: 2,
          },
        })}
      />
    );
    const select = screen.getByLabelText('Start street') as HTMLSelectElement;
    expect(select.disabled).toBe(false);
  });
});

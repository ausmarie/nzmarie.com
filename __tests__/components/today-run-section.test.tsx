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
    isMobile: false,
    status: 'unsent' as const,
    data,
    loading: false,
    error: null,
    budget: 20,
    onBudgetChange: vi.fn(),
    onSelectRun: vi.fn(),
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

  it('shows the English header and run summary with Addresses label', () => {
    render(<TodayRunSection {...baseProps()} />);
    expect(screen.getByText("🚀 Today's Run")).toBeTruthy();
    expect(screen.getByText(/14 addresses planned · 4 runs/)).toBeTruthy();
    expect(screen.getByText('Addresses')).toBeTruthy();
    expect(screen.getByRole('spinbutton', { name: 'Addresses per run' })).toBeTruthy();
  });

  it('shows only Run 1 and Run 2 by default, with a More runs button', () => {
    render(<TodayRunSection {...baseProps()} />);
    expect(screen.getByText('Run 1 (Recommended · Start here)')).toBeTruthy();
    expect(screen.getByText('Run 2')).toBeTruthy();
    expect(screen.queryByText('Run 3')).toBeNull();
    expect(screen.getByRole('button', { name: 'More runs (2)' })).toBeTruthy();
  });

  it('shows all runs after clicking More runs', () => {
    render(<TodayRunSection {...baseProps()} />);
    fireEvent.click(screen.getByRole('button', { name: 'More runs (2)' }));
    expect(screen.getByText('Run 3')).toBeTruthy();
    expect(screen.getByText('Run 4')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Show fewer runs' })).toBeTruthy();
  });

  it('shows loading state', () => {
    render(<TodayRunSection {...baseProps({ data: null, loading: true })} />);
    expect(screen.getByText('Loading…')).toBeTruthy();
  });

  it('shows error state', () => {
    render(<TodayRunSection {...baseProps({ data: null, error: 'oops' })} />);
    expect(screen.getByText('oops')).toBeTruthy();
  });

  it('shows empty message when no runs', () => {
    render(<TodayRunSection {...baseProps({ data: { ...data, runs: [] } })} />);
    expect(screen.getByText('No pending addresses in this suburb.')).toBeTruthy();
  });

  it('expanding a run shows only street names with address counts (no address list)', () => {
    render(<TodayRunSection {...baseProps()} />);

    // Addresses are not shown before expansion.
    expect(screen.queryByText('1 Street 1-0')).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: 'View streets ▼' })[0]);

    // Street names + counts are visible.
    expect(screen.getByRole('button', { name: /Street 1-0/ })).toBeTruthy();
    expect(screen.getAllByText('2 addresses')).toHaveLength(3);
    // Full addresses are NOT listed.
    expect(screen.queryByText('1 Street 1-0')).toBeNull();
  });

  it('clicking a run card calls onSelectRun with all its streets', () => {
    const onSelectRun = vi.fn();
    render(<TodayRunSection {...baseProps({ onSelectRun })} />);

    fireEvent.click(screen.getByText('Run 1 (Recommended · Start here)'));
    expect(onSelectRun).toHaveBeenCalledWith('Torbay', ['Street 1-0', 'Street 1-1', 'Street 1-2']);
  });

  it('calls onSelectStreet when a street name is clicked in expanded view', () => {
    const onSelectStreet = vi.fn();
    render(<TodayRunSection {...baseProps({ onSelectStreet })} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'View streets ▼' })[0]);
    fireEvent.click(screen.getByRole('button', { name: /Street 1-1/ }));
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

  it('updates addresses from the input', () => {
    const onBudgetChange = vi.fn();
    render(<TodayRunSection {...baseProps({ onBudgetChange })} />);

    const input = screen.getByRole('spinbutton', { name: 'Addresses per run' });
    fireEvent.change(input, { target: { value: '30' } });
    fireEvent.blur(input);
    expect(onBudgetChange).toHaveBeenCalledWith(30);
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

  it('disables the start-street dropdown when a manual order is applied', () => {
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
    expect(select.disabled).toBe(true);
    expect(screen.getAllByText(/Manual order applied/).length).toBeGreaterThan(0);
  });
});

import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import OutreachMapSidebar from '../../app/admin/outreach/components/OutreachMapSidebar';
import type { TodayRunData } from '../../app/admin/outreach/components/TodayRunSection';

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('OutreachMapSidebar', () => {
  const data: TodayRunData = {
    suburb: 'Torbay',
    groups: [
      {
        groupId: 1,
        streets: [
          {
            street: 'Ringwood Street',
            suburb: 'Torbay',
            lat: -36.7,
            lng: 174.75,
            pendingCount: 25,
            addressCoords: [
              { address: '1 Ringwood Street', lat: -36.7, lng: 174.75, sent: false, status: 'unsent' },
              { address: '2 Ringwood Street', lat: -36.7, lng: 174.751, sent: false, status: 'unsent' },
            ],
          },
        ],
        totalPending: 25,
        extentMeters: 0,
      },
    ],
    runs: [
      {
        runId: 1,
        groups: [
          {
            groupId: 1,
            streets: [
              {
                street: 'Ringwood Street',
                suburb: 'Torbay',
                lat: -36.7,
                lng: 174.75,
                pendingCount: 25,
                addressCoords: [
                  { address: '1 Ringwood Street', lat: -36.7, lng: 174.75, sent: false, status: 'unsent' },
                ],
              },
            ],
            totalPending: 25,
            extentMeters: 0,
          },
        ],
        totalPending: 25,
        streetCount: 1,
      },
    ],
    unclusteredStreets: [],
    manualOrder: false,
    manualOrderCount: 0,
    startStreet: 'Ringwood Street',
    allStreets: [{ street: 'Ringwood Street', count: 25 }],
  };

  it('renders the status filter buttons and Torbay summary button', () => {
    render(
      <OutreachMapSidebar
        data={data}
        loading={false}
        error={null}
        activeRunId={1}
        collapsedStreets={new Set()}
        onToggleStreet={vi.fn()}
        onStreetSelect={vi.fn()}
        onRunSelect={vi.fn()}
        onSuburbClick={vi.fn()}
        hidden={false}
        onToggleHidden={vi.fn()}
        statusFilter="all"
        onStatusFilterChange={vi.fn()}
        addressCounts={{ total: 25, unsent: 25, sent: 0, junk: 0 }}
      />
    );

    expect(screen.getByRole('button', { name: 'All' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Unsent' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sent' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Junk' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Torbay' })).toBeTruthy();
    expect(screen.getByText('25 pending · 25 Unsent · 0 Sent')).toBeTruthy();
  });

  it('hides the Show all button after revealing all runs', () => {
    const moreRunsData = {
      ...data,
      runs: [
        ...data.runs,
        { ...data.runs[0], runId: 2 },
        { ...data.runs[0], runId: 3 },
        { ...data.runs[0], runId: 4 },
      ],
    };

    render(
      <OutreachMapSidebar
        data={moreRunsData}
        loading={false}
        error={null}
        activeRunId={1}
        collapsedStreets={new Set()}
        onToggleStreet={vi.fn()}
        onStreetSelect={vi.fn()}
        onRunSelect={vi.fn()}
        onSuburbClick={vi.fn()}
        hidden={false}
        onToggleHidden={vi.fn()}
        statusFilter="all"
        onStatusFilterChange={vi.fn()}
        addressCounts={{ total: 100, unsent: 50, sent: 40, junk: 10 }}
      />
    );

    const showAllButton = screen.getByRole('button', { name: 'Show all 4 runs' });
    fireEvent.click(showAllButton);

    expect(screen.queryByRole('button', { name: 'Show all 4 runs' })).toBeNull();
  });

  it('calls onSuburbClick and status reset when Torbay is clicked', () => {
    const handleSuburbClick = vi.fn();
    const handleStatusChange = vi.fn();

    render(
      <OutreachMapSidebar
        data={data}
        loading={false}
        error={null}
        activeRunId={1}
        collapsedStreets={new Set()}
        onToggleStreet={vi.fn()}
        onStreetSelect={vi.fn()}
        onRunSelect={vi.fn()}
        onSuburbClick={handleSuburbClick}
        hidden={false}
        onToggleHidden={vi.fn()}
        statusFilter="sent"
        onStatusFilterChange={handleStatusChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Torbay' }));

    expect(handleSuburbClick).toHaveBeenCalledWith('Torbay');
    expect(handleStatusChange).toHaveBeenCalledWith('all');
  });

  it('shows percent summary for sent and junk filters', () => {
    render(
      <OutreachMapSidebar
        data={data}
        loading={false}
        error={null}
        activeRunId={1}
        collapsedStreets={new Set()}
        onToggleStreet={vi.fn()}
        onStreetSelect={vi.fn()}
        onRunSelect={vi.fn()}
        hidden={false}
        onToggleHidden={vi.fn()}
        statusFilter="sent"
        onStatusFilterChange={vi.fn()}
        addressCounts={{ total: 227, unsent: 85, sent: 95, junk: 50 }}
      />
    );

    expect(screen.getByText('95 Sent · 41.9%')).toBeTruthy();
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import React from 'react';

let shouldThrow = true;

vi.mock('../../app/admin/outreach/components/OutreachMapView', () => ({
  __esModule: true,
  default: (props: { suburb?: string }) => {
    if (shouldThrow) {
      throw new Error('ChunkLoadError');
    }
    return React.createElement('div', { 'data-testid': 'map-view' }, props.suburb || 'no-suburb');
  },
}));

import DynamicMapView from '../../app/admin/outreach/components/DynamicMapView';

describe('DynamicMapView chunk error fallback', () => {
  beforeEach(() => {
    shouldThrow = true;
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const baseProps = {
    suburb: 'Oteha',
    activeRunId: null,
    sentStatus: 'all' as const,
    onRunSelect: vi.fn(),
    onStreetSelect: vi.fn(),
  };

  it('renders the map view when the chunk loads successfully', async () => {
    shouldThrow = false;

    render(<DynamicMapView {...baseProps} />);

    const map = await screen.findByTestId('map-view');
    expect(map.textContent).toBe('Oteha');
  });

  it('shows a fallback with a Retry button when the chunk fails to load', async () => {
    render(<DynamicMapView {...baseProps} />);

    const fallback = await screen.findByTestId('map-chunk-fallback');
    expect(fallback.textContent).toContain('Failed to load the map view');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
    expect(screen.queryByTestId('map-view')).toBeNull();
  });

  it('retries and renders the map after a failed chunk load', async () => {
    render(<DynamicMapView {...baseProps} />);

    await screen.findByTestId('map-chunk-fallback');

    shouldThrow = false;
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => {
      expect(screen.getByTestId('map-view')).toBeTruthy();
    });
    expect(screen.queryByTestId('map-chunk-fallback')).toBeNull();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import SuburbSectionAnalytics from '../../../components/admin/SuburbSectionAnalytics';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('SuburbSectionAnalytics Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockFetch.mockReset();
  });

  const mockData = {
    success: true,
    summary: { total_users: 45, total_section_views: 200, new_devices: 12, repeat_devices: 33 },
    by_suburb: [
      { suburb: 'albany', users: 20, new_devices: 5, repeat_devices: 15, last_visited_at: '2026-09-05T00:00:00Z' },
      { suburb: 'oteha', users: 15, new_devices: 4, repeat_devices: 11, last_visited_at: '2026-09-04T00:00:00Z' },
    ],
    by_section: [
      { section_name: 'hero', total_views: 40, unique_users: 20, new_devices: 10, repeat_devices: 30 },
      { section_name: 'about', total_views: 35, unique_users: 18, new_devices: 8, repeat_devices: 27 },
    ],
    daily_trend: [
      { date: '2026-09-01', hero: 5, about: 3 },
      { date: '2026-09-02', hero: 8, about: 6 },
    ],
    recent_logs: [
      { time: '2026-09-05T14:32:00Z', suburb: 'albany', is_new_device: true, sections: ['hero', 'about'] },
    ],
  };

  it('renders component with data', async () => {
    mockFetch.mockResolvedValue({ json: () => Promise.resolve(mockData) });

    render(<SuburbSectionAnalytics />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    expect(screen.getAllByText('Suburb Section Analytics').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Week').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Month').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Quarter').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Year').length).toBeGreaterThan(0);
    expect(screen.getAllByText('45').length).toBeGreaterThan(0);
    expect(screen.getAllByText('200').length).toBeGreaterThan(0);
    expect(screen.getAllByText('12').length).toBeGreaterThan(0);
    expect(screen.getAllByText('33').length).toBeGreaterThan(0);
    expect(screen.getAllByText('albany').length).toBeGreaterThan(0);
    expect(screen.getAllByText('oteha').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Hero').length).toBeGreaterThan(0);
    expect(screen.getAllByText('About').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Recent Visits').length).toBeGreaterThan(0);
  });

  it('fetches data on mount', async () => {
    mockFetch.mockResolvedValue({ json: () => Promise.resolve(mockData) });

    render(<SuburbSectionAnalytics />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/admin/analytics/section-views?period=month')
      );
    });
  });

  it('shows loading state while fetching', async () => {
    mockFetch.mockReturnValue(new Promise(() => {}));

    render(<SuburbSectionAnalytics />);

    await waitFor(() => {
      expect(screen.getByText('Loading...')).toBeTruthy();
    });
  });

});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import ReportsPage from '@/app/admin/reports/page';
import { useReportStore } from '@/app/admin/reports/stores/report-store';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

function mockFetch() {
  global.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    const urlStr = String(url);
    const json = (data: unknown) => ({ ok: true, status: 200, json: async () => data });
    if (urlStr.includes('/api/admin/reports/overview')) {
      return Promise.resolve(json({
        success: true,
        region: { name: 'North Shore' },
        suburbs: [
          { id: 's1', name: 'Totara Vale', introDoc: null, letterDoc: null, reports: [] },
        ],
      })) as any;
    }
    if (urlStr.includes('/api/admin/reports/suburbs')) {
      return Promise.resolve(json({ success: true, suburbs: [{ id: 'sub-1', name: 'Totara Vale' }] })) as any;
    }
    if (urlStr.includes('/api/admin/reports/templates/generate') && (init?.method || 'GET').toUpperCase() === 'POST') {
      return Promise.resolve(json({ success: true, id: 'gen-doc-1' })) as any;
    }
    return Promise.resolve(json({ success: true })) as any;
  });
}

describe('Reports page Generate Report modal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useReportStore.setState({ slugMap: {}, idToSlug: {}, refreshKey: 0 });
    mockFetch();
  });

  afterEach(() => {
    cleanup();
  });

  it('opens the shared modal with the suburb preselected and a derived report name', async () => {
    render(<ReportsPage />);

    fireEvent.click(await screen.findByText('+ Generate Report'));

    expect(await screen.findByTestId('generate-report-modal')).toBeTruthy();

    const now = new Date();
    await waitFor(() => {
      expect(screen.getByTestId('gen-suburb-input')).toHaveProperty('value', 'Totara Vale');
      expect(screen.getByTestId('gen-name-input')).toHaveProperty(
        'value',
        `Q${Math.ceil((now.getMonth() + 1) / 3)} ${now.getFullYear()} Totara Vale`
      );
    });

    expect(screen.getByTestId('gen-period-quarter')).toBeTruthy();
    expect(screen.getByTestId('gen-period-month')).toBeTruthy();
  });

  it('generates the report and navigates to the new document', async () => {
    render(<ReportsPage />);

    fireEvent.click(await screen.findByText('+ Generate Report'));

    await waitFor(() => {
      expect(screen.getByTestId('gen-generate-btn').hasAttribute('disabled')).toBe(false);
    });
    fireEvent.click(screen.getByTestId('gen-generate-btn'));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/admin/reports/gen-doc-1');
    });
    expect(useReportStore.getState().refreshKey).toBe(1);
  });
});

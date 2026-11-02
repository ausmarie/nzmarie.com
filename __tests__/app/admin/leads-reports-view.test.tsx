import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import LeadReportsView from '@/app/admin/leads/components/LeadReportsView';

vi.mock('@/app/admin/reports/components/ReportEditor', () => ({ default: () => null }));
vi.mock('@/app/admin/reports/components/ConfirmModal', () => ({ default: () => null }));
vi.mock('@/app/admin/reports/components/GenerateReportModal', () => ({ default: () => null }));
vi.mock('@/app/admin/reports/hooks/useCtrlS', () => ({ useCtrlS: vi.fn() }));
vi.mock('@/app/admin/reports/stores/report-store', () => ({
  useReportStore: Object.assign(() => ({ isSaving: false, lastSaved: null }), {
    getState: () => ({ isSaving: false }),
  }),
}));

describe('LeadReportsView', () => {
  beforeEach(() => {
    localStorage.removeItem('leadReportsSidebarCollapsed');
    global.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      const leads = [
        {
          id: 'newest',
          property_address: '13 Carberry Lane',
          suburb: 'Northcote',
          created_at: '2026-10-05T00:00:00.000Z',
        },
        {
          id: 'duplicate',
          property_address: ' 13 CARBERRY LANE. ',
          suburb: 'Northcote',
          created_at: '2026-10-01T00:00:00.000Z',
        },
      ];

      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(url.includes('/api/admin/leads/list') ? { success: true, leads } : { success: true }),
      });
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders one report entry for duplicate addresses', async () => {
    render(<LeadReportsView onSwitchToLeads={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getAllByTestId('home-lead-item')).toHaveLength(1);
    });
    expect(screen.getAllByTestId('lead-list-item')).toHaveLength(1);
    expect(screen.getByTestId('lead-reports-count').textContent).toBe('1 Lead');
  });
});

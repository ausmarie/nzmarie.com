import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup, waitFor } from '@testing-library/react';
import React from 'react';
import LeadReportsView from '../../app/admin/leads/components/LeadReportsView';

vi.mock('@/app/admin/reports/components/ReportEditor', () => ({
  default: ({ docId }: { docId: string }) => (
    <div data-testid="mock-report-editor">{docId}</div>
  ),
}));

const mockLeads = [
  { id: 'lead-1', property_address: '249 Sunset Road', suburb: 'Sunnynook', status: 'new', priority: 'medium' },
  { id: 'lead-2', property_address: '11 Honour Avenue', suburb: 'Northcross', status: 'contacted', priority: 'high' },
];

const mockDocs = [
  { id: 'doc-1', title: 'Property Report — 249 Sunset Road', status: 'draft', updated_at: '2026-10-01T00:00:00.000Z' },
];

const mockDocDetail = {
  id: 'doc-1',
  title: 'Property Report — 249 Sunset Road',
  status: 'draft',
  doc_type: 'general',
  lead_id: 'lead-1',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello', styles: {} }] }],
  updated_at: '2026-10-01T00:00:00.000Z',
};

function installFetchMock() {
  global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method || 'GET').toUpperCase();
    const json = (data: unknown) => ({ ok: true, status: 200, json: async () => data });

    if (url.includes('/api/admin/leads/list')) {
      return json({ success: true, leads: mockLeads });
    }
    if (url.includes('/api/admin/reports/documents?lead_id=')) {
      if (url.includes('lead-2')) {
        return json({ success: true, documents: [] });
      }
      return json({ success: true, documents: mockDocs });
    }
    if (method === 'POST' && url.includes('/api/admin/reports/documents')) {
      return json({ success: true, id: 'doc-new' });
    }
    if (method === 'PUT' && url.includes('/api/admin/reports/documents')) {
      return json({ success: true });
    }
    if (method === 'DELETE' && url.includes('/api/admin/reports/documents/')) {
      return json({ success: true });
    }
    if (url.includes('/api/admin/reports/documents/')) {
      return json({ success: true, document: mockDocDetail });
    }
    return json({ success: false });
  }) as unknown as typeof fetch;
}

describe('LeadReportsView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    installFetchMock();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the sidebar with the leads list and auto-selects the first lead', async () => {
    render(<LeadReportsView onSwitchToLeads={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('249 Sunset Road')).toBeTruthy();
    });
    expect(screen.getByText('11 Honour Avenue')).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByTestId('mock-report-editor').textContent).toBe('doc-1');
    });
    expect(screen.getByTestId('report-title-input')).toHaveProperty('value', 'Property Report — 249 Sunset Road');
  });

  it('calls onSwitchToLeads from the sidebar Leads toggle', async () => {
    const onSwitchToLeads = vi.fn();
    render(<LeadReportsView onSwitchToLeads={onSwitchToLeads} />);

    await waitFor(() => {
      expect(screen.getByTestId('sidebar-leads-toggle')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('sidebar-leads-toggle'));
    expect(onSwitchToLeads).toHaveBeenCalledTimes(1);
  });

  it('collapses and expands the sidebar', async () => {
    render(<LeadReportsView onSwitchToLeads={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('sidebar-collapse')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('sidebar-collapse'));

    expect(screen.getByTestId('sidebar-expand')).toBeTruthy();
    expect(screen.queryByTestId('lead-list-item')).toBeNull();

    fireEvent.click(screen.getByTestId('sidebar-expand'));
    await waitFor(() => {
      expect(screen.getByTestId('sidebar-collapse')).toBeTruthy();
    });
  });

  it('creates a new report with lead_id and selects it', async () => {
    render(<LeadReportsView onSwitchToLeads={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('mock-report-editor').textContent).toBe('doc-1');
    });

    fireEvent.click(screen.getByTestId('new-report-btn'));

    await waitFor(() => {
      const postCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) =>
          String(c[0]).includes('/api/admin/reports/documents') &&
          (((c[1] as RequestInit | undefined)?.method) || 'GET') === 'POST'
      );
      expect(postCall).toBeTruthy();
      const body = JSON.parse(String((postCall![1] as RequestInit).body));
      expect(body.lead_id).toBe('lead-1');
      expect(body.doc_type).toBe('general');
      expect(body.title).toContain('249 Sunset Road');
    });

    await waitFor(() => {
      expect(screen.getByTestId('mock-report-editor').textContent).toBe('doc-new');
    });
  });

  it('reports lead selection changes via onLeadChange', async () => {
    const onLeadChange = vi.fn();
    render(<LeadReportsView onSwitchToLeads={vi.fn()} onLeadChange={onLeadChange} />);

    await waitFor(() => {
      expect(screen.getByText('11 Honour Avenue')).toBeTruthy();
    });

    await waitFor(() => {
      expect(onLeadChange).toHaveBeenCalledWith('lead-1');
    });

    fireEvent.click(screen.getByText('11 Honour Avenue'));
    await waitFor(() => {
      expect(onLeadChange).toHaveBeenCalledWith('lead-2');
    });
  });

  it('shows the empty state for a lead with no reports', async () => {
    render(<LeadReportsView onSwitchToLeads={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('11 Honour Avenue')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('11 Honour Avenue'));

    await waitFor(() => {
      expect(screen.getByText('No reports for this address yet.')).toBeTruthy();
    });
    expect(screen.getByText('+ Create first report')).toBeTruthy();
  });

  it('deletes the active report after confirmation', async () => {
    render(<LeadReportsView onSwitchToLeads={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('mock-report-editor').textContent).toBe('doc-1');
    });

    fireEvent.click(screen.getByTestId('delete-btn'));
    expect(screen.getByText('Confirm Delete')).toBeTruthy();

    fireEvent.click(screen.getByText('Confirm Delete'));

    await waitFor(() => {
      const deleteCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) =>
          String(c[0]).includes('/api/admin/reports/documents/doc-1') &&
          (((c[1] as RequestInit | undefined)?.method) || 'GET') === 'DELETE'
      );
      expect(deleteCall).toBeTruthy();
    });

    await waitFor(() => {
      expect(screen.getByText('No reports for this address yet.')).toBeTruthy();
    });
  });
});

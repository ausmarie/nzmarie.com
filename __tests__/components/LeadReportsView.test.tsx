import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';
import React from 'react';
import LeadReportsView from '../../app/admin/leads/components/LeadReportsView';

vi.mock('@/app/admin/reports/components/ReportEditor', async () => {
  const React = await import('react');
  function MockReportEditor({ docId, initialContent }: { docId: string; initialContent?: unknown }) {
    const [captured] = React.useState(initialContent);
    return (
      <>
        <div data-testid="mock-report-editor">{docId}</div>
        <div data-testid="mock-editor-content">{JSON.stringify(captured ?? null)}</div>
      </>
    );
  }
  return { default: MockReportEditor };
});

const mockLeads = [
  { id: 'lead-1', property_address: '249 Sunset Road', suburb: 'Sunnynook', status: 'contacted', priority: 'medium', owner_name: 'John Doe', owner_email: 'john@example.com', owner_phone: '0211234567', created_at: '2026-10-01T00:00:00.000Z' },
  { id: 'lead-2', property_address: '11 Honour Avenue', suburb: 'Northcross', status: 'new', priority: 'high', owner_name: 'Alice Smith', owner_email: 'alice@example.com', owner_phone: '0229876543', created_at: '2026-10-05T00:00:00.000Z' },
  { id: 'lead-3', property_address: '8 Rimu Street', suburb: 'Browns Bay', status: 'new', priority: 'medium', owner_name: 'Bob Jones', owner_email: 'bob@example.com', owner_phone: '0215551234', created_at: '2026-10-03T00:00:00.000Z' },
];

const mockDocs = [
  { id: 'doc-1', title: 'Property Report — 249 Sunset Road', status: 'draft', updated_at: '2026-10-01T00:00:00.000Z' },
  { id: 'doc-2', title: 'CMA — 249 Sunset Road', status: 'draft', updated_at: '2026-10-02T00:00:00.000Z' },
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

const mockDoc2Detail = {
  ...mockDocDetail,
  id: 'doc-2',
  title: 'CMA — 249 Sunset Road',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'CMA content', styles: {} }] }],
};

const mockSuburbs = [
  { id: 'sub-sunnynook', name: 'Sunnynook' },
  { id: 'sub-northcross', name: 'Northcross' },
  { id: 'sub-browns-bay', name: 'Browns Bay' },
];

const fetchState = { docGate: null as Promise<void> | null };

function installFetchMock() {
  global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method || 'GET').toUpperCase();
    const json = (data: unknown) => ({ ok: true, status: 200, json: async () => data });

    if (url.includes('/api/admin/leads/list')) {
      return json({ success: true, leads: mockLeads });
    }
    if (url.includes('/api/admin/reports/suburbs')) {
      return json({ success: true, suburbs: mockSuburbs });
    }
    if (method === 'POST' && url.includes('/api/admin/reports/templates/generate')) {
      return json({ success: true, id: 'doc-generated' });
    }
    if (url.includes('/api/admin/reports/documents?lead_id=')) {
      if (url.includes('lead-1')) {
        return json({ success: true, documents: mockDocs });
      }
      return json({ success: true, documents: [] });
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
    if (method === 'GET' && url.includes('/api/admin/reports/documents/') && fetchState.docGate) {
      await fetchState.docGate;
    }
    if (url.includes('/api/admin/reports/documents/doc-2')) {
      return json({ success: true, document: mockDoc2Detail });
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
    fetchState.docGate = null;
    installFetchMock();
  });

  afterEach(() => {
    cleanup();
  });

  it('shows the home overview listing leads newest first with owner and contact info', async () => {
    render(<LeadReportsView onSwitchToLeads={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('lead-reports-home')).toBeTruthy();
    });

    const items = screen.getAllByTestId('home-lead-item');
    expect(items).toHaveLength(3);
    expect(items[0].textContent).toContain('11 Honour Avenue');
    expect(items[1].textContent).toContain('8 Rimu Street');
    expect(items[2].textContent).toContain('249 Sunset Road');

    expect(items[0].textContent).toContain('Alice Smith');
    expect(items[0].textContent).toContain('0229876543');
    expect(items[0].textContent).toContain('alice@example.com');
    expect(items[0].textContent).toContain('Northcross');
    expect(items[0].textContent).toContain('Added');
  });

  it('shows the lead count under the Lead Reports heading', async () => {
    render(<LeadReportsView onSwitchToLeads={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('lead-reports-count')).toBeTruthy();
    });
    expect(screen.getByTestId('lead-reports-count').textContent).toBe('3 Leads');
  });

  it('hides the report toolbar while on the home overview', async () => {
    render(<LeadReportsView onSwitchToLeads={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getAllByTestId('home-lead-item')).toHaveLength(3);
    });

    expect(screen.queryByTestId('report-title-input')).toBeNull();
    expect(screen.queryByTestId('save-btn')).toBeNull();
    expect(screen.queryByTestId('print-btn')).toBeNull();
    expect(screen.queryByTestId('export-pdf-btn')).toBeNull();
    expect(screen.queryByTestId('delete-btn')).toBeNull();
  });

  it('shows the report toolbar after opening a specific report', async () => {
    render(<LeadReportsView onSwitchToLeads={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getAllByTestId('home-lead-item')).toHaveLength(3);
    });

    const lead1Item = screen.getAllByTestId('home-lead-item').find((el) =>
      el.textContent?.includes('249 Sunset Road')
    );
    fireEvent.click(lead1Item!);

    await waitFor(() => {
      expect(screen.getByTestId('save-btn')).toBeTruthy();
    });
    expect(screen.getByTestId('report-title-input')).toBeTruthy();
    expect(screen.getByTestId('print-btn')).toBeTruthy();
    expect(screen.getByTestId('export-pdf-btn')).toBeTruthy();
    expect(screen.getByTestId('delete-btn')).toBeTruthy();
  });

  it('opens a lead report when clicking a home lead item', async () => {
    render(<LeadReportsView onSwitchToLeads={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getAllByTestId('home-lead-item')).toHaveLength(3);
    });

    const lead1Item = screen.getAllByTestId('home-lead-item').find((el) =>
      el.textContent?.includes('249 Sunset Road')
    );
    fireEvent.click(lead1Item!);

    await waitFor(() => {
      expect(screen.getByTestId('mock-report-editor').textContent).toBe('doc-1');
    });
    expect(screen.getByTestId('report-title-input')).toHaveProperty('value', 'Property Report — 249 Sunset Road');
    expect(screen.queryByTestId('lead-reports-home')).toBeNull();
  });

  it('renders the sidebar with the leads list', async () => {
    render(<LeadReportsView onSwitchToLeads={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('lead-reports-sidebar')).toBeTruthy();
    });
    const sidebar = screen.getByTestId('lead-reports-sidebar');
    expect(within(sidebar).getByText('249 Sunset Road')).toBeTruthy();
    expect(within(sidebar).getByText('11 Honour Avenue')).toBeTruthy();
    expect(within(sidebar).getByText('8 Rimu Street')).toBeTruthy();
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
    expect(screen.queryByTestId('lead-reports-sidebar')).toBeNull();

    fireEvent.click(screen.getByTestId('sidebar-expand'));
    await waitFor(() => {
      expect(screen.getByTestId('sidebar-collapse')).toBeTruthy();
    });
  });

  it('opens the generate modal from + New Report and creates a lead report', async () => {
    render(<LeadReportsView onSwitchToLeads={vi.fn()} initialLeadId="lead-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('mock-report-editor').textContent).toBe('doc-1');
    });

    fireEvent.click(screen.getByTestId('new-report-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('generate-report-modal')).toBeTruthy();
    });
    await waitFor(() => {
      expect(screen.getByTestId('gen-suburb-input')).toHaveProperty('value', 'Sunnynook');
    });
    await waitFor(() => {
      expect(screen.getByTestId('gen-generate-btn').hasAttribute('disabled')).toBe(false);
    });

    fireEvent.click(screen.getByTestId('gen-generate-btn'));

    await waitFor(() => {
      const postCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) =>
          String(c[0]).includes('/api/admin/reports/templates/generate') &&
          (((c[1] as RequestInit | undefined)?.method) || 'GET') === 'POST'
      );
      expect(postCall).toBeTruthy();
      const body = JSON.parse(String((postCall![1] as RequestInit).body));
      expect(body.lead_id).toBe('lead-1');
      expect(body.suburb_id).toBe('sub-sunnynook');
      expect(body.period_type).toBe('quarter');
      expect(typeof body.start_quarter).toBe('string');
      expect(typeof body.end_quarter).toBe('string');
    });

    await waitFor(() => {
      expect(screen.queryByTestId('generate-report-modal')).toBeNull();
    });
    await waitFor(() => {
      expect(screen.getByTestId('mock-report-editor').textContent).toBe('doc-generated');
    });
  });

  it('opens the generate modal from the empty state Create first report button', async () => {
    render(<LeadReportsView onSwitchToLeads={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getAllByTestId('home-lead-item')).toHaveLength(3);
    });
    const lead2Item = screen.getAllByTestId('home-lead-item').find((el) =>
      el.textContent?.includes('11 Honour Avenue')
    );
    fireEvent.click(lead2Item!);

    await waitFor(() => {
      expect(screen.getByText('No reports for this address yet.')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('+ Create first report'));

    await waitFor(() => {
      expect(screen.getByTestId('generate-report-modal')).toBeTruthy();
    });
    await waitFor(() => {
      expect(screen.getByTestId('gen-suburb-input')).toHaveProperty('value', 'Northcross');
    });
  });

  it('deep-links to a lead via initialLeadId', async () => {
    render(<LeadReportsView onSwitchToLeads={vi.fn()} initialLeadId="lead-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('mock-report-editor').textContent).toBe('doc-1');
    });
    expect(screen.queryByTestId('lead-reports-home')).toBeNull();
  });

  it('reports lead selection changes via onLeadChange', async () => {
    const onLeadChange = vi.fn();
    render(<LeadReportsView onSwitchToLeads={vi.fn()} onLeadChange={onLeadChange} />);

    await waitFor(() => {
      expect(onLeadChange).toHaveBeenCalledWith(null);
    });

    const lead1Item = screen.getAllByTestId('home-lead-item').find((el) =>
      el.textContent?.includes('249 Sunset Road')
    );
    fireEvent.click(lead1Item!);
    await waitFor(() => {
      expect(onLeadChange).toHaveBeenCalledWith('lead-1');
    });
  });

  it('shows the empty state for a lead with no reports', async () => {
    render(<LeadReportsView onSwitchToLeads={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getAllByTestId('home-lead-item')).toHaveLength(3);
    });
    const lead2Item = screen.getAllByTestId('home-lead-item').find((el) =>
      el.textContent?.includes('11 Honour Avenue')
    );
    fireEvent.click(lead2Item!);

    await waitFor(() => {
      expect(screen.getByText('No reports for this address yet.')).toBeTruthy();
    });
    expect(screen.getByText('+ Create first report')).toBeTruthy();
  });

  it('deletes the active report after confirmation', async () => {
    render(<LeadReportsView onSwitchToLeads={vi.fn()} initialLeadId="lead-1" />);

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
      expect(screen.getByTestId('mock-report-editor').textContent).toBe('doc-2');
    });
    await waitFor(() => {
      expect(screen.getByTestId('report-title-input')).toHaveProperty('value', 'CMA — 249 Sunset Road');
    });
  });

  it('deletes a report from its sidebar row while keeping the open report active', async () => {
    render(<LeadReportsView onSwitchToLeads={vi.fn()} initialLeadId="lead-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('mock-report-editor').textContent).toBe('doc-1');
    });

    const rows = screen.getAllByTestId('report-list-item');
    expect(rows).toHaveLength(2);
    const rowDeleteBtn = within(rows[1]).getByTestId('report-delete-btn');
    fireEvent.click(rowDeleteBtn);

    expect(screen.getByText('Delete "CMA — 249 Sunset Road"?')).toBeTruthy();

    fireEvent.click(screen.getByText('Confirm Delete'));

    await waitFor(() => {
      const deleteCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) =>
          String(c[0]).includes('/api/admin/reports/documents/doc-2') &&
          (((c[1] as RequestInit | undefined)?.method) || 'GET') === 'DELETE'
      );
      expect(deleteCall).toBeTruthy();
    });

    await waitFor(() => {
      expect(screen.queryByText('CMA — 249 Sunset Road')).toBeNull();
    });
    expect(screen.getByTestId('mock-report-editor').textContent).toBe('doc-1');
    await waitFor(() => {
      expect(screen.getByTestId('report-title-input')).toHaveProperty('value', 'Property Report — 249 Sunset Road');
    });
    expect(screen.getAllByTestId('report-list-item')).toHaveLength(1);
  });

  it('shows child reports under an expanded address', async () => {
    render(<LeadReportsView onSwitchToLeads={vi.fn()} initialLeadId="lead-1" />);

    await waitFor(() => {
      expect(screen.getByText('Property Report — 249 Sunset Road')).toBeTruthy();
    });
    const sidebar = screen.getByTestId('lead-reports-sidebar');
    const children = within(sidebar).getAllByTestId('report-list-item');
    expect(children).toHaveLength(2);
    expect(children[0].textContent).toContain('Property Report — 249 Sunset Road');
    expect(children[1].textContent).toContain('CMA — 249 Sunset Road');
  });

  it('collapses an expanded address to hide its child reports', async () => {
    render(<LeadReportsView onSwitchToLeads={vi.fn()} initialLeadId="lead-1" />);

    await waitFor(() => {
      expect(screen.getByText('Property Report — 249 Sunset Road')).toBeTruthy();
    });

    const sidebar = screen.getByTestId('lead-reports-sidebar');
    fireEvent.click(within(sidebar).getByText('249 Sunset Road'));
    expect(within(sidebar).queryByTestId('report-list-item')).toBeNull();
  });

  it('opens a child report when its row is clicked', async () => {
    render(<LeadReportsView onSwitchToLeads={vi.fn()} initialLeadId="lead-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('mock-report-editor').textContent).toBe('doc-1');
    });

    const sidebar = screen.getByTestId('lead-reports-sidebar');
    fireEvent.click(within(sidebar).getByText('CMA — 249 Sunset Road'));

    await waitFor(() => {
      expect(screen.getByTestId('mock-report-editor').textContent).toBe('doc-2');
    });
    await waitFor(() => {
      expect(screen.getByTestId('report-title-input')).toHaveProperty('value', 'CMA — 249 Sunset Road');
    });
  });

  it('loads the selected report content when switching between reports of a lead', async () => {
    render(<LeadReportsView onSwitchToLeads={vi.fn()} initialLeadId="lead-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('mock-report-editor').textContent).toBe('doc-1');
    });
    expect(screen.getByTestId('mock-editor-content').textContent).toContain('Hello');

    const sidebar = screen.getByTestId('lead-reports-sidebar');
    fireEvent.click(within(sidebar).getByText('CMA — 249 Sunset Road'));

    await waitFor(() => {
      expect(screen.getByTestId('mock-report-editor').textContent).toBe('doc-2');
    });
    await waitFor(() => {
      expect(screen.getByTestId('mock-editor-content').textContent).toContain('CMA content');
    });
    expect(screen.getByTestId('mock-editor-content').textContent).not.toContain('Hello');
  });

  it('blocks Save while a report is still loading and saves once it is loaded', async () => {
    render(<LeadReportsView onSwitchToLeads={vi.fn()} initialLeadId="lead-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('mock-report-editor').textContent).toBe('doc-1');
    });

    let releaseGate!: () => void;
    fetchState.docGate = new Promise<void>((resolve) => { releaseGate = resolve; });

    const sidebar = screen.getByTestId('lead-reports-sidebar');
    fireEvent.click(within(sidebar).getByText('CMA — 249 Sunset Road'));

    await waitFor(() => {
      expect(screen.getByTestId('report-title-input')).toHaveProperty('value', '');
    });
    expect(screen.queryByTestId('mock-report-editor')).toBeNull();

    const findPutCalls = () =>
      (global.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(
        (c: unknown[]) =>
          String(c[0]).includes('/api/admin/reports/documents') &&
          (((c[1] as RequestInit | undefined)?.method) || 'GET') === 'PUT'
      );

    fireEvent.click(screen.getByTestId('save-btn'));
    await new Promise((r) => setTimeout(r, 30));
    expect(findPutCalls()).toHaveLength(0);

    releaseGate();
    await waitFor(() => {
      expect(screen.getByTestId('mock-report-editor').textContent).toBe('doc-2');
    });

    fireEvent.click(screen.getByTestId('save-btn'));
    await waitFor(() => {
      const puts = findPutCalls();
      expect(puts.length).toBeGreaterThan(0);
      const body = JSON.parse(String((puts[0][1] as RequestInit).body));
      expect(body.id).toBe('doc-2');
      expect(Array.isArray(body.content)).toBe(true);
    });
  });

  it('expands an address on click and fetches its reports', async () => {
    render(<LeadReportsView onSwitchToLeads={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('lead-reports-sidebar')).toBeTruthy();
    });

    const sidebar = screen.getByTestId('lead-reports-sidebar');
    fireEvent.click(within(sidebar).getByText('8 Rimu Street'));
    await waitFor(() => {
      const listCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => String(c[0]).includes('/api/admin/reports/documents?lead_id=lead-3')
      );
      expect(listCall).toBeTruthy();
    });
  });

  it('uses a fixed full-page layout that hides chrome in print', async () => {
    const { container } = render(<LeadReportsView onSwitchToLeads={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('lead-reports-view')).toBeTruthy();
    });

    const root = screen.getByTestId('lead-reports-view');
    expect(root.style.position).toBe('fixed');
    expect(root.style.top).toBe('64px');

    const styleText = container.querySelector('style')?.textContent || '';
    expect(styleText).toContain('.leads-mode-chrome { display: none !important; }');
    expect(styleText).toContain('.lead-reports-sidebar, .lead-reports-toolbar, .reports-editor-status, .lead-reports-home { display: none !important; }');
    expect(styleText).toContain('position: static !important');
    expect(styleText).toContain('nav { display: none !important; }');
  });

  it('prints via Print and Export PDF buttons', async () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    render(<LeadReportsView onSwitchToLeads={vi.fn()} initialLeadId="lead-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('print-btn')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('print-btn'));
    expect(printSpy).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('export-pdf-btn'));
    expect(printSpy).toHaveBeenCalledTimes(2);

    printSpy.mockRestore();
  });
});

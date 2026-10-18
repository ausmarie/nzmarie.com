import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import ReportToolbar from '@/app/admin/reports/components/ReportToolbar';
import { useReportStore } from '@/app/admin/reports/stores/report-store';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const CURRENT_YEAR = new Date().getFullYear();
const CURRENT_MONTH = new Date().getMonth() + 1;
const CURRENT_QUARTER = `${CURRENT_YEAR}-Q${Math.ceil(CURRENT_MONTH / 3)}`;
const CURRENT_MM = String(CURRENT_MONTH).padStart(2, '0');

function mockFetch() {
  global.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    const urlStr = String(url);
    if (urlStr.includes('/api/admin/reports/suburbs')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          suburbs: [{ id: 'sub-1', name: 'Takapuna' }],
        }),
      }) as any;
    }
    if (urlStr.includes('/api/admin/reports/templates/generate') && (init?.method || 'GET').toUpperCase() === 'POST') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, id: 'doc-1' }) }) as any;
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) }) as any;
  });
}

function renderToolbar() {
  return render(
    <ReportToolbar
      title="Test Report"
      onTitleChange={vi.fn()}
      status="draft"
      docType="report"
      saving={false}
      onSaveNow={vi.fn()}
      onExport={vi.fn()}
      onDelete={vi.fn()}
      onEditHeaderFooter={vi.fn()}
      suburbName="Takapuna"
      quarter="2026-Q3"
      suburbId="sub-1"
    />
  );
}

function openModal() {
  fireEvent.click(screen.getByText('+ Generate Report'));
}

describe('ReportToolbar Generate Report modal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useReportStore.setState({ slugMap: {}, idToSlug: {}, refreshKey: 0 });
    mockFetch();
  });

  afterEach(() => {
    cleanup();
  });

  it('opens with the current Report Quarter and 2025-Q1 Data Start Quarter', async () => {
    renderToolbar();
    openModal();

    const reportQuarter = (await screen.findByLabelText(/Report Quarter/i)) as HTMLSelectElement;
    expect(reportQuarter.value).toBe(CURRENT_QUARTER);

    const startSelect = (await screen.findByLabelText(/Data Start Quarter/i)) as HTMLSelectElement;
    expect(startSelect.value).toBe('2025-Q1');

    const endSelect = screen.getByLabelText(/Data End Quarter/i) as HTMLSelectElement;
    expect(endSelect.value).toBe(CURRENT_QUARTER);
  });

  it('resets to the defaults after a change and reopen', async () => {
    renderToolbar();
    openModal();

    const startSelect = (await screen.findByLabelText(/Data Start Quarter/i)) as HTMLSelectElement;
    fireEvent.change(startSelect, { target: { value: '2024-Q1' } });
    expect(startSelect.value).toBe('2024-Q1');

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    openModal();
    const reopened = (await screen.findByLabelText(/Data Start Quarter/i)) as HTMLSelectElement;
    await waitFor(() => expect(reopened.value).toBe('2025-Q1'));
  });

  it('switches to month mode with 2025-01 Data Start Month and the current Report Month', async () => {
    renderToolbar();
    openModal();

    fireEvent.click(await screen.findByTestId('gen-period-month'));

    expect((screen.getByLabelText(/Data Start Month/i) as HTMLSelectElement).value).toBe('2025-01');
    expect((screen.getByTestId('gen-month') as HTMLSelectElement).value).toBe(String(CURRENT_MONTH));
    expect((screen.getByTestId('gen-end-month') as HTMLSelectElement).value).toBe(`${CURRENT_YEAR}-${CURRENT_MM}`);
    expect(screen.queryByLabelText(/Report Quarter/i)).toBeNull();
  });

  it('moves Data End Month with Report Year and Report Month', async () => {
    renderToolbar();
    openModal();
    fireEvent.click(await screen.findByTestId('gen-period-month'));

    fireEvent.change(screen.getByTestId('gen-year'), { target: { value: '2025' } });
    expect((screen.getByTestId('gen-end-month') as HTMLSelectElement).value).toBe(`2025-${CURRENT_MM}`);

    fireEvent.change(screen.getByTestId('gen-month'), { target: { value: '5' } });
    expect((screen.getByTestId('gen-end-month') as HTMLSelectElement).value).toBe('2025-05');
  });

  it('derives the report name from the report suburb', async () => {
    renderToolbar();
    openModal();

    await waitFor(() => {
      expect(screen.getByTestId('gen-name-input')).toHaveProperty(
        'value',
        `Q${Math.ceil(CURRENT_MONTH / 3)} ${CURRENT_YEAR} Takapuna`
      );
    });
  });

  it('generates and navigates to the generated document id', async () => {
    const existingSlug = `takapuna-q${Math.ceil(CURRENT_MONTH / 3)}-${CURRENT_YEAR}`;
    useReportStore.setState({
      slugMap: { [existingSlug]: 'old-doc' },
      idToSlug: { 'old-doc': existingSlug },
    });
    renderToolbar();
    openModal();

    await waitFor(() => {
      expect(screen.getByTestId('gen-generate-btn').hasAttribute('disabled')).toBe(false);
    });
    fireEvent.click(screen.getByTestId('gen-generate-btn'));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/admin/reports/doc-1');
    });

    const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;
    const generateCall = calls.find(([url, init]) =>
      String(url).includes('/api/admin/reports/templates/generate') &&
      ((init as RequestInit | undefined)?.method || '').toUpperCase() === 'POST'
    )!;
    const body = JSON.parse(String((generateCall[1] as RequestInit).body));
    expect(body.suburb_id).toBe('sub-1');
    expect(body.period_type).toBe('quarter');
    expect(body.report_name).toBe(`Q${Math.ceil(CURRENT_MONTH / 3)} ${CURRENT_YEAR} Takapuna`);
    expect(body).not.toHaveProperty('lead_id');
  });
});

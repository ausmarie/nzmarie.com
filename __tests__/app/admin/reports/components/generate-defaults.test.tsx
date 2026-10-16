import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import TemplateSelector from '@/app/admin/reports/components/TemplateSelector';
import ReportToolbar from '@/app/admin/reports/components/ReportToolbar';
import { useReportStore } from '@/app/admin/reports/stores/report-store';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

function mockFetch() {
  global.fetch = vi.fn().mockImplementation((url: string) => {
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

describe('Generate Report — Data Start Quarter defaults to 2025-Q1', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useReportStore.setState({ slugMap: {}, idToSlug: {}, refreshKey: 0 });
    mockFetch();
  });

  afterEach(() => {
    cleanup();
  });

  it('TemplateSelector opens with 2025-Q1 selected', async () => {
    render(
      <TemplateSelector
        open
        onClose={vi.fn()}
        onGenerate={vi.fn()}
        preselectedSuburbId={null}
      />
    );
    const startSelect = (await screen.findByLabelText(/Data Start Quarter/i)) as HTMLSelectElement;
    expect(startSelect.value).toBe('2025-Q1');
  });

  it('TemplateSelector resets to 2025-Q1 when reopened', async () => {
    const onGenerate = vi.fn();
    const { rerender } = render(
      <TemplateSelector
        open={false}
        onClose={vi.fn()}
        onGenerate={onGenerate}
        preselectedSuburbId={null}
      />
    );
    rerender(
      <TemplateSelector
        open
        onClose={vi.fn()}
        onGenerate={onGenerate}
        preselectedSuburbId={null}
      />
    );
    const startSelect = (await screen.findByLabelText(/Data Start Quarter/i)) as HTMLSelectElement;
    expect(startSelect.value).toBe('2025-Q1');
  });

  it('TemplateSelector ignores preselectedQuarter for Data Start Quarter', async () => {
    render(
      <TemplateSelector
        open
        onClose={vi.fn()}
        onGenerate={vi.fn()}
        preselectedSuburbId={null}
        preselectedQuarter="2026-Q3"
      />
    );
    const startSelect = (await screen.findByLabelText(/Data Start Quarter/i)) as HTMLSelectElement;
    expect(startSelect.value).toBe('2025-Q1');
  });

  it('ReportToolbar Generate Report modal opens with 2025-Q1 selected', async () => {
    renderToolbar();
    fireEvent.click(screen.getByText('+ Generate Report'));
    const startSelect = (await screen.findByLabelText(/Data Start Quarter/i)) as HTMLSelectElement;
    expect(startSelect.value).toBe('2025-Q1');
  });

  it('ReportToolbar resets to 2025-Q1 after user changed it and reopened', async () => {
    renderToolbar();
    fireEvent.click(screen.getByText('+ Generate Report'));

    const startSelect = (await screen.findByLabelText(/Data Start Quarter/i)) as HTMLSelectElement;
    fireEvent.change(startSelect, { target: { value: '2024-Q1' } });
    expect(startSelect.value).toBe('2024-Q1');

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    fireEvent.click(screen.getByText('+ Generate Report'));
    const reopened = (await screen.findByLabelText(/Data Start Quarter/i)) as HTMLSelectElement;
    await waitFor(() => expect(reopened.value).toBe('2025-Q1'));
  });
});

describe('Generate Report — Report Quarter derived from Report Month', () => {
  const CURRENT_YEAR = new Date().getFullYear();

  beforeEach(() => {
    vi.clearAllMocks();
    useReportStore.setState({ slugMap: {}, idToSlug: {}, refreshKey: 0 });
    mockFetch();
  });

  afterEach(() => {
    cleanup();
  });

  it.each([
    [2, `${CURRENT_YEAR}-Q1`],
    [3, `${CURRENT_YEAR}-Q1`],
    [4, `${CURRENT_YEAR}-Q2`],
    [6, `${CURRENT_YEAR}-Q2`],
    [7, `${CURRENT_YEAR}-Q3`],
    [9, `${CURRENT_YEAR}-Q3`],
    [10, `${CURRENT_YEAR}-Q4`],
    [12, `${CURRENT_YEAR}-Q4`],
  ])('ReportToolbar: month %i maps to quarter %s', async (month, expectedQuarter) => {
    renderToolbar();
    fireEvent.click(screen.getByText('+ Generate Report'));

    const monthSelect = (await screen.findByLabelText(/Report Month/i)) as HTMLSelectElement;
    fireEvent.change(monthSelect, { target: { value: String(month) } });

    const quarterSelect = (await screen.findByLabelText(/Report Quarter/i)) as HTMLSelectElement;
    expect(quarterSelect.value).toBe(expectedQuarter);
  });

  it('ReportToolbar: changing year updates quarter to that year', async () => {
    renderToolbar();
    fireEvent.click(screen.getByText('+ Generate Report'));

    const monthSelect = (await screen.findByLabelText(/Report Month/i)) as HTMLSelectElement;
    fireEvent.change(monthSelect, { target: { value: '5' } });

    const yearSelect = (await screen.findByLabelText(/Report Year/i)) as HTMLSelectElement;
    fireEvent.change(yearSelect, { target: { value: '2025' } });

    const quarterSelect = (await screen.findByLabelText(/Report Quarter/i)) as HTMLSelectElement;
    expect(quarterSelect.value).toBe('2025-Q2');
  });

  it.each([
    [1, `${CURRENT_YEAR}-Q1`],
    [5, `${CURRENT_YEAR}-Q2`],
    [8, `${CURRENT_YEAR}-Q3`],
    [11, `${CURRENT_YEAR}-Q4`],
  ])('TemplateSelector: month %i maps to quarter %s', async (month, expectedQuarter) => {
    render(
      <TemplateSelector
        open
        onClose={vi.fn()}
        onGenerate={vi.fn()}
        preselectedSuburbId={null}
      />
    );
    const monthSelect = (await screen.findByLabelText(/Report Month/i)) as HTMLSelectElement;
    fireEvent.change(monthSelect, { target: { value: String(month) } });

    const quarterSelect = (await screen.findByLabelText(/Report Quarter/i)) as HTMLSelectElement;
    expect(quarterSelect.value).toBe(expectedQuarter);
  });

  it('TemplateSelector: changing year updates quarter to that year', async () => {
    render(
      <TemplateSelector
        open
        onClose={vi.fn()}
        onGenerate={vi.fn()}
        preselectedSuburbId={null}
      />
    );
    const monthSelect = (await screen.findByLabelText(/Report Month/i)) as HTMLSelectElement;
    fireEvent.change(monthSelect, { target: { value: '8' } });

    const yearSelect = (await screen.findByLabelText(/Report Year/i)) as HTMLSelectElement;
    fireEvent.change(yearSelect, { target: { value: '2027' } });

    const quarterSelect = (await screen.findByLabelText(/Report Quarter/i)) as HTMLSelectElement;
    expect(quarterSelect.value).toBe('2027-Q3');
  });
});

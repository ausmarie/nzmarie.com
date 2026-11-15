import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import MarketGenerateReportModal from '@/components/market/MarketGenerateReportModal';

describe('MarketGenerateReportModal', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('matches the Leads report period and range controls for North Shore', async () => {
    render(
      <MarketGenerateReportModal
        open
        latestAvailableMonth="2026-10"
        existingReports={[]}
        onClose={vi.fn()}
        onGenerated={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('market-report-year')).toHaveProperty('value', '2026');
      expect(screen.getByTestId('market-report-part')).toHaveProperty('value', 'Q4');
    });
    expect(screen.getByTestId('market-report-language')).toHaveProperty('value', 'en');
    expect(screen.getByLabelText('Suburb')).toHaveProperty('value', 'North Shore');
    expect(screen.getByTestId('market-data-start-year')).toHaveProperty('value', '2025');
    expect(screen.getByTestId('market-data-start-part')).toHaveProperty('value', 'Q1');
    expect(screen.getByTestId('market-data-end-year')).toHaveProperty('value', '2026');
    expect(screen.getByTestId('market-data-end-part')).toHaveProperty('value', 'Q4');

    fireEvent.click(screen.getByTestId('market-period-month'));

    expect(screen.getByTestId('market-report-year')).toHaveProperty('value', '2026');
    expect(screen.getByTestId('market-report-part')).toHaveProperty('value', '10');
    expect(Array.from((screen.getByTestId('market-report-year') as HTMLSelectElement).options).map((option) => option.value))
      .toContain('2029');
    expect(Array.from((screen.getByTestId('market-report-part') as HTMLSelectElement).options).map((option) => option.textContent))
      .toContain('October');
    expect(screen.getByTestId('market-chart-period-quarter').className).toContain('bg-emerald-600');
    expect(screen.getByTestId('market-data-start-year')).toHaveProperty('value', '2025');
    expect(screen.getByTestId('market-data-start-part')).toHaveProperty('value', 'Q1');
    expect(screen.getByTestId('market-data-end-year')).toHaveProperty('value', '2026');
    expect(screen.getByTestId('market-data-end-part')).toHaveProperty('value', 'Q4');

    fireEvent.click(screen.getByTestId('market-chart-period-month'));
    expect(screen.getByTestId('market-data-start-year')).toHaveProperty('value', '2025');
    expect(screen.getByTestId('market-data-start-part')).toHaveProperty('value', '1');
    expect(screen.getByTestId('market-data-end-year')).toHaveProperty('value', '2026');
    expect(screen.getByTestId('market-data-end-part')).toHaveProperty('value', '10');
    expect(Array.from((screen.getByTestId('market-data-end-part') as HTMLSelectElement).options).map((option) => option.textContent))
      .toContain('December');
  });

  it('posts the report name, selected period, and data range', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, id: 'market-report-1' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const onGenerated = vi.fn().mockResolvedValue(undefined);

    render(
      <MarketGenerateReportModal
        open
        latestAvailableMonth="2026-10"
        existingReports={[]}
        onClose={vi.fn()}
        onGenerated={onGenerated}
      />,
    );

    await waitFor(() => expect(screen.getByTestId('market-report-name')).toHaveProperty('value', 'North Shore Property Market Report — Q4 2026'));
    fireEvent.change(screen.getByTestId('market-report-year'), { target: { value: '2029' } });
    fireEvent.change(screen.getByTestId('market-report-part'), { target: { value: 'Q3' } });
    expect(screen.getByTestId('market-report-name')).toHaveProperty('value', 'North Shore Property Market Report — Q3 2029');
    fireEvent.change(screen.getByTestId('market-report-name'), { target: { value: 'North Shore October 2026' } });
    fireEvent.click(screen.getByTestId('market-period-month'));
    fireEvent.change(screen.getByTestId('market-report-year'), { target: { value: '2026' } });
    fireEvent.change(screen.getByTestId('market-report-part'), { target: { value: '10' } });
    fireEvent.submit(screen.getByRole('dialog'));

    await waitFor(() => expect(onGenerated).toHaveBeenCalledWith('market-report-1', false));
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/market-reports', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        title: 'North Shore October 2026',
        language: 'en',
        periodType: 'monthly',
        periodKey: '2026-10',
        chartPeriodType: 'quarterly',
        dataStartKey: '2025-Q1',
        dataEndKey: '2026-Q4',
      }),
    }));
  });

  it('does not render when closed', () => {
    render(
      <MarketGenerateReportModal
        open={false}
        latestAvailableMonth="2026-10"
        existingReports={[]}
        onClose={vi.fn()}
        onGenerated={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.queryByTestId('market-generate-report-modal')).toBeNull();
  });

  it('offers to regenerate when a report already exists for the selected period', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, id: 'existing-report', reused: true }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const onGenerated = vi.fn().mockResolvedValue(undefined);

    render(
      <MarketGenerateReportModal
        open
        latestAvailableMonth="2026-10"
        existingReports={[{ period_type: 'monthly', period_key: '2026-10', language: 'en' }]}
        onClose={vi.fn()}
        onGenerated={onGenerated}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('market-report-part')).toHaveProperty('value', 'Q4');
    });
    fireEvent.click(screen.getByTestId('market-period-month'));

    expect(screen.getByRole('status').textContent).toContain(
      'Analytics will be refreshed while saved commentary is preserved.',
    );
    expect(screen.getByRole('button', { name: 'Regenerate Report' })).toBeTruthy();
    fireEvent.submit(screen.getByRole('dialog'));

    await waitFor(() => expect(onGenerated).toHaveBeenCalledWith('existing-report', true));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('creates a Chinese report separately from an English report for the same period', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, id: 'chinese-report' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const onGenerated = vi.fn().mockResolvedValue(undefined);

    render(
      <MarketGenerateReportModal
        open
        latestAvailableMonth="2026-10"
        existingReports={[{ period_type: 'monthly', period_key: '2026-10', language: 'en' }]}
        onClose={vi.fn()}
        onGenerated={onGenerated}
      />,
    );

    fireEvent.change(await screen.findByTestId('market-report-language'), { target: { value: 'zh' } });
    expect(screen.getByTestId('market-report-name')).toHaveProperty(
      'value',
      '北岸房地产市场报告 — 2026年第4季度',
    );
    fireEvent.click(screen.getByTestId('market-period-month'));
    expect(screen.getByTestId('market-report-name')).toHaveProperty(
      'value',
      '北岸房地产市场报告 — 2026年10月',
    );
    expect(screen.queryByText(/A report already exists/)).toBeNull();
    fireEvent.submit(screen.getByRole('dialog'));

    await waitFor(() => expect(onGenerated).toHaveBeenCalledWith('chinese-report', false));
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/market-reports', expect.objectContaining({
      body: expect.stringContaining('"language":"zh"'),
    }));
  });
});

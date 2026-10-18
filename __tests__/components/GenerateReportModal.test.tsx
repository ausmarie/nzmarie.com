import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import React from 'react';
import GenerateReportModal from '../../app/admin/reports/components/GenerateReportModal';

const mockSuburbs = [
  { id: 'sub-sunnynook', name: 'Sunnynook' },
  { id: 'sub-northcross', name: 'Northcross' },
  { id: 'sub-totara-vale', name: 'Totara Vale' },
];

function installFetchMock() {
  global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method || 'GET').toUpperCase();
    const json = (data: unknown) => ({ ok: true, status: 200, json: async () => data });

    if (url.includes('/api/admin/reports/suburbs')) {
      return json({ success: true, suburbs: mockSuburbs });
    }
    if (method === 'POST' && url.includes('/api/admin/reports/templates/generate')) {
      return json({ success: true, id: 'gen-doc-1' });
    }
    return json({ success: false });
  }) as unknown as typeof fetch;
}

function lastGenerateCall(): { url: string; body: Record<string, unknown> } | null {
  const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;
  for (let i = calls.length - 1; i >= 0; i--) {
    const [url, init] = calls[i];
    if (String(url).includes('/api/admin/reports/templates/generate') && ((init as RequestInit | undefined)?.method || 'GET').toUpperCase() === 'POST') {
      return { url: String(url), body: JSON.parse(String((init as RequestInit).body)) };
    }
  }
  return null;
}

describe('GenerateReportModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installFetchMock();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders nothing while closed', () => {
    render(<GenerateReportModal open={false} onClose={vi.fn()} onGenerated={vi.fn()} />);
    expect(screen.queryByTestId('generate-report-modal')).toBeNull();
  });

  it('prefills the suburb from the lead suburb once the suburb list loads', async () => {
    render(
      <GenerateReportModal
        open
        leadId="lead-1"
        defaultSuburbName="Sunnynook"
        defaultAddressName="2/65 Target Road"
        onClose={vi.fn()}
        onGenerated={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('gen-suburb-input')).toHaveProperty('value', 'Sunnynook');
    });
    await waitFor(() => {
      expect(screen.getByTestId('gen-generate-btn').hasAttribute('disabled')).toBe(false);
    });
  });

  it('starts in quarter mode with Report Quarter and swaps to year/month when Month is chosen', async () => {
    render(<GenerateReportModal open onClose={vi.fn()} onGenerated={vi.fn()} />);

    expect(screen.getByTestId('gen-start-quarter')).toBeTruthy();
    expect(screen.getByTestId('gen-end-quarter')).toBeTruthy();
    expect(screen.queryByTestId('gen-start-month')).toBeNull();
    expect(screen.queryByTestId('gen-end-month')).toBeNull();
    expect(screen.getByTestId('gen-report-quarter')).toBeTruthy();
    expect(screen.queryByTestId('gen-year')).toBeNull();
    expect(screen.queryByTestId('gen-month')).toBeNull();

    fireEvent.click(screen.getByTestId('gen-period-month'));

    expect(screen.getByTestId('gen-start-month')).toBeTruthy();
    expect(screen.getByTestId('gen-end-month')).toBeTruthy();
    expect(screen.queryByTestId('gen-start-quarter')).toBeNull();
    expect(screen.queryByTestId('gen-end-quarter')).toBeNull();
    expect(screen.getByTestId('gen-year')).toBeTruthy();
    expect(screen.getByTestId('gen-month')).toBeTruthy();
    expect(screen.queryByTestId('gen-report-quarter')).toBeNull();

    fireEvent.click(screen.getByTestId('gen-period-quarter'));
    expect(screen.getByTestId('gen-start-quarter')).toBeTruthy();
    expect(screen.queryByTestId('gen-start-month')).toBeNull();
    expect(screen.getByTestId('gen-report-quarter')).toBeTruthy();
    expect(screen.queryByTestId('gen-year')).toBeNull();
  });

  it('defaults Data Start Quarter to 2025-Q1 and Data Start Month to 2025-01', async () => {
    render(<GenerateReportModal open onClose={vi.fn()} onGenerated={vi.fn()} />);

    expect(screen.getByTestId('gen-start-quarter')).toHaveProperty('value', '2025-Q1');

    fireEvent.click(screen.getByTestId('gen-period-month'));
    expect(screen.getByTestId('gen-start-month')).toHaveProperty('value', '2025-01');
  });

  it('moves Data End Quarter together with Report Quarter', async () => {
    render(<GenerateReportModal open onClose={vi.fn()} onGenerated={vi.fn()} />);

    fireEvent.change(screen.getByTestId('gen-report-quarter'), { target: { value: '2026-Q3' } });
    expect(screen.getByTestId('gen-end-quarter')).toHaveProperty('value', '2026-Q3');

    fireEvent.change(screen.getByTestId('gen-report-quarter'), { target: { value: '2025-Q4' } });
    expect(screen.getByTestId('gen-end-quarter')).toHaveProperty('value', '2025-Q4');

    fireEvent.change(screen.getByTestId('gen-end-quarter'), { target: { value: '2026-Q2' } });
    expect(screen.getByTestId('gen-end-quarter')).toHaveProperty('value', '2026-Q2');
    fireEvent.change(screen.getByTestId('gen-report-quarter'), { target: { value: '2027-Q1' } });
    expect(screen.getByTestId('gen-end-quarter')).toHaveProperty('value', '2027-Q1');
  });

  it('moves Data End Month together with Report Year and Report Month', async () => {
    render(<GenerateReportModal open onClose={vi.fn()} onGenerated={vi.fn()} />);

    fireEvent.click(screen.getByTestId('gen-period-month'));
    fireEvent.change(screen.getByTestId('gen-year'), { target: { value: '2025' } });
    const now = new Date();
    expect(screen.getByTestId('gen-end-month')).toHaveProperty('value', `2025-${String(now.getMonth() + 1).padStart(2, '0')}`);

    fireEvent.change(screen.getByTestId('gen-month'), { target: { value: '3' } });
    expect(screen.getByTestId('gen-end-month')).toHaveProperty('value', '2025-03');

    fireEvent.change(screen.getByTestId('gen-end-month'), { target: { value: '2025-12' } });
    fireEvent.change(screen.getByTestId('gen-month'), { target: { value: '7' } });
    expect(screen.getByTestId('gen-end-month')).toHaveProperty('value', '2025-07');
  });

  it('renders Report Name before Suburb and Period before the report date fields', async () => {
    render(<GenerateReportModal open defaultAddressName="2/65 Target Road" onClose={vi.fn()} onGenerated={vi.fn()} />);

    const before = (a: HTMLElement, b: HTMLElement) =>
      (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

    expect(before(screen.getByTestId('gen-name-input'), screen.getByTestId('gen-suburb-input'))).toBe(true);
    expect(before(screen.getByTestId('gen-suburb-input'), screen.getByTestId('gen-period-quarter'))).toBe(true);
    expect(before(screen.getByTestId('gen-period-quarter'), screen.getByTestId('gen-report-quarter'))).toBe(true);
    expect(before(screen.getByTestId('gen-report-quarter'), screen.getByTestId('gen-start-quarter'))).toBe(true);

    fireEvent.click(screen.getByTestId('gen-period-month'));
    expect(before(screen.getByTestId('gen-period-month'), screen.getByTestId('gen-year'))).toBe(true);
    expect(before(screen.getByTestId('gen-year'), screen.getByTestId('gen-month'))).toBe(true);
    expect(before(screen.getByTestId('gen-month'), screen.getByTestId('gen-start-month'))).toBe(true);
  });

  it('defaults the report name to Q{quarter} {year} {address} and follows Report Quarter changes', async () => {
    render(<GenerateReportModal open defaultAddressName="2/65 Target Road" onClose={vi.fn()} onGenerated={vi.fn()} />);

    const now = new Date();
    const expected = `Q${Math.ceil((now.getMonth() + 1) / 3)} ${now.getFullYear()} 2/65 Target Road`;
    await waitFor(() => {
      expect(screen.getByTestId('gen-name-input')).toHaveProperty('value', expected);
    });

    fireEvent.change(screen.getByTestId('gen-report-quarter'), { target: { value: '2025-Q2' } });
    await waitFor(() => {
      expect(screen.getByTestId('gen-name-input')).toHaveProperty('value', 'Q2 2025 2/65 Target Road');
    });
  });

  it('defaults the report name to {MM} {year} {address} in month mode and follows Report Year/Month changes', async () => {
    render(<GenerateReportModal open defaultAddressName="2/65 Target Road" onClose={vi.fn()} onGenerated={vi.fn()} />);

    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    fireEvent.click(screen.getByTestId('gen-period-month'));

    await waitFor(() => {
      expect(screen.getByTestId('gen-name-input')).toHaveProperty('value', `${mm} ${now.getFullYear()} 2/65 Target Road`);
    });

    fireEvent.change(screen.getByTestId('gen-year'), { target: { value: '2025' } });
    await waitFor(() => {
      expect(screen.getByTestId('gen-name-input')).toHaveProperty('value', `${mm} 2025 2/65 Target Road`);
    });

    fireEvent.change(screen.getByTestId('gen-month'), { target: { value: '3' } });
    await waitFor(() => {
      expect(screen.getByTestId('gen-name-input')).toHaveProperty('value', `03 2025 2/65 Target Road`);
    });
  });

  it('keeps a manually edited report name when the period changes', async () => {
    render(<GenerateReportModal open defaultAddressName="2/65 Target Road" onClose={vi.fn()} onGenerated={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('gen-name-input')).toBeTruthy();
    });

    fireEvent.change(screen.getByTestId('gen-name-input'), { target: { value: 'My Custom Name' } });
    fireEvent.click(screen.getByTestId('gen-period-month'));
    fireEvent.click(screen.getByTestId('gen-period-quarter'));

    expect(screen.getByTestId('gen-name-input')).toHaveProperty('value', 'My Custom Name');
  });

  it('disables Generate when the report name is empty', async () => {
    render(
      <GenerateReportModal
        open
        defaultSuburbName="Sunnynook"
        defaultAddressName="2/65 Target Road"
        onClose={vi.fn()}
        onGenerated={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('gen-generate-btn').hasAttribute('disabled')).toBe(false);
    });

    fireEvent.change(screen.getByTestId('gen-name-input'), { target: { value: '   ' } });
    expect(screen.getByTestId('gen-generate-btn').hasAttribute('disabled')).toBe(true);
    fireEvent.click(screen.getByTestId('gen-generate-btn'));
    expect(lastGenerateCall()).toBeNull();
  });

  it('generates a monthly report with month bounds and the lead id', async () => {
    const onGenerated = vi.fn();
    render(
      <GenerateReportModal
        open
        leadId="lead-7"
        defaultSuburbName="Northcross"
        defaultAddressName="2/65 Target Road"
        onClose={vi.fn()}
        onGenerated={onGenerated}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('gen-suburb-input')).toHaveProperty('value', 'Northcross');
    });

    fireEvent.click(screen.getByTestId('gen-period-month'));
    fireEvent.change(screen.getByTestId('gen-start-month'), { target: { value: '2025-01' } });
    fireEvent.change(screen.getByTestId('gen-end-month'), { target: { value: '2025-12' } });
    await waitFor(() => {
      expect(screen.getByTestId('gen-generate-btn').hasAttribute('disabled')).toBe(false);
    });
    fireEvent.click(screen.getByTestId('gen-generate-btn'));

    await waitFor(() => {
      expect(onGenerated).toHaveBeenCalledWith('gen-doc-1', expect.objectContaining({
        suburbName: 'Northcross',
        periodType: 'month',
      }));
    });

    const call = lastGenerateCall();
    expect(call).toBeTruthy();
    expect(call!.body.suburb_id).toBe('sub-northcross');
    expect(call!.body.period_type).toBe('month');
    expect(call!.body.start_month).toBe('2025-01');
    expect(call!.body.end_month).toBe('2025-12');
    expect(call!.body.lead_id).toBe('lead-7');
    expect(call!.body.quarter).toMatch(/^\d{4}-Q[1-4]$/);
    expect(typeof call!.body.report_year).toBe('number');
    expect(typeof call!.body.report_month).toBe('number');
    const now = new Date();
    expect(call!.body.report_name).toBe(
      `${String(now.getMonth() + 1).padStart(2, '0')} ${now.getFullYear()} 2/65 Target Road`
    );
  });

  it('generates a quarterly report with quarter bounds picked from the list', async () => {
    const onGenerated = vi.fn();
    render(
      <GenerateReportModal
        open
        leadId="lead-3"
        defaultAddressName="2/65 Target Road"
        onClose={vi.fn()}
        onGenerated={onGenerated}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('gen-suburb-input')).toBeTruthy();
    });

    fireEvent.focus(screen.getByTestId('gen-suburb-input'));
    const options = await screen.findAllByTestId('gen-suburb-option');
    fireEvent.click(options.find((o) => o.textContent === 'Totara Vale')!);

    fireEvent.change(screen.getByTestId('gen-start-quarter'), { target: { value: '2025-Q1' } });
    fireEvent.change(screen.getByTestId('gen-end-quarter'), { target: { value: '2025-Q4' } });
    fireEvent.click(screen.getByTestId('gen-generate-btn'));

    const infoNow = new Date();
    await waitFor(() => {
      expect(onGenerated).toHaveBeenCalledWith('gen-doc-1', expect.objectContaining({
        suburbName: 'Totara Vale',
        periodType: 'quarter',
        quarter: `${infoNow.getFullYear()}-Q${Math.ceil((infoNow.getMonth() + 1) / 3)}`,
      }));
    });

    const call = lastGenerateCall();
    expect(call).toBeTruthy();
    expect(call!.body.suburb_id).toBe('sub-totara-vale');
    expect(call!.body.period_type).toBe('quarter');
    expect(call!.body.start_quarter).toBe('2025-Q1');
    expect(call!.body.end_quarter).toBe('2025-Q4');
    expect(call!.body.lead_id).toBe('lead-3');
    expect(call!.body).not.toHaveProperty('start_month');
    expect(call!.body).not.toHaveProperty('end_month');
    const now = new Date();
    expect(call!.body.quarter).toBe(`${now.getFullYear()}-Q${Math.ceil((now.getMonth() + 1) / 3)}`);
    expect(call!.body).not.toHaveProperty('report_year');
    expect(call!.body).not.toHaveProperty('report_month');
    expect(call!.body.report_name).toBe(
      `Q${Math.ceil((now.getMonth() + 1) / 3)} ${now.getFullYear()} 2/65 Target Road`
    );
  });

  it('disables Generate and explains the error when the month range is inverted', async () => {
    render(<GenerateReportModal open onClose={vi.fn()} onGenerated={vi.fn()} />);

    fireEvent.click(screen.getByTestId('gen-period-month'));
    fireEvent.change(screen.getByTestId('gen-start-month'), { target: { value: '2026-01' } });
    fireEvent.change(screen.getByTestId('gen-end-month'), { target: { value: '2025-01' } });

    expect(screen.getByTestId('gen-range-error')).toBeTruthy();
    expect(screen.getByTestId('gen-generate-btn').hasAttribute('disabled')).toBe(true);

    fireEvent.click(screen.getByTestId('gen-generate-btn'));
    expect(lastGenerateCall()).toBeNull();
  });

  it('disables Generate until a suburb is selected', async () => {
    render(<GenerateReportModal open onClose={vi.fn()} onGenerated={vi.fn()} />);

    expect(screen.getByTestId('gen-generate-btn').hasAttribute('disabled')).toBe(true);
  });

  it('closes through the Cancel button without generating', async () => {
    const onClose = vi.fn();
    render(<GenerateReportModal open onClose={onClose} onGenerated={vi.fn()} />);

    fireEvent.click(screen.getByTestId('gen-cancel-btn'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(lastGenerateCall()).toBeNull();
  });

  it('derives the report name from the selected suburb when no address is given', async () => {
    render(<GenerateReportModal open defaultSuburbName="Totara Vale" onClose={vi.fn()} onGenerated={vi.fn()} />);

    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    await waitFor(() => {
      expect(screen.getByTestId('gen-name-input')).toHaveProperty(
        'value',
        `Q${Math.ceil((now.getMonth() + 1) / 3)} ${now.getFullYear()} Totara Vale`
      );
    });

    fireEvent.click(screen.getByTestId('gen-period-month'));
    await waitFor(() => {
      expect(screen.getByTestId('gen-name-input')).toHaveProperty('value', `${mm} ${now.getFullYear()} Totara Vale`);
    });
  });

  it('updates the derived report name when a different suburb is chosen', async () => {
    render(<GenerateReportModal open onClose={vi.fn()} onGenerated={vi.fn()} />);

    fireEvent.focus(screen.getByTestId('gen-suburb-input'));
    const options = await screen.findAllByTestId('gen-suburb-option');
    fireEvent.click(options.find((o) => o.textContent === 'Northcross')!);

    const now = new Date();
    await waitFor(() => {
      expect(screen.getByTestId('gen-name-input')).toHaveProperty(
        'value',
        `Q${Math.ceil((now.getMonth() + 1) / 3)} ${now.getFullYear()} Northcross`
      );
    });
  });

  it('generates without a lead id and sends the suburb-derived name', async () => {
    const onGenerated = vi.fn();
    render(<GenerateReportModal open defaultSuburbName="Totara Vale" onClose={vi.fn()} onGenerated={onGenerated} />);

    await waitFor(() => {
      expect(screen.getByTestId('gen-generate-btn').hasAttribute('disabled')).toBe(false);
    });
    fireEvent.click(screen.getByTestId('gen-generate-btn'));

    await waitFor(() => {
      expect(onGenerated).toHaveBeenCalledTimes(1);
    });

    const call = lastGenerateCall();
    expect(call).toBeTruthy();
    expect(call!.body.suburb_id).toBe('sub-totara-vale');
    expect(call!.body.period_type).toBe('quarter');
    expect(call!.body).not.toHaveProperty('lead_id');
    const now = new Date();
    expect(call!.body.report_name).toBe(
      `Q${Math.ceil((now.getMonth() + 1) / 3)} ${now.getFullYear()} Totara Vale`
    );
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import SendReportModal from '../../../app/admin/outreach/components/SendReportModal';

const torbayDocs = [
  { id: 'rep-1', suburb: 'Torbay', quarter: 'Q2', year: 2026, doc_label: 'Main Report', file_url: 'u1', file_name: 'torbay-q2-main.pdf' },
  { id: 'rep-2', suburb: 'Torbay', quarter: 'Q2', year: 2026, doc_label: 'Letter', file_url: 'u2', file_name: 'torbay-q2-letter.pdf' },
  { id: 'rep-3', suburb: 'Torbay', quarter: 'Q2', year: 2026, doc_label: 'About Marie', file_url: 'u3', file_name: 'torbay-q2-about.pdf' },
];

const renderModal = (props: Partial<React.ComponentProps<typeof SendReportModal>> = {}) =>
  render(
    <SendReportModal
      isOpen
      onClose={() => {}}
      selectedIds={['p1']}
      suburb="Torbay"
      onSuccess={() => {}}
      {...props}
    />
  );

describe('SendReportModal', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    cleanup();
  });

  it('groups multiple documents for the same suburb/quarter/year into one report set', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ reports: torbayDocs }),
    });

    renderModal();

    const select = (await screen.findByRole('combobox')) as HTMLSelectElement;
    expect(select.options.length).toBe(1);
    expect(select.options[0].textContent).toBe('Torbay 2026 Q2 (3 documents)');
    expect(select.value).toBe('Torbay|2026|Q2');

    expect(
      ((await screen.findByDisplayValue('Torbay 2026 Q2 Market Report')) as HTMLInputElement).value
    ).toBe('Torbay 2026 Q2 Market Report');
    expect(
      ((await screen.findByDisplayValue('2026_Q2_Torbay')) as HTMLInputElement).value
    ).toBe('2026_Q2_Torbay');
  });

  it('lists multiple report sets for the same suburb separately', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        reports: [
          ...torbayDocs,
          { id: 'rep-4', suburb: 'Torbay', quarter: 'Q1', year: 2026, doc_label: 'Main Report', file_url: 'u4', file_name: 'torbay-q1-main.pdf' },
        ],
      }),
    });

    renderModal();

    const select = (await screen.findByRole('combobox')) as HTMLSelectElement;
    expect(select.options.length).toBe(2);
    const labels = Array.from(select.options).map((o) => o.textContent);
    expect(labels).toContain('Torbay 2026 Q2 (3 documents)');
    expect(labels).toContain('Torbay 2026 Q1');
  });

  it('sends the Main Report document id with campaign key when confirming dispatch', async () => {
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ reports: torbayDocs }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

    const onSuccess = vi.fn();
    const onClose = vi.fn();

    renderModal({ selectedIds: ['p1', 'p2'], onSuccess, onClose });

    await screen.findByRole('combobox');
    await screen.findByDisplayValue('2026_Q2_Torbay');

    const form = screen.getByRole('button', { name: /Confirm Dispatch Log/i }).closest('form');
    expect(form).not.toBeNull();
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });

    const sendCall = (global.fetch as any).mock.calls.find(
      (c: unknown[]) => c[0] === '/api/admin/outreach/send'
    );
    expect(sendCall).toBeDefined();
    const body = JSON.parse(sendCall[1].body);
    expect(body.property_ids).toEqual(['p1', 'p2']);
    expect(body.suburb_report_id).toBe('rep-1');
    expect(body.campaign_key).toBe('2026_Q2_Torbay');
    expect(body.report_title).toBe('Torbay 2026 Q2 Market Report');
    expect(onClose).toHaveBeenCalled();
  });
});

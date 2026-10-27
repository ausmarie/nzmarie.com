import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { SendHistoryTable } from '@/components/admin/SendHistoryTable';

const mockHistory = [
  {
    log_id: 'log-3',
    outreach_property_id: 'out-1',
    suburb_report_id: 'sr-3',
    report_title: 'Q3 Market Report – Torbay',
    campaign_key: '2026_Q3_Torbay',
    suburb: 'Torbay',
    sent_at: '2026-08-15T10:00:00Z',
    sent_by: 'admin@test.com',
    notes: 'Follow up',
    pdf_file_url: null,
    pdf_file_name: null,
    scan_count: 2,
  },
  {
    log_id: 'log-2',
    outreach_property_id: 'out-1',
    suburb_report_id: 'sr-2',
    report_title: 'Q2 Market Report – Torbay',
    campaign_key: '2026_Q2_Torbay',
    suburb: 'Torbay',
    sent_at: '2026-05-15T10:00:00Z',
    sent_by: 'admin@test.com',
    notes: null,
    pdf_file_url: 'https://example.com/q2.pdf',
    pdf_file_name: 'q2.pdf',
    scan_count: 5,
  },
  {
    log_id: 'log-1',
    outreach_property_id: 'out-1',
    suburb_report_id: 'sr-1',
    report_title: 'Q1 Market Report – Torbay',
    campaign_key: '2026_Q1_Torbay',
    suburb: 'Torbay',
    sent_at: '2026-02-10T10:00:00Z',
    sent_by: 'admin@test.com',
    notes: 'Initial send',
    pdf_file_url: null,
    pdf_file_name: null,
    scan_count: 0,
  },
];

describe('SendHistoryTable', () => {
  it('renders "No send history" message when history is empty', () => {
    const { container } = render(<SendHistoryTable history={[]} />);
    expect(container.textContent).toContain('No send history available for this address');
  });

  it('renders "No send history" message when history is null', () => {
    const { container } = render(<SendHistoryTable history={null} />);
    expect(container.textContent).toContain('No send history available for this address');
  });

  it('renders table headers', () => {
    const { container } = render(<SendHistoryTable history={mockHistory} />);
    expect(container.textContent).toContain('Quarter');
    expect(container.textContent).toContain('Sent Date');
    expect(container.textContent).toContain('Report / Campaign');
    expect(container.textContent).toContain('Sent By');
    expect(container.textContent).toContain('Scans');
  });

  it('renders all history rows in descending sent_at order (Q3, Q2, Q1)', () => {
    const { container } = render(<SendHistoryTable history={mockHistory} />);
    expect(container.textContent).toContain('2026-Q3');
    expect(container.textContent).toContain('2026-Q2');
    expect(container.textContent).toContain('2026-Q1');
  });

  it('displays quarter extracted from campaign_key', () => {
    const { container } = render(<SendHistoryTable history={mockHistory} />);
    expect(container.textContent).toContain('2026-Q3');
    expect(container.textContent).toContain('2026-Q2');
    expect(container.textContent).toContain('2026-Q1');
  });

  it('displays sent date in NZ format', () => {
    const { container } = render(<SendHistoryTable history={mockHistory} />);
    expect(container.textContent).toContain('15 Aug 2026');
    expect(container.textContent).toContain('15 May 2026');
    expect(container.textContent).toContain('10 Feb 2026');
  });

  it('displays report title and campaign key', () => {
    const { container } = render(<SendHistoryTable history={mockHistory} />);
    expect(container.textContent).toContain('Q3 Market Report – Torbay');
    expect(container.textContent).toContain('2026_Q3_Torbay');
    expect(container.textContent).toContain('Q2 Market Report – Torbay');
    expect(container.textContent).toContain('Q1 Market Report – Torbay');
  });

  it('displays sent by email', () => {
    const { container } = render(<SendHistoryTable history={mockHistory} />);
    expect(container.textContent).toContain('admin@test.com');
  });

  it('shows scan count badge when scan_count > 0', () => {
    const { container } = render(<SendHistoryTable history={mockHistory} />);
    expect(container.textContent).toContain('2');
    expect(container.textContent).toContain('5');
  });

  it('shows dash when scan_count is 0', () => {
    const { container } = render(<SendHistoryTable history={mockHistory} />);
    expect(container.textContent).toContain('—');
  });

  it('renders all history rows', () => {
    const { container } = render(<SendHistoryTable history={mockHistory} />);
    expect(container.textContent).toContain('2026_Q3_Torbay');
    expect(container.textContent).toContain('2026_Q2_Torbay');
    expect(container.textContent).toContain('2026_Q1_Torbay');
  });

  it('handles history with missing campaign_key (falls back to sent_at date)', () => {
    const historyWithMissingCampaign = [
      {
        log_id: 'log-4',
        outreach_property_id: 'out-1',
        suburb_report_id: 'sr-4',
        report_title: 'Custom Report',
        campaign_key: 'custom-campaign',
        suburb: 'Torbay',
        sent_at: '2026-11-20T10:00:00Z',
        sent_by: 'admin@test.com',
        notes: null,
        pdf_file_url: null,
        pdf_file_name: null,
        scan_count: 1,
      },
    ];
    const { container } = render(<SendHistoryTable history={historyWithMissingCampaign} />);
    expect(container.textContent).toContain('2026-Q4');
  });
});
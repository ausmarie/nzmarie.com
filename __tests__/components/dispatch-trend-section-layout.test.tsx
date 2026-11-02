import { describe, it, expect, afterEach, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import React from 'react';

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  BarChart: ({ children }: any) => <div>{children}</div>,
  Bar: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
  Legend: () => <div />,
}));

import DispatchTrendSection, { formatDispatchCount } from '@/components/admin/DispatchTrendSection';

const trend = {
  daily: [{ bucket: '2026-09-01', sent: 131, junk: 106 }],
  weekly: [],
  monthly: [],
  quarterly: [],
  yearly: [],
  seriesBySuburb: {
    daily: {},
    weekly: {},
    monthly: {},
    quarterly: {},
    yearly: {},
  },
  bySuburb: [
    {
      suburb: 'Torbay-M09-2026',
      quarter_key: '2026-09',
      report_url: '/reports/torbay',
      sent_count: 131,
      junk_count: 106,
      unsent_count: 200,
      total_count: 437,
      first_sent_at: '2026-09-01T00:00:00.000Z',
      last_sent_at: '2026-09-20T00:00:00.000Z',
    },
  ],
};

describe('SuburbDispatchTimeline layout', () => {
  afterEach(cleanup);

  it('orders columns with Sent, Unsent, Junk before dates and Report after Pending', () => {
    render(<DispatchTrendSection trend={trend} />);

    const table = screen.getByRole('table');
    const headers = within(table)
      .getAllByRole('columnheader')
      .map((cell) => cell.textContent?.trim());

    expect(headers).toEqual([
      'Suburb',
      'Sent',
      'Unsent',
      'Junk',
      'First Sent',
      'Last Sent',
      'Pending',
      'Report',
      'Progress',
    ]);
  });

  it('shows status counts with sent and unsent percentages based on audience and junk based on pending', () => {
    render(<DispatchTrendSection trend={trend} />);

    const row = screen.getByText('Torbay').closest('tr');
    expect(row).toBeTruthy();
    const cells = Array.from(row!.querySelectorAll('td')).map((cell) => cell.textContent?.trim());

    expect(cells[0]).toBe('Torbay');
    expect(cells[1]).toBe('131 (30%)');
    expect(cells[2]).toBe('200 (46%)');
    expect(cells[3]).toBe('106 (24%)');
    expect(cells[4]).toBeTruthy();
    expect(cells[5]).toBeTruthy();
    // Pending = sent + unsent + junk = 437.
    expect(cells[6]).toBe('437');
    expect(Number(cells[6])).toBe(
      Number(cells[1].split(' ')[0]) +
        Number(cells[2].split(' ')[0]) +
        Number(cells[3].split(' ')[0])
    );
    expect(cells[7]).toBe('View Report');
    expect(cells[8]).toBe('131/437');
  });

  it('calculates junk percentage from Pending while keeping sent and unsent percentages based on total', () => {
    const trendWithDifferentAudienceTotal = {
      ...trend,
      bySuburb: [{
        ...trend.bySuburb[0],
        sent_count: 40,
        unsent_count: 20,
        junk_count: 10,
        total_count: 100,
      }],
    };
    render(<DispatchTrendSection trend={trendWithDifferentAudienceTotal} />);

    const row = screen.getByText('Torbay').closest('tr');
    const cells = Array.from(row!.querySelectorAll('td')).map((cell) => cell.textContent?.trim());
    expect(cells[1]).toBe('40 (40%)');
    expect(cells[2]).toBe('20 (20%)');
    expect(cells[3]).toBe('10 (14%)');
    expect(cells[6]).toBe('70');
  });
});

describe('formatDispatchCount', () => {
  it('rounds the percentage of the full audience', () => {
    expect(formatDispatchCount(131, 437)).toBe('131 (30%)');
    expect(formatDispatchCount(1, 3)).toBe('1 (33%)');
  });

  it('returns zero percent when pending is zero', () => {
    expect(formatDispatchCount(0, 0)).toBe('0 (0%)');
  });
});

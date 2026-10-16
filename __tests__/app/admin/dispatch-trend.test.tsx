import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import DispatchTrendSection, { DispatchTrend } from '@/components/admin/DispatchTrendSection';

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  BarChart: ({ children }: any) => <div>{children}</div>,
  Bar: () => <div>Bar</div>,
  XAxis: () => <div>XAxis</div>,
  YAxis: () => <div>YAxis</div>,
  CartesianGrid: () => <div>CartesianGrid</div>,
  Tooltip: () => <div>Tooltip</div>,
  Legend: () => <div>Legend</div>,
}));

const mockTrend: DispatchTrend = {
  daily: [
    { bucket: '2026-07-02', sent: 4, junk: 1 },
    { bucket: '2026-07-03', sent: 6, junk: 1 },
    { bucket: '2026-07-05', sent: 2, junk: 0 },
  ],
  weekly: [{ bucket: '2026-07-06', sent: 12, junk: 2 }],
  monthly: [
    { bucket: '2026-07-01', sent: 10, junk: 2 },
    { bucket: '2026-08-01', sent: 5, junk: 1 },
  ],
  quarterly: [{ bucket: '2026-07-01', sent: 15, junk: 3 }],
  seriesBySuburb: {
    daily: {
      Torbay: [
        { bucket: '2026-07-02', sent: 4, junk: 1 },
        { bucket: '2026-07-03', sent: 6, junk: 1 },
      ],
      Albany: [{ bucket: '2026-07-05', sent: 2, junk: 0 }],
    },
    weekly: {
      Torbay: [{ bucket: '2026-07-06', sent: 10, junk: 2 }],
      Albany: [{ bucket: '2026-07-06', sent: 2, junk: 0 }],
    },
    monthly: {
      Torbay: [
        { bucket: '2026-07-01', sent: 10, junk: 2 },
        { bucket: '2026-08-01', sent: 5, junk: 1 },
      ],
      Albany: [{ bucket: '2026-07-01', sent: 0, junk: 1 }],
    },
    quarterly: {
      Torbay: [{ bucket: '2026-07-01', sent: 15, junk: 3 }],
      Albany: [],
    },
  },
  bySuburb: [
    {
      suburb: 'Torbay',
      sent_count: 15,
      junk_count: 3,
      unsent_count: 2,
      total_count: 20,
      first_sent_at: '2026-07-02T01:00:00.000Z',
      last_sent_at: '2026-08-10T01:00:00.000Z',
    },
    {
      suburb: 'Albany',
      sent_count: 0,
      junk_count: 1,
      unsent_count: 0,
      total_count: 1,
      first_sent_at: null,
      last_sent_at: null,
    },
  ],
};

describe('DispatchTrendSection', () => {
  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  it('renders both chart titles and the timeline table', () => {
    render(<DispatchTrendSection trend={mockTrend} />);

    expect(screen.getByText('Dispatch Volume')).toBeTruthy();
    expect(screen.getByText('Suburb Dispatch Timeline')).toBeTruthy();
    expect(screen.getByText('Torbay')).toBeTruthy();
    expect(screen.getByText('Albany')).toBeTruthy();
  });

  it('shows overall totals for all suburbs', () => {
    render(<DispatchTrendSection trend={mockTrend} />);

    expect(screen.getByText('Sent: 12')).toBeTruthy();
    expect(screen.getByText('Junk: 2')).toBeTruthy();
    expect(screen.getByText('2 reports')).toBeTruthy();
  });

  it('switches granularity and recomputes totals', () => {
    render(<DispatchTrendSection trend={mockTrend} />);

    expect(screen.getByText('Sent: 12')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Quarterly' }));

    expect(screen.getByText('Sent: 15')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Daily' }));

    expect(screen.getByText('Sent: 12')).toBeTruthy();
    expect(screen.getByText('Junk: 2')).toBeTruthy();
  });

  it('filters the volume chart when a suburb row is clicked', () => {
    render(<DispatchTrendSection trend={mockTrend} />);

    fireEvent.click(screen.getByText('Torbay'));

    expect(screen.getByText('Sent: 10')).toBeTruthy();
    expect(screen.getByText('Junk: 2')).toBeTruthy();

    const clearButton = screen.getByText('Torbay ×');
    expect(clearButton).toBeTruthy();
  });

  it('shows the suburb daily series when a suburb row is clicked on daily granularity', () => {
    render(<DispatchTrendSection trend={mockTrend} />);

    fireEvent.click(screen.getByRole('button', { name: 'Daily' }));

    expect(screen.getByText('Sent: 12')).toBeTruthy();

    fireEvent.click(screen.getByText('Torbay'));

    expect(screen.getByText('Sent: 10')).toBeTruthy();
    expect(screen.queryByText('No dispatch data.')).toBeNull();
  });

  it('clear suburb button resets the filter to all suburbs', () => {
    render(<DispatchTrendSection trend={mockTrend} />);

    fireEvent.click(screen.getByText('Torbay'));
    fireEvent.click(screen.getByText('Torbay ×'));

    expect(screen.getByText('All reports')).toBeTruthy();
  });

  it('shows progress bar with sent/junk split and counts', () => {
    render(<DispatchTrendSection trend={mockTrend} />);

    expect(screen.getByText('15/20')).toBeTruthy();
    expect(screen.getByText('0/1')).toBeTruthy();
  });

  it('shows unsent segment in red on the progress bar', () => {
    render(<DispatchTrendSection trend={mockTrend} />);

    const unsent = document.querySelector('[title="Unsent 2"]');
    expect(unsent).toBeTruthy();
    expect(unsent?.className).toContain('bg-red-500');
  });

  it('shows Pending, Sent, and Unsent columns with correct values', () => {
    render(<DispatchTrendSection trend={mockTrend} />);

    expect(screen.getByText('Pending')).toBeTruthy();
    expect(screen.getByText('Unsent')).toBeTruthy();
    expect(screen.getByText('20')).toBeTruthy();
    expect(screen.getByText('15')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getAllByText('0')).toHaveLength(2);
  });

  it('shows Junk column header with count and percentage', () => {
    render(<DispatchTrendSection trend={mockTrend} />);

    expect(screen.getByText('Junk', { selector: 'th' })).toBeTruthy();
  });

  it('shows unsent count in red and junk segment in yellow', () => {
    render(<DispatchTrendSection trend={mockTrend} />);

    const unsentCell = screen.getByText('2');
    expect(unsentCell.className).toContain('text-red-600');

    const junk = document.querySelector('[title="Junk 3"]');
    expect(junk).toBeTruthy();
    expect(junk?.className).toContain('bg-yellow-400');

    const sent = document.querySelector('[title="Sent 15"]');
    expect(sent).toBeTruthy();
    expect(sent?.className).toContain('bg-purple-500');
  });

  it('shows em dash for suburbs with no send activity', () => {
    render(<DispatchTrendSection trend={mockTrend} />);

    const firstSentCells = screen.getAllByText('—');
    expect(firstSentCells.length).toBeGreaterThan(0);
  });

  it('displays suburb names in title case', () => {
    const trend: DispatchTrend = {
      ...mockTrend,
      bySuburb: [
        {
          suburb: 'NORTH CROSS',
          sent_count: 5,
          junk_count: 1,
          unsent_count: 2,
          total_count: 8,
          first_sent_at: null,
          last_sent_at: null,
        },
      ],
    };

    render(<DispatchTrendSection trend={trend} />);

    expect(screen.getByText('North Cross')).toBeTruthy();
    expect(screen.queryByText('NORTH CROSS')).toBeNull();
  });

  it('orders columns as Suburb, Report, Sent, Unsent, Pending', () => {
    render(<DispatchTrendSection trend={mockTrend} />);

    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers).toEqual(['Suburb', 'Report', 'First Sent', 'Last Sent', 'Sent', 'Junk', 'Unsent', 'Pending', 'Progress']);
  });

  it('sorts the timeline with the most recently sent suburb first', () => {
    const trend: DispatchTrend = {
      ...mockTrend,
      bySuburb: [
        {
          suburb: 'Albany-Q2-2026',
          sent_count: 3,
          junk_count: 1,
          unsent_count: 0,
          total_count: 4,
          first_sent_at: null,
          last_sent_at: null,
        },
        {
          suburb: 'Browns Bay-Q2-2026',
          sent_count: 5,
          junk_count: 0,
          unsent_count: 0,
          total_count: 5,
          first_sent_at: '2026-07-01T00:00:00.000Z',
          last_sent_at: '2026-07-20T00:00:00.000Z',
        },
        {
          suburb: 'Torbay-Q2-2026',
          sent_count: 15,
          junk_count: 3,
          unsent_count: 2,
          total_count: 20,
          first_sent_at: '2026-07-02T01:00:00.000Z',
          last_sent_at: '2026-08-10T01:00:00.000Z',
        },
      ],
    };

    render(<DispatchTrendSection trend={trend} />);

    const rows = screen.getAllByRole('row');
    expect(rows[1].textContent).toContain('2026-Q2');
    expect(rows[2].textContent).toContain('Torbay');
    expect(rows[3].textContent).toContain('Browns Bay');
    expect(rows[4].textContent).toContain('Albany');
  });

  it('merges multiple entries of the same report without duplicating rows', () => {
    const trend: DispatchTrend = {
      ...mockTrend,
      bySuburb: [
        {
          suburb: 'Torbay-Q2-2026',
          sent_count: 358,
          junk_count: 0,
          unsent_count: 0,
          total_count: 358,
          first_sent_at: '2026-08-06T00:00:00.000Z',
          last_sent_at: '2026-08-27T00:00:00.000Z',
        },
        {
          suburb: 'Torbay-Q2-2026',
          sent_count: 0,
          junk_count: 115,
          unsent_count: 0,
          total_count: 115,
          first_sent_at: null,
          last_sent_at: null,
        },
      ],
    };

    render(<DispatchTrendSection trend={trend} />);

    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(3);
    expect(rows[2].textContent).toContain('Torbay');
    expect(rows[2].textContent).not.toContain('Torbay-Q2-2026');
    expect(rows[2].textContent).toContain('358');
    expect(rows[2].textContent).toContain('115(24%)');
  });

  it('groups suburbs under quarter headers with plain suburb names', () => {
    const trend: DispatchTrend = {
      ...mockTrend,
      bySuburb: [
        {
          suburb: 'Oteha-Q3-2026',
          quarter_key: '2026-Q3',
          sent_count: 5,
          junk_count: 0,
          unsent_count: 5,
          total_count: 10,
          first_sent_at: '2026-10-01T00:00:00.000Z',
          last_sent_at: '2026-10-11T00:00:00.000Z',
        },
        {
          suburb: 'Torbay-Q2-2026',
          quarter_key: '2026-Q2',
          sent_count: 358,
          junk_count: 115,
          unsent_count: 0,
          total_count: 473,
          first_sent_at: '2026-08-06T00:00:00.000Z',
          last_sent_at: '2026-08-27T00:00:00.000Z',
        },
        {
          suburb: 'Oteha-Q2-2026',
          quarter_key: '2026-Q2',
          sent_count: 209,
          junk_count: 0,
          unsent_count: 67,
          total_count: 276,
          first_sent_at: '2026-07-01T00:00:00.000Z',
          last_sent_at: '2026-10-01T00:00:00.000Z',
        },
      ],
    };

    render(<DispatchTrendSection trend={trend} />);

    const rows = screen.getAllByRole('row');
    expect(rows[1].textContent).toContain('2026-Q3');
    expect(rows[3].textContent).toContain('2026-Q2');

    expect(screen.getAllByText('Oteha')).toHaveLength(2);
    expect(screen.queryByText('Oteha-Q3-2026')).toBeNull();
    expect(screen.queryByText('Oteha-Q2-2026')).toBeNull();
    expect(screen.getByText('Torbay')).toBeTruthy();

    expect(rows[2].textContent).toContain('Oteha');
    expect(rows[4].textContent).toContain('Oteha');
    expect(rows[5].textContent).toContain('Torbay');
  });

  it('renders report links for each quarter report', () => {
    const trend: DispatchTrend = {
      ...mockTrend,
      bySuburb: [
        {
          suburb: 'Oteha-Q3-2026',
          quarter_key: '2026-Q3',
          report_url: 'https://example.com/oteha-q3.pdf',
          sent_count: 5,
          junk_count: 0,
          unsent_count: 5,
          total_count: 10,
          first_sent_at: '2026-10-01T00:00:00.000Z',
          last_sent_at: '2026-10-11T00:00:00.000Z',
        },
        {
          suburb: 'Oteha-Q2-2026',
          quarter_key: '2026-Q2',
          report_url: 'https://example.com/oteha-q2.pdf',
          sent_count: 209,
          junk_count: 0,
          unsent_count: 67,
          total_count: 276,
          first_sent_at: '2026-07-01T00:00:00.000Z',
          last_sent_at: '2026-10-01T00:00:00.000Z',
        },
        {
          suburb: 'Torbay-Q2-2026',
          quarter_key: '2026-Q2',
          sent_count: 358,
          junk_count: 0,
          unsent_count: 0,
          total_count: 358,
          first_sent_at: '2026-08-06T00:00:00.000Z',
          last_sent_at: '2026-08-27T00:00:00.000Z',
        },
      ],
    };

    render(<DispatchTrendSection trend={trend} />);

    const links = screen.getAllByText('View Report');
    expect(links).toHaveLength(2);
    expect(links[0].getAttribute('href')).toBe('https://example.com/oteha-q3.pdf');
    expect(links[0].getAttribute('target')).toBe('_blank');
    expect(links[0].getAttribute('rel')).toBe('noopener noreferrer');
    expect(links[1].getAttribute('href')).toBe('https://example.com/oteha-q2.pdf');

    fireEvent.click(links[0]);
    expect(screen.queryByText(/×/)).toBeNull();
    expect(screen.getByText('All reports')).toBeTruthy();

    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });
});
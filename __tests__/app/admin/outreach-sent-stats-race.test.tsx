import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { ReportFilterSection } from '@/app/admin/outreach/OutreachPageClient';

type Stats = Record<string, { total: number; sent: number; unsent: number }>;

const q2Stats: Stats = {
  Oteha: { total: 45, sent: 45, unsent: 0 },
  Torbay: { total: 30, sent: 30, unsent: 0 },
  'Browns Bay': { total: 20, sent: 5, unsent: 15 },
};
const q3Stats: Stats = {
  Oteha: { total: 45, sent: 0, unsent: 45 },
  Torbay: { total: 30, sent: 0, unsent: 30 },
  'Browns Bay': { total: 20, sent: 0, unsent: 20 },
};

const reports = [
  { suburb: 'Oteha', quarter: 'Q2', year: 2026, id: '1', uploaded_at: '2026-01-15' },
  { suburb: 'Oteha', quarter: 'Q3', year: 2026, id: '2', uploaded_at: '2026-04-15' },
  { suburb: 'Torbay', quarter: 'Q2', year: 2026, id: '3', uploaded_at: '2026-01-14' },
  { suburb: 'Browns Bay', quarter: 'Q2', year: 2026, id: '4', uploaded_at: '2026-01-10' },
];

const flush = () => new Promise((r) => setTimeout(r, 0));

function makeProps(activeQuarter: string) {
  return {
    availableReports: reports,
    setAvailableReports: vi.fn(),
    reportSuburbFilter: '',
    setReportSuburbFilter: vi.fn(),
    activeQuarter,
    setActiveQuarter: vi.fn(),
    sentStatusFilter: 'all' as const,
    setSentStatusFilter: vi.fn(),
    setSuburbFilter: vi.fn(),
    setLastSoldPreset: vi.fn(),
    onClearRunFilter: vi.fn(),
  };
}

describe('ReportFilterSection ignores stale sent-stats response', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('does not let an out-of-order previous-quarter response unhide sent suburbs', async () => {
    const pending = new Map<string, (v: unknown) => void>();

    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/admin/outreach/suburb-sent-stats')) {
        const q = url.includes('2026-Q2') ? 'Q2' : 'Q3';
        return new Promise((resolve) => {
          pending.set(q, (value) => resolve({ ok: true, json: async () => value }));
        });
      }
      if (url.includes('/api/admin/outreach/default-report')) {
        return Promise.resolve({ ok: true, json: async () => ({ defaultReport: null }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    }));

    const propsQ2 = makeProps('2026-Q2');
    const { rerender } = render(React.createElement(ReportFilterSection, propsQ2));

    // Mount fetch for Q2; resolve it so stats are populated.
    await flush();
    pending.get('Q2')?.({ stats: q2Stats });
    await flush();

    // Switch to Q3: this fires a new sent-stats request. Leave it pending.
    rerender(React.createElement(ReportFilterSection, { ...propsQ2, activeQuarter: '2026-Q3' }));
    await flush();
    expect(pending.has('Q3')).toBe(true);

    // Switch back to Q2: fire a fresh request and resolve it first.
    rerender(React.createElement(ReportFilterSection, { ...propsQ2, activeQuarter: '2026-Q2' }));
    await flush();
    pending.get('Q2')?.({ stats: q2Stats });
    await flush();

    // The STALE Q3 response now arrives late with all-unsent data.
    pending.get('Q3')?.({ stats: q3Stats });
    await flush();

    // Stale data must NOT win: Oteha & Torbay are fully sent in Q2 -> hidden,
    // and the "More" control appears to reveal them.
    await waitFor(() => {
      expect(screen.getByText('More (2)')).toBeTruthy();
    });
    expect(screen.queryByText('Oteha')).toBeNull();
    expect(screen.queryByText('Torbay')).toBeNull();
    expect(screen.getByText('Browns Bay')).toBeTruthy();
  });
});

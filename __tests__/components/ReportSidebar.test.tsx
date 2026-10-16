import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import ReportSidebar from '../../app/admin/reports/components/ReportSidebar';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

const mockStore = {
  selectedDocId: null,
  setSelectedDocId: vi.fn(),
  setSidebarCollapsed: vi.fn(),
  bumpRefreshKey: vi.fn(),
  slugMap: { 'about-marie': 'am-1' },
  overviewSuburbs: [
    {
      id: 's0',
      name: 'North Shore',
      introDoc: { id: 'd0', title: 'North Shore Introduction', status: 'published' },
      letterDoc: null,
      reports: [
        { id: 'd0r1', title: 'North Shore 2026 Q2 Market Report', quarter: '2026-Q2', status: 'published', createdAt: '2026-07-01' },
      ],
    },
    {
      id: 's1',
      name: 'Torbay',
      introDoc: { id: 'd1', title: 'Torbay Introduction', status: 'published' },
      letterDoc: { id: 'd2', title: 'Torbay Letter', status: 'published' },
      reports: [
        { id: 'd3', title: 'Q2 2026 Report', quarter: '2026-Q2', status: 'published', createdAt: '2026-07-01' },
      ],
    },
    {
      id: 's2',
      name: 'Browns Bay',
      introDoc: { id: 'd4', title: 'Browns Bay Introduction', status: 'published' },
      letterDoc: null,
      reports: [],
    },
    {
      id: 's3',
      name: 'Takapuna',
      introDoc: { id: 'd5', title: 'Takapuna Introduction', status: 'draft' },
      letterDoc: { id: 'd6', title: 'Takapuna Letter', status: 'draft' },
      reports: [
        { id: 'd7', title: 'Takapuna 2026-Q2 Report', quarter: '2026-Q2', status: 'draft', createdAt: '2026-07-01' },
      ],
    },
    {
      id: 's4',
      name: 'Bayswater',
      introDoc: { id: 'd8', title: 'Bayswater Introduction', status: 'draft' },
      letterDoc: null,
      reports: [],
    },
  ],
};

vi.mock('../../app/admin/reports/stores/report-store', () => ({
  useReportStore: (selector: (s: typeof mockStore) => unknown) => selector(mockStore),
}));

vi.mock('next/image', () => ({
  default: ({ src, alt, ...rest }: { src: string; alt: string; [key: string]: unknown }) => {
    const { width: _w, height: _h, unoptimized: _u, ...safeProps } = rest;
    return React.createElement('img', { src, alt, ...safeProps });
  },
}));

function getSuburbNameElement(name: string): HTMLElement | null {
  const id = 'sidebar-' + name.replace(/\s+/g, '-');
  const sidebarDiv = document.getElementById(id);
  if (!sidebarDiv) return null;
  return sidebarDiv.querySelector('div[cursor]') || sidebarDiv.firstElementChild as HTMLElement;
}

function clickSuburbName(name: string) {
  const el = getSuburbNameElement(name);
  if (el) fireEvent.click(el);
}

describe('ReportSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders suburb names in the list', () => {
    render(<ReportSidebar />);
    expect(document.getElementById('sidebar-North-Shore')).toBeDefined();
    expect(document.getElementById('sidebar-Torbay')).toBeDefined();
    expect(document.getElementById('sidebar-Browns-Bay')).toBeDefined();
    expect(document.getElementById('sidebar-Takapuna')).toBeDefined();
    expect(document.getElementById('sidebar-Bayswater')).toBeDefined();
  });

  it('shows intro, letter and quarterly report docs for newly added suburbs', () => {
    render(<ReportSidebar />);
    clickSuburbName('Takapuna');
    expect(screen.getByText('Takapuna Introduction')).toBeDefined();
    expect(screen.getByText('Takapuna Letter')).toBeDefined();
    expect(screen.getByText('Takapuna 2026-Q2 Report')).toBeDefined();
    clickSuburbName('Bayswater');
    expect(screen.getByText('Bayswater Introduction')).toBeDefined();
  });

  it('lists North Shore before other suburbs', () => {
    render(<ReportSidebar />);
    const parent = document.getElementById('sidebar-North-Shore')?.parentElement;
    const children = parent?.querySelectorAll('div[id^="sidebar-"]') || [];
    const names = Array.from(children).map(el => el.id);
    const nscIdx = names.indexOf('sidebar-North-Shore');
    const torbayIdx = names.indexOf('sidebar-Torbay');
    expect(nscIdx).toBeLessThan(torbayIdx);
  });

  it('hides all subsection documents by default', () => {
    render(<ReportSidebar />);
    expect(screen.queryByText('North Shore Introduction')).toBeNull();
    expect(screen.queryByText('North Shore 2026 Q2 Market Report')).toBeNull();
    expect(screen.queryByText('Torbay Introduction')).toBeNull();
    expect(screen.queryByText('Torbay Letter')).toBeNull();
    expect(screen.queryByText('Q2 2026 Report')).toBeNull();
    expect(screen.queryByText('Browns Bay Introduction')).toBeNull();
  });

  it('toggles documents visibility when suburb name is clicked', () => {
    render(<ReportSidebar />);

    clickSuburbName('North Shore');
    expect(screen.getByText('North Shore Introduction')).toBeDefined();
    expect(screen.getByText('North Shore 2026 Q2 Market Report')).toBeDefined();

    clickSuburbName('North Shore');
    expect(screen.queryByText('North Shore Introduction')).toBeNull();
    expect(screen.queryByText('North Shore 2026 Q2 Market Report')).toBeNull();
  });

  it('shows chevron indicator next to each suburb', () => {
    render(<ReportSidebar />);
    const nscDiv = document.getElementById('sidebar-North-Shore');
    expect(nscDiv).toBeDefined();
    const chevron = nscDiv!.querySelector('span');
    expect(chevron?.textContent).toBe('▶');
  });

  it('expands multiple suburbs independently including North Shore', () => {
    render(<ReportSidebar />);

    clickSuburbName('North Shore');
    expect(screen.getByText('North Shore Introduction')).toBeDefined();
    expect(screen.queryByText('Torbay Introduction')).toBeNull();
    expect(screen.queryByText('Browns Bay Introduction')).toBeNull();

    clickSuburbName('Torbay');
    expect(screen.getByText('North Shore Introduction')).toBeDefined();
    expect(screen.getByText('Torbay Introduction')).toBeDefined();
    expect(screen.getByText('Torbay Letter')).toBeDefined();
    expect(screen.queryByText('Browns Bay Introduction')).toBeNull();

    clickSuburbName('North Shore');
    expect(screen.queryByText('North Shore Introduction')).toBeNull();
    expect(screen.getByText('Torbay Introduction')).toBeDefined();
    expect(screen.getByText('Torbay Letter')).toBeDefined();

    clickSuburbName('Browns Bay');
    expect(screen.getByText('Browns Bay Introduction')).toBeDefined();
    expect(screen.getByText('Torbay Introduction')).toBeDefined();
  });

  it('renders "About Marie" link', () => {
    render(<ReportSidebar />);
    expect(screen.getByText('About Marie')).toBeDefined();
  });

  it('Suburbs section is collapsed by default, expands on click', () => {
    render(<ReportSidebar />);
    expect(screen.getByText('Suburbs')).toBeDefined();
    expect(screen.queryByPlaceholderText('Search suburbs...')).toBeNull();

    fireEvent.click(screen.getByText('Suburbs'));
    expect(screen.getByPlaceholderText('Search suburbs...')).toBeDefined();
  });
});

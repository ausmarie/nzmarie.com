import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock('@/components/market/MarketReportEditor', () => ({
  default: ({ onContentChange }: { onContentChange: () => void }) => (
    <button type="button" onClick={onContentChange}>Change report content</button>
  ),
}));

vi.mock('@/components/market/MarketGenerateReportModal', () => ({
  default: () => null,
}));

vi.mock('@/lib/market-report-document', () => ({
  ensureMarketReportTitleIcon: (content: unknown) => content,
  refreshMarketReportGeneratedBlocks: (content: unknown) => content,
}));

vi.mock('@/lib/market-report-footer', () => ({
  getDefaultMarketReportFooter: () => 'Default footer',
}));

import MarketAdminPage from '@/components/market/MarketAdminPage';

const reportSummary = {
  id: 'october-report',
  period_type: 'monthly',
  period_key: '2026-10',
  language: 'en',
  title: 'October 2026',
  summary: 'Existing introduction',
  status: 'draft',
  has_unpublished_changes: false,
  published_at: null,
  withdrawn_at: null,
  updated_at: '2026-10-01T00:00:00.000Z',
};

const report = {
  ...reportSummary,
  content: [{ type: 'paragraph' }],
  data_snapshot: {
    source: 'REINZ',
    propertyType: 'Residential',
    generatedAt: '2026-10-01T00:00:00.000Z',
  },
  footer: 'Existing footer',
};

function configureFetch(reports = [reportSummary]) {
  const savedBodies: Record<string, unknown>[] = [];
  const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
    if (input === '/api/admin/analytics/page-views') {
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: {
            home: { total: 100, week: 10, month: 25, year: 100 },
            market: { total: 50, week: 5, month: 12, year: 50 },
            blog: { total: 0, week: 0, month: 0, year: 0 },
            reports: reports.map((item) => ({
              id: item.id,
              period_type: item.period_type,
              period_key: item.period_key,
              language: item.language,
              status: item.status,
              views: { total: 31, week: 4, month: 9, year: 31 },
            })),
            blog_posts: [],
          },
        }),
      };
    }
    if (input === '/api/admin/market-reports') {
      return {
        ok: true,
        json: async () => ({
          success: true,
          reports,
          latestAvailableMonth: '2026-10',
        }),
      };
    }
    if (input === `/api/admin/market-reports/${report.id}` && !init?.method) {
      return { ok: true, json: async () => ({ success: true, report }) };
    }
    if (input === `/api/admin/market-reports/${report.id}` && init?.method === 'PUT') {
      savedBodies.push(JSON.parse(String(init.body)) as Record<string, unknown>);
      return { ok: true, json: async () => ({ success: true }) };
    }
    throw new Error(`Unexpected fetch: ${input}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, savedBodies };
}

describe('MarketAdminPage report editing', () => {
  beforeEach(() => {
    mocks.push.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('updates the address to the selected report draft URL', async () => {
    configureFetch();
    render(<MarketAdminPage />);

    const sidebar = screen.getByRole('complementary');
    const reportLabel = await within(sidebar).findByText('October 2026');
    expect(within(sidebar).getByText('En')).toBeTruthy();
    const reportButton = reportLabel.closest('button');
    if (!reportButton) throw new Error('October report button was not rendered.');
    fireEvent.click(reportButton);

    expect(mocks.push).toHaveBeenCalledWith('/admin/market/draft/October-2026');
  });

  it('shows previous reports with links on the Market home', async () => {
    configureFetch([{ ...reportSummary, status: 'published' }]);
    render(<MarketAdminPage />);

    const reportList = await screen.findByRole('region', { name: 'Previous reports' });
    expect(within(reportList).getByText('Existing introduction')).toBeTruthy();
    expect(within(reportList).getByRole('link', { name: 'Open October 2026 English report' }).getAttribute('href'))
      .toBe('/admin/market/draft/October-2026');
    expect(within(reportList).getByRole('link', { name: 'View published October 2026 English report' }).getAttribute('href'))
      .toBe('/admin/market/public/October-2026');
  });

  it('shows language badges and uses a distinct draft URL for Chinese reports', async () => {
    configureFetch([
      reportSummary,
      { ...reportSummary, id: 'october-report-zh', language: 'zh' },
    ]);
    render(<MarketAdminPage />);

    const sidebar = screen.getByRole('complementary');
    const chineseBadge = await within(sidebar).findByText('中');
    expect(within(sidebar).getByText('En')).toBeTruthy();
    const chineseReportButton = chineseBadge.closest('button');
    if (!chineseReportButton) throw new Error('Chinese report button was not rendered.');
    fireEvent.click(chineseReportButton);

    expect(mocks.push).toHaveBeenCalledWith('/admin/market/draft/October-2026?lang=zh');
  });

  it('automatically saves report content while preserving the existing summary', async () => {
    const { savedBodies } = configureFetch();
    render(<MarketAdminPage initialSlug="October-2026" />);

    fireEvent.click(await screen.findByRole('button', { name: 'Change report content' }));

    await waitFor(() => expect(savedBodies).toHaveLength(1), { timeout: 3000 });
    expect(savedBodies[0].summary).toBe('Existing introduction');
    expect(screen.queryByRole('button', { name: 'Save draft' })).toBeNull();
  });

  it('shows selected report views for all requested time ranges', async () => {
    configureFetch();
    render(<MarketAdminPage initialSlug="October-2026" />);

    expect(await screen.findByRole('region', { name: 'Report views' })).toBeTruthy();
    expect(await screen.findByText('Total: 31')).toBeTruthy();
    expect(screen.getByText('This week')).toBeTruthy();
    expect(screen.getByText('This month')).toBeTruthy();
    expect(screen.getByText('This year')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Report views' }).textContent).toContain('English');
  });

  it('saves footer edits with Ctrl+S while keeping Title out of the editor and Edit dialog', async () => {
    const { savedBodies } = configureFetch();
    render(<MarketAdminPage initialSlug="October-2026" />);

    const edit = await screen.findByRole('button', { name: 'Edit' });
    const publish = screen.getByRole('button', { name: 'Publish' });
    expect(edit.compareDocumentPosition(publish) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(edit);

    const footer = screen.getByLabelText('Page footer');
    expect(screen.queryByLabelText('Title')).toBeNull();
    fireEvent.change(footer, { target: { value: 'Updated footer' } });
    fireEvent.keyDown(window, { key: 's', ctrlKey: true });

    await waitFor(() => expect(savedBodies).toHaveLength(1));
    expect(savedBodies[0].title).toBe('October 2026');
    expect(savedBodies[0].footer).toBe('Updated footer');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('saves footer edits from the Edit dialog without exposing a Title field', async () => {
    const { savedBodies } = configureFetch();
    render(<MarketAdminPage initialSlug="October-2026" />);

    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    expect(screen.queryByLabelText('Title')).toBeNull();
    fireEvent.change(screen.getByLabelText('Page footer'), { target: { value: 'Updated footer' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(savedBodies).toHaveLength(1));
    expect(savedBodies[0].title).toBe('October 2026');
    expect(savedBodies[0].footer).toBe('Updated footer');
  });
});

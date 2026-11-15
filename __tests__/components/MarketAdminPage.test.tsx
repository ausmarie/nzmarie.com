import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

function configureFetch() {
  const savedBodies: Record<string, unknown>[] = [];
  const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
    if (input === '/api/admin/market-reports') {
      return {
        ok: true,
        json: async () => ({
          success: true,
          reports: [reportSummary],
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

    const reportLabel = await screen.findByText('October 2026');
    const reportButton = reportLabel.closest('button');
    if (!reportButton) throw new Error('October report button was not rendered.');
    fireEvent.click(reportButton);

    expect(mocks.push).toHaveBeenCalledWith('/admin/market/draft/October-2026');
  });

  it('automatically saves report content while preserving the existing summary', async () => {
    const { savedBodies } = configureFetch();
    render(<MarketAdminPage initialSlug="October-2026" />);

    fireEvent.click(await screen.findByRole('button', { name: 'Change report content' }));

    await waitFor(() => expect(savedBodies).toHaveLength(1), { timeout: 3000 });
    expect(savedBodies[0].summary).toBe('Existing introduction');
    expect(screen.queryByRole('button', { name: 'Save draft' })).toBeNull();
  });

  it('edits the title above the footer and saves both with Ctrl+S', async () => {
    const { savedBodies } = configureFetch();
    render(<MarketAdminPage initialSlug="October-2026" />);

    const edit = await screen.findByRole('button', { name: 'Edit' });
    const publish = screen.getByRole('button', { name: 'Publish' });
    expect(edit.compareDocumentPosition(publish) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(edit);

    const title = screen.getByLabelText('Title');
    const footer = screen.getByLabelText('Page footer');
    expect(title.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.change(title, { target: { value: 'Updated October report' } });
    fireEvent.change(footer, { target: { value: 'Updated footer' } });
    fireEvent.keyDown(window, { key: 's', ctrlKey: true });

    await waitFor(() => expect(savedBodies).toHaveLength(1));
    expect(savedBodies[0].title).toBe('Updated October report');
    expect(savedBodies[0].footer).toBe('Updated footer');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('saves title and footer together from the Edit dialog', async () => {
    const { savedBodies } = configureFetch();
    render(<MarketAdminPage initialSlug="October-2026" />);

    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Renamed report' } });
    fireEvent.change(screen.getByLabelText('Page footer'), { target: { value: 'Updated footer' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(savedBodies).toHaveLength(1));
    expect(savedBodies[0].title).toBe('Renamed report');
    expect(savedBodies[0].footer).toBe('Updated footer');
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import React from 'react';
import DocumentViewer from '@/app/admin/reports/components/DocumentViewer';
import { useReportStore } from '@/app/admin/reports/stores/report-store';

const mockPush = vi.fn();
const mockReplace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

vi.mock('@/app/admin/reports/components/ReportEditor', () => ({
  default: () => <div data-testid="report-editor">Editor</div>,
}));

vi.mock('@/app/admin/reports/components/AboutMarieEditor', () => ({
  default: () => <div data-testid="about-marie-editor">About Marie</div>,
}));

vi.mock('@/app/admin/reports/components/ReportToolbar', () => ({
  default: () => <div data-testid="report-toolbar">Toolbar</div>,
}));

vi.mock('@/app/admin/reports/components/ConfirmModal', () => ({
  default: () => <div />,
}));

vi.mock('@/app/admin/reports/components/EmptyState', () => ({
  default: () => <div />,
}));

vi.mock('@/app/admin/reports/components/EditHeaderFooter', () => ({
  default: () => <div />,
}));

const doc = {
  id: 'doc-1',
  user_id: 'user-1',
  parent_id: null,
  doc_type: 'report',
  suburb_id: 'ns-1',
  quarter: '2026-Q2',
  title: 'North Shore 2026 Q2 Market Report',
  content: [{ type: 'paragraph', content: ['Hello'] }],
  icon: null,
  cover_type: null,
  cover_value: null,
  sort_order: 0,
  status: 'draft',
  suburb_name: 'North Shore',
  suburb_region: 'North Shore',
  created_at: '2026-08-01T00:00:00.000Z',
  updated_at: '2026-08-01T00:00:00.000Z',
  children: [],
} as any;

describe('DocumentViewer Ctrl+S save', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useReportStore.setState({
      documents: [doc],
      isSaving: false,
      selectedDocId: 'doc-1',
      slugMap: {},
      idToSlug: {},
      refreshKey: 0,
    });
    global.fetch = vi.fn().mockImplementation((url: string, init?: any) => {
      const urlStr = String(url);
      if (urlStr.includes('/documents/doc-1') && (!init || init.method !== 'PUT')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, document: doc }) }) as any;
      }
      if (urlStr.includes('/api/admin/reports/documents') && init?.method === 'PUT') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) }) as any;
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) }) as any;
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('saves the document via PUT when Ctrl+S is pressed', async () => {
    render(<DocumentViewer docId="doc-1" />);
    await screen.findByTestId('report-editor');

    vi.mocked(global.fetch).mockClear();

    const event = new KeyboardEvent('keydown', { key: 's', ctrlKey: true, cancelable: true });
    window.dispatchEvent(event);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/admin/reports/documents',
        expect.objectContaining({ method: 'PUT' })
      );
    });
    expect(event.defaultPrevented).toBe(true);
  });

  it('does not save for a plain key press', async () => {
    render(<DocumentViewer docId="doc-1" />);
    await screen.findByTestId('report-editor');

    vi.mocked(global.fetch).mockClear();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', cancelable: true }));

    await new Promise((r) => setTimeout(r, 100));
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
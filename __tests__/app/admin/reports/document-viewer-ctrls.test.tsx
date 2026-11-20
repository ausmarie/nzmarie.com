import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import DocumentViewer from '@/app/admin/reports/components/DocumentViewer';
import { useReportStore } from '@/app/admin/reports/stores/report-store';

const mockPush = vi.fn();
const mockReplace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

vi.mock('@/app/admin/reports/components/ReportEditor', () => ({
  default: ({ className }: { className?: string }) => (
    <div className={`report-editor-container ${className || ''}`} data-testid="report-editor">Editor</div>
  ),
}));

vi.mock('@/app/admin/reports/components/AboutMarieEditor', () => ({
  default: () => <div data-testid="about-marie-editor">About Marie</div>,
}));

vi.mock('@/app/admin/reports/components/ReportToolbar', () => ({
  default: ({ onExport }: { onExport?: () => void }) => (
    <div data-testid="report-toolbar">
      <button onClick={onExport}>Export PDF</button>
    </div>
  ),
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
    fireEvent(window, event);

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

  it('renders page numbers for each page in report document', async () => {
    render(<DocumentViewer docId="doc-1" />);
    await screen.findByTestId('report-editor');

    const page1 = screen.getByText('Page 1 of 2');
    const page2 = screen.getByText('Page 2 of 2');
    expect(page1).toBeDefined();
    expect(page2).toBeDefined();
    expect(document.querySelectorAll('.print-page-footer-page')).toHaveLength(2);
    expect(document.querySelector('.pdf-numbering-debug-overlay')).toBeNull();
  });

  it('omits report content after the second page when exporting', async () => {
    render(<DocumentViewer docId="doc-1" />);
    await screen.findByTestId('report-editor');

    const editor = document.querySelector('.report-editor-container');
    if (!editor) throw new Error('Report editor element was not rendered');
    editor.innerHTML = `
      <div data-block-type="divider"></div>
      <div data-block-type="heading">Page 2</div>
      <div>Page 2 content</div>
      <div data-block-type="divider"></div>
      <div data-block-type="heading">Page 3</div>
      <div>Page 3 content</div>
    `;
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => undefined);

    fireEvent.click(screen.getByText('Export PDF'));

    const page3Heading = editor.querySelectorAll('[data-block-type="heading"]').item(1);
    const page3Content = page3Heading.nextElementSibling;
    expect(page3Heading.hasAttribute('data-print-page-limit-hidden')).toBe(true);
    expect(page3Content?.hasAttribute('data-print-page-limit-hidden')).toBe(true);
    expect(printSpy).toHaveBeenCalledOnce();

    window.dispatchEvent(new Event('afterprint'));
    expect(page3Heading.hasAttribute('data-print-page-limit-hidden')).toBe(false);
    expect(page3Content?.hasAttribute('data-print-page-limit-hidden')).toBe(false);
    printSpy.mockRestore();
  });
});
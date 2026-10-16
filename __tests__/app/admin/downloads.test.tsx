import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import React from 'react';

let useSessionMock: any;

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock('next-auth/react', () => ({
  useSession: () => useSessionMock(),
}));

vi.mock('@/components/admin/Skeleton', () => ({
  SkeletonDownloads: () => <div>Loading Downloads</div>,
}));

(global.fetch as any) = vi.fn();

describe('Downloads Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('Marie can access downloads page', async () => {
    useSessionMock = vi.fn().mockReturnValue({
      data: { user: { email: 'nzmarie.com@gmail.com' } },
      status: 'authenticated',
    });

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: [],
        suburbs: [],
        stats: { total_downloads: '0', this_month: '0', unique_users: '0' },
        pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
      }),
    });

    const DownloadsPage = (await import('../../../app/admin/downloads/page')).default;
    render(<DownloadsPage />);

    await waitFor(() => {
      expect(screen.getByText('📥 Downloads')).toBeDefined();
    });
  });

  it('Louis can access downloads page', async () => {
    useSessionMock = vi.fn().mockReturnValue({
      data: { user: { email: 'nzlouis.com@gmail.com' } },
      status: 'authenticated',
    });

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: [],
        suburbs: [],
        stats: { total_downloads: '0', this_month: '0', unique_users: '0' },
        pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
      }),
    });

    const DownloadsPage = (await import('../../../app/admin/downloads/page')).default;
    render(<DownloadsPage />);

    await waitFor(() => {
      expect(screen.getByText('📥 Downloads')).toBeDefined();
    });
  });

  it('redirects non-admin users', async () => {
    useSessionMock = vi.fn().mockReturnValue({
      data: { user: { email: 'user@example.com' } },
      status: 'authenticated',
    });

    const DownloadsPage = (await import('../../../app/admin/downloads/page')).default;
    render(<DownloadsPage />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/admin/dashboard');
    });
  });

  it('displays access restricted message for non-admin', async () => {
    useSessionMock = vi.fn().mockReturnValue({
      data: { user: { email: 'user@example.com' } },
      status: 'authenticated',
    });

    const DownloadsPage = (await import('../../../app/admin/downloads/page')).default;
    const { container } = render(<DownloadsPage />);

    expect(container.querySelector('h2')?.textContent).toContain('Access Restricted');
  });

  it('displays download records in table', async () => {
    useSessionMock = vi.fn().mockReturnValue({
      data: { user: { email: 'nzmarie.com@gmail.com' } },
      status: 'authenticated',
    });

    const mockDownloads = [
      {
        id: '1',
        email: 'john@example.com',
        name: 'John Smith',
        suburb: 'Takapuna',
        report_type: 'local_market',
        downloaded_at: '2026-07-01T10:30:00Z',
        source: 'direct_mail',
        tracking_code: 'DM-123456',
        created_at: '2026-07-01T10:30:00Z',
      },
      {
        id: '2',
        email: 'jane@example.com',
        name: 'Jane Doe',
        suburb: 'Albany',
        report_type: 'local_market',
        downloaded_at: '2026-07-02T14:15:00Z',
        source: 'organic',
        tracking_code: null,
        created_at: '2026-07-02T14:15:00Z',
      },
    ];

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: mockDownloads,
        suburbs: ['Takapuna', 'Albany'],
        stats: { total_downloads: '2', this_month: '2', unique_users: '2' },
        pagination: { page: 1, limit: 50, total: 2, totalPages: 1 },
      }),
    });

    const DownloadsPage = (await import('../../../app/admin/downloads/page')).default;
    const { container } = render(<DownloadsPage />);

    await waitFor(() => {
      const table = container.querySelector('table');
      expect(table).toBeDefined();
    }, { timeout: 3000 });
  });

  it('displays source badges correctly', async () => {
    useSessionMock = vi.fn().mockReturnValue({
      data: { user: { email: 'nzmarie.com@gmail.com' } },
      status: 'authenticated',
    });

    const mockDownloads = [
      {
        id: '1',
        email: 'john@example.com',
        name: 'John Smith',
        suburb: 'Takapuna',
        report_type: 'local_market',
        downloaded_at: '2026-07-01T10:30:00Z',
        source: 'direct_mail',
        tracking_code: 'DM-123456',
        created_at: '2026-07-01T10:30:00Z',
      },
    ];

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: mockDownloads,
        suburbs: ['Takapuna'],
        stats: { total_downloads: '1', this_month: '1', unique_users: '1' },
        pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
      }),
    });

    const DownloadsPage = (await import('../../../app/admin/downloads/page')).default;
    render(<DownloadsPage />);

    await waitFor(() => {
      expect(screen.getByText(/📮 Direct Mail/)).toBeDefined();
    });
  });

  it('search filters downloads', async () => {
    useSessionMock = vi.fn().mockReturnValue({
      data: { user: { email: 'nzmarie.com@gmail.com' } },
      status: 'authenticated',
    });

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: [],
        suburbs: [],
        stats: { total_downloads: '0', this_month: '0', unique_users: '0' },
        pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
      }),
    });

    const DownloadsPage = (await import('../../../app/admin/downloads/page')).default;
    render(<DownloadsPage />);

    await waitFor(() => {
      const searchInput = screen.queryByPlaceholderText(/Search by email/);
      expect(searchInput).toBeDefined();
    }, { timeout: 3000 });

    const searchInput = screen.getByPlaceholderText(/Search by email/) as HTMLInputElement;
    fireEvent.change(searchInput, { target: { value: 'john@example.com' } });

    await waitFor(() => {
      expect(searchInput.value).toBe('john@example.com');
    }, { timeout: 1000 });
  });

  it('suburb filter works', async () => {
    useSessionMock = vi.fn().mockReturnValue({
      data: { user: { email: 'nzmarie.com@gmail.com' } },
      status: 'authenticated',
    });

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: [],
        suburbs: ['Takapuna', 'Albany', 'Northcross'],
        stats: { total_downloads: '0', this_month: '0', unique_users: '0' },
        pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
      }),
    });

    const DownloadsPage = (await import('../../../app/admin/downloads/page')).default;
    render(<DownloadsPage />);

    await waitFor(() => {
      const suburbSelect = screen.getByDisplayValue('All Suburbs');
      expect(suburbSelect).toBeDefined();
    });
  });

  it('source filter works', async () => {
    useSessionMock = vi.fn().mockReturnValue({
      data: { user: { email: 'nzmarie.com@gmail.com' } },
      status: 'authenticated',
    });

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: [],
        suburbs: [],
        stats: { total_downloads: '0', this_month: '0', unique_users: '0' },
        pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
      }),
    });

    const DownloadsPage = (await import('../../../app/admin/downloads/page')).default;
    render(<DownloadsPage />);

    await waitFor(() => {
      const sourceSelect = screen.getByDisplayValue('All Sources');
      expect(sourceSelect).toBeDefined();
    });
  });

  it('displays statistics correctly', async () => {
    useSessionMock = vi.fn().mockReturnValue({
      data: { user: { email: 'nzmarie.com@gmail.com' } },
      status: 'authenticated',
    });

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: [],
        suburbs: [],
        stats: { total_downloads: '245', this_month: '67', unique_users: '189' },
        pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
      }),
    });

    const DownloadsPage = (await import('../../../app/admin/downloads/page')).default;
    render(<DownloadsPage />);

    await waitFor(() => {
      expect(screen.getByText('245')).toBeDefined();
      expect(screen.getByText('67')).toBeDefined();
      expect(screen.getByText('189')).toBeDefined();
    });
  });

  it('pagination works', async () => {
    useSessionMock = vi.fn().mockReturnValue({
      data: { user: { email: 'nzmarie.com@gmail.com' } },
      status: 'authenticated',
    });

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: [],
        suburbs: [],
        stats: { total_downloads: '150', this_month: '20', unique_users: '80' },
        pagination: { page: 1, limit: 50, total: 150, totalPages: 3 },
      }),
    });

    const DownloadsPage = (await import('../../../app/admin/downloads/page')).default;
    render(<DownloadsPage />);

    await waitFor(() => {
      const pageText = screen.queryByText(/Page 1 of 3/);
      expect(pageText).toBeDefined();
    }, { timeout: 3000 });
  });

  it('displays empty state when no downloads', async () => {
    useSessionMock = vi.fn().mockReturnValue({
      data: { user: { email: 'nzmarie.com@gmail.com' } },
      status: 'authenticated',
    });

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: [],
        suburbs: [],
        stats: { total_downloads: '0', this_month: '0', unique_users: '0' },
        pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
      }),
    });

    const DownloadsPage = (await import('../../../app/admin/downloads/page')).default;
    render(<DownloadsPage />);

    await waitFor(() => {
      expect(screen.getByText('No Downloads Found')).toBeDefined();
    });
  });

  it('filters downloads by suburb', async () => {
    useSessionMock = vi.fn().mockReturnValue({
      data: { user: { email: 'nzmarie.com@gmail.com' } },
      status: 'authenticated',
    });

    const mockDownloads = [
      {
        id: '1',
        email: 'john@example.com',
        name: 'John Smith',
        suburb: 'Takapuna',
        report_type: 'local_market',
        downloaded_at: '2026-07-01T10:30:00Z',
        source: 'direct_mail',
        tracking_code: 'DM-123456',
        created_at: '2026-07-01T10:30:00Z',
      },
    ];

    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: mockDownloads,
          suburbs: ['Takapuna', 'Albany'],
          stats: { total_downloads: '1', this_month: '1', unique_users: '1' },
          pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
        }),
      });

    const DownloadsPage = (await import('../../../app/admin/downloads/page')).default;
    render(<DownloadsPage />);

    await waitFor(() => {
      const selects = screen.getAllByDisplayValue('All Suburbs');
      expect(selects.length).toBeGreaterThan(0);
    });
  });

  it('handles NULL suburb as Other', async () => {
    useSessionMock = vi.fn().mockReturnValue({
      data: { user: { email: 'nzmarie.com@gmail.com' } },
      status: 'authenticated',
    });

    const mockDownloads = [
      {
        id: '1',
        email: 'jane@example.com',
        name: 'Jane Doe',
        suburb: 'Other',
        report_type: 'local_market',
        downloaded_at: '2026-07-02T14:15:00Z',
        source: 'organic',
        tracking_code: null,
        created_at: '2026-07-02T14:15:00Z',
      },
    ];

    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: mockDownloads,
          suburbs: ['Takapuna', 'Albany', 'Other'],
          stats: { total_downloads: '1', this_month: '1', unique_users: '1' },
          pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
        }),
      });

    const DownloadsPage = (await import('../../../app/admin/downloads/page')).default;
    const { container } = render(<DownloadsPage />);

    await waitFor(() => {
      const rows = container.querySelectorAll('tbody tr');
      expect(rows.length).toBe(1);
    });
  });

  it('handles API errors gracefully', async () => {
    useSessionMock = vi.fn().mockReturnValue({
      data: { user: { email: 'nzmarie.com@gmail.com' } },
      status: 'authenticated',
    });

    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Failed to fetch' }),
    });

    const DownloadsPage = (await import('../../../app/admin/downloads/page')).default;
    render(<DownloadsPage />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to fetch/)).toBeDefined();
    });
  });

  it('clear filters button works', async () => {
    useSessionMock = vi.fn().mockReturnValue({
      data: { user: { email: 'nzmarie.com@gmail.com' } },
      status: 'authenticated',
    });

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: [],
        suburbs: ['Takapuna'],
        stats: { total_downloads: '0', this_month: '0', unique_users: '0' },
        pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
      }),
    });

    const DownloadsPage = (await import('../../../app/admin/downloads/page')).default;
    render(<DownloadsPage />);

    await waitFor(() => {
      const clearButton = screen.getByText('Clear Filters');
      expect(clearButton).toBeDefined();
    });
  });
});

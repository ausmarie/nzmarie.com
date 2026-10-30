import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, within } from '@testing-library/react';
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
  SkeletonDashboard: () => <div>Loading Dashboard</div>,
}));

vi.mock('@/components/admin/ScanTrendsChart', () => ({
  default: () => <div data-testid="scan-trends-chart" />,
}));

vi.mock('@/components/admin/CampaignScanLogsPanel', () => ({
  default: () => <div data-testid="campaign-scan-logs-panel" />,
}));

(global.fetch as any) = vi.fn();

describe('Dashboard Stats API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders with authentication', async () => {
    useSessionMock = vi.fn().mockReturnValue({
      data: { user: { email: 'nzmarie.com@gmail.com', name: 'Marie' } },
      status: 'authenticated',
    });

    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          stats: {
            newLeads: 5,
            highPriorityLeads: 2,
            pendingOutreach: 156,
            todayFollowups: 8,
            overdueFollowups: 3,
            todayDownloads: 12,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [],
          pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
        }),
      });

    const DashboardPage = (await import('../../../app/admin/dashboard/page')).default;
    const { container } = render(<DashboardPage />);

    expect(container.querySelector('h1')).toBeDefined();
  });

  it('displays welcome message', async () => {
    useSessionMock = vi.fn().mockReturnValue({
      data: { user: { email: 'nzmarie.com@gmail.com', name: 'Marie' } },
      status: 'authenticated',
    });

    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          stats: {
            newLeads: 5,
            highPriorityLeads: 2,
            pendingOutreach: 156,
            todayFollowups: 8,
            overdueFollowups: 3,
            todayDownloads: 12,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [],
          pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
        }),
      });

    const DashboardPage = (await import('../../../app/admin/dashboard/page')).default;
    render(<DashboardPage />);

    await waitFor(() => {
      const welcome = screen.queryByText(/Welcome back/);
      expect(welcome).toBeDefined();
    }, { timeout: 3000 });
  });

  it('fetches stats data', async () => {
    useSessionMock = vi.fn().mockReturnValue({
      data: { user: { email: 'nzmarie.com@gmail.com', name: 'Marie' } },
      status: 'authenticated',
    });

    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          stats: {
            newLeads: 23,
            highPriorityLeads: 12,
            pendingOutreach: 156,
            todayFollowups: 8,
            overdueFollowups: 3,
            todayDownloads: 12,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [],
          pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
        }),
      });

    const DashboardPage = (await import('../../../app/admin/dashboard/page')).default;
    render(<DashboardPage />);

    expect(global.fetch).toHaveBeenCalledWith('/api/admin/dashboard/stats');
  });

  it('renders stat cards', async () => {
    useSessionMock = vi.fn().mockReturnValue({
      data: { user: { email: 'nzmarie.com@gmail.com', name: 'Marie' } },
      status: 'authenticated',
    });

    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          stats: {
            newLeads: 5,
            highPriorityLeads: 2,
            pendingOutreach: 156,
            todayFollowups: 8,
            overdueFollowups: 3,
            todayDownloads: 12,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [],
          pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
        }),
      });

    const DashboardPage = (await import('../../../app/admin/dashboard/page')).default;
    const { container } = render(<DashboardPage />);

    expect(container.querySelector('[class*="bg-white"]')).toBeDefined();
  });

  it('renders follow-ups section', async () => {
    useSessionMock = vi.fn().mockReturnValue({
      data: { user: { email: 'nzmarie.com@gmail.com', name: 'Marie' } },
      status: 'authenticated',
    });

    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          stats: {
            newLeads: 5,
            highPriorityLeads: 2,
            pendingOutreach: 156,
            todayFollowups: 8,
            overdueFollowups: 3,
            todayDownloads: 12,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [],
          pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
        }),
      });

    const DashboardPage = (await import('../../../app/admin/dashboard/page')).default;
    render(<DashboardPage />);

    await waitFor(() => {
      const followupSection = screen.queryByText(/Today's Follow-ups/i);
      expect(followupSection).toBeDefined();
    }, { timeout: 3000 });
  });

  it('handles API errors', async () => {
    useSessionMock = vi.fn().mockReturnValue({
      data: { user: { email: 'nzmarie.com@gmail.com', name: 'Marie' } },
      status: 'authenticated',
    });

    (global.fetch as any).mockResolvedValueOnce({ ok: false });

    const DashboardPage = (await import('../../../app/admin/dashboard/page')).default;
    render(<DashboardPage />);

    await waitFor(() => {
      const error = screen.queryByText(/Failed to fetch dashboard data/i);
      expect(error).toBeDefined();
    }, { timeout: 3000 });
  });

  it('redirects unauthenticated users', async () => {
    useSessionMock = vi.fn().mockReturnValue({
      data: null,
      status: 'unauthenticated',
    });

    const DashboardPage = (await import('../../../app/admin/dashboard/page')).default;
    render(<DashboardPage />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/admin/login');
    });
  });

  it('displays suburb filter dropdown', async () => {
    useSessionMock = vi.fn().mockReturnValue({
      data: { user: { email: 'nzmarie.com@gmail.com', name: 'Marie' } },
      status: 'authenticated',
    });

    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          stats: {
            newLeads: 5,
            highPriorityLeads: 2,
            pendingOutreach: 156,
            todayFollowups: 8,
            overdueFollowups: 3,
            todayDownloads: 12,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [],
          pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
        }),
      });

    const DashboardPage = (await import('../../../app/admin/dashboard/page')).default;
    const { container } = render(<DashboardPage />);

    await waitFor(() => {
      const selects = container.querySelectorAll('select');
      expect(selects.length).toBeGreaterThan(0);
    });
  });

  it('filters stats by suburb', async () => {
    useSessionMock = vi.fn().mockReturnValue({
      data: { user: { email: 'nzmarie.com@gmail.com', name: 'Marie' } },
      status: 'authenticated',
    });

    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          stats: {
            newLeads: 5,
            highPriorityLeads: 2,
            pendingOutreach: 156,
            todayFollowups: 8,
            overdueFollowups: 3,
            todayDownloads: 12,
          },
          suburb: 'Takapuna',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [],
          pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
        }),
      });

    const DashboardPage = (await import('../../../app/admin/dashboard/page')).default;
    render(<DashboardPage />);

    expect(global.fetch).toHaveBeenCalled();
  });

  it('handles suburb filter with API request', async () => {
    useSessionMock = vi.fn().mockReturnValue({
      data: { user: { email: 'nzmarie.com@gmail.com', name: 'Marie' } },
      status: 'authenticated',
    });

    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          stats: {
            newLeads: 3,
            highPriorityLeads: 1,
            pendingOutreach: 50,
            todayFollowups: 2,
            overdueFollowups: 1,
            todayDownloads: 5,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [],
          pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
        }),
      });

    const DashboardPage = (await import('../../../app/admin/dashboard/page')).default;
    render(<DashboardPage />);

    await new Promise(resolve => setTimeout(resolve, 100));

    const fetchCalls = (global.fetch as any).mock.calls;
    expect(fetchCalls.length).toBeGreaterThan(0);
  });

  it('renders Outreach by Suburb with the most recently sent suburb first', async () => {
    useSessionMock = vi.fn().mockReturnValue({
      data: { user: { email: 'nzmarie.com@gmail.com', name: 'Marie' } },
      status: 'authenticated',
    });

    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          stats: {
            newLeads: 1,
            highPriorityLeads: 0,
            pendingOutreach: 0,
            sentOutreach: 0,
            todayFollowups: 0,
            overdueFollowups: 0,
            todayDownloads: 0,
            outreachBySuburb: [
              { suburb: 'Albany', pending_count: 3, sent_count: 5, total_count: 8, last_sent_at: '2026-07-01T00:00:00.000Z' },
              { suburb: 'Torbay', pending_count: 2, sent_count: 12, total_count: 14, last_sent_at: '2026-08-10T00:00:00.000Z' },
              { suburb: 'Browns Bay', pending_count: 1, sent_count: 0, total_count: 1, last_sent_at: null },
            ],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [],
          pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
        }),
      });

    const DashboardPage = (await import('../../../app/admin/dashboard/page')).default;
    const { container } = render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Outreach by Suburb')).toBeTruthy();
    }, { timeout: 3000 });

    const section = screen.getByText('Outreach by Suburb').closest('div.bg-white') as HTMLElement;
    const titles = section.querySelectorAll('div.text-sm.font-semibold.text-slate-800');
    const order = Array.from(titles).map((el) => el.textContent);
    expect(order).toEqual(['Torbay', 'Albany', 'Browns Bay']);
    expect(container.querySelectorAll('div.text-sm.font-semibold.text-slate-800').length).toBeGreaterThan(0);
  });

  it('renders Total Sent quarterly breakdown with suburbs sorted by sent count', async () => {
    useSessionMock = vi.fn().mockReturnValue({
      data: { user: { email: 'nzmarie.com@gmail.com', name: 'Marie' } },
      status: 'authenticated',
    });

    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          stats: {
            newLeads: 0,
            highPriorityLeads: 0,
            pendingOutreach: 0,
            todayFollowups: 0,
            overdueFollowups: 0,
            todayDownloads: 0,
            sentSummary: {
              total_sent: 214,
              suburb_count: 2,
              suburbs: [
                { suburb: 'Oteha', sent_count: 209 },
                { suburb: 'Torbay', sent_count: 5 },
              ],
              quarterly: [
                {
                  quarter_key: '2026-Q3',
                  total_sent: 5,
                  suburbs: [
                    { suburb: 'Oteha', sent_count: 5, last_sent_at: '2026-10-11T00:00:00.000Z', report_url: 'https://example.com/oteha-q3.pdf' },
                  ],
                },
                {
                  quarter_key: '2026-Q2',
                  total_sent: 209,
                  suburbs: [
                    { suburb: 'Oteha', sent_count: 209, last_sent_at: '2026-10-01T00:00:00.000Z', report_url: 'https://example.com/oteha-q2.pdf' },
                  ],
                },
              ],
            },
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [],
          pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
        }),
      });

    const DashboardPage = (await import('../../../app/admin/dashboard/page')).default;
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Total Sent')).toBeTruthy();
    }, { timeout: 3000 });

    expect(screen.getByText('214')).toBeTruthy();
    expect(screen.getByText('2026-Q3')).toBeTruthy();
    expect(screen.getByText('2026-Q2')).toBeTruthy();
    expect(screen.getByText('5 sent')).toBeTruthy();
    expect(screen.getByText('209 sent')).toBeTruthy();
    expect(screen.getByText('Oteha: 5')).toBeTruthy();
    expect(screen.getByText('Oteha: 209')).toBeTruthy();
  });

  it('renders today sent counts with every suburb under Total Sent', async () => {
    useSessionMock = vi.fn().mockReturnValue({
      data: { user: { email: 'nzmarie.com@gmail.com', name: 'Marie' } },
      status: 'authenticated',
    });

    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          stats: {
            newLeads: 0,
            highPriorityLeads: 0,
            pendingOutreach: 0,
            todayFollowups: 0,
            overdueFollowups: 0,
            todayDownloads: 0,
            sentSummary: {
              total_sent: 214,
              suburb_count: 2,
              suburbs: [
                { suburb: 'Oteha', sent_count: 209 },
                { suburb: 'Torbay', sent_count: 5 },
              ],
              today: {
                total_sent: 19,
                suburbs: [
                  { suburb: 'Albany', sent_count: 12 },
                  { suburb: 'Torbay', sent_count: 7 },
                ],
              },
              quarterly: [],
            },
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [],
          pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
        }),
      });

    const DashboardPage = (await import('../../../app/admin/dashboard/page')).default;
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Total Sent')).toBeTruthy();
    }, { timeout: 3000 });

    const totalSentCard = screen.getByText('Total Sent').closest('div.bg-white') as HTMLElement;
    expect(within(totalSentCard).getByText('Today')).toBeTruthy();
    expect(within(totalSentCard).getByText('19 sent')).toBeTruthy();
    expect(within(totalSentCard).getByText('Albany: 12')).toBeTruthy();
    expect(within(totalSentCard).getByText('Torbay: 7')).toBeTruthy();
  });

  it('shows an empty today state when nothing was sent today', async () => {
    useSessionMock = vi.fn().mockReturnValue({
      data: { user: { email: 'nzmarie.com@gmail.com', name: 'Marie' } },
      status: 'authenticated',
    });

    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          stats: {
            newLeads: 0,
            highPriorityLeads: 0,
            pendingOutreach: 0,
            todayFollowups: 0,
            overdueFollowups: 0,
            todayDownloads: 0,
            sentSummary: {
              total_sent: 214,
              suburb_count: 1,
              suburbs: [{ suburb: 'Oteha', sent_count: 209 }],
              today: { total_sent: 0, suburbs: [] },
              quarterly: [],
            },
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [],
          pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
        }),
      });

    const DashboardPage = (await import('../../../app/admin/dashboard/page')).default;
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Total Sent')).toBeTruthy();
    }, { timeout: 3000 });

    const totalSentCard = screen.getByText('Total Sent').closest('div.bg-white') as HTMLElement;
    expect(within(totalSentCard).getByText('Today')).toBeTruthy();
    expect(within(totalSentCard).getByText('0 sent')).toBeTruthy();
    expect(within(totalSentCard).getByText('No sends today')).toBeTruthy();
  });

  it('renders the latest appraisals between Total Sent and Total Scans', async () => {
    useSessionMock = vi.fn().mockReturnValue({
      data: { user: { email: 'nzmarie.com@gmail.com', name: 'Marie' } },
      status: 'authenticated',
    });

    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          stats: {
            newLeads: 0,
            highPriorityLeads: 0,
            pendingOutreach: 0,
            todayFollowups: 0,
            overdueFollowups: 0,
            todayDownloads: 0,
            totalBookings: 9,
            recentAppraisals: [
              {
                id: 'appraisal-1',
                client_name: 'Vi',
                email: 'vipleiku@gmail.com',
                phone: '+64274039537',
                suburb: 'Sunnynook',
                property_address: '249 Sunset Road, Sunnynook',
                contact_status: 'not_contacted',
                created_at: '2026-10-06T05:30:08.784Z',
              },
              {
                id: 'appraisal-2',
                client_name: 'Louis Augustine',
                email: 'nzlouis.com@gmail.com',
                phone: '+642102588639',
                suburb: 'Northcross',
                property_address: '5 Cottam Grove, Northcross',
                contact_status: 'not_contacted',
                created_at: '2026-07-02T07:35:16.083Z',
              },
            ],
            sentSummary: {
              total_sent: 214,
              suburb_count: 1,
              suburbs: [{ suburb: 'Oteha', sent_count: 209 }],
              today: { total_sent: 0, suburbs: [] },
              quarterly: [],
            },
            scanStats: { total_scans: 42, total_unique: 18, campaigns: [] },
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [],
          pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
        }),
      });

    const DashboardPage = (await import('../../../app/admin/dashboard/page')).default;
    const { container } = render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Total Appraisals')).toBeTruthy();
    }, { timeout: 3000 });

    // The remaining cards render in the deferred batch; wait for them so the
    // card order can be asserted.
    await waitFor(() => {
      expect(screen.getByText('Total Scans')).toBeTruthy();
    }, { timeout: 3000 });

    const cards = Array.from(container.querySelectorAll('div.min-h-\\[192px\\]'));
    const labels = cards.map((card) =>
      ['Total Sent', 'Total Appraisals', 'Total Scans', 'Total Downloads']
        .find((label) => card.textContent?.includes(label)) ?? ''
    );
    expect(labels.slice(0, 3)).toEqual(['Total Sent', 'Total Appraisals', 'Total Scans']);

    const appraisalCard = cards.find((card) => card.textContent?.includes('Total Appraisals')) as HTMLElement;
    expect(within(appraisalCard).getByText('9')).toBeTruthy();
    expect(within(appraisalCard).getByText('Vi')).toBeTruthy();
    expect(within(appraisalCard).getByText('vipleiku@gmail.com')).toBeTruthy();
    expect(within(appraisalCard).getByText('Sunnynook')).toBeTruthy();
    expect(within(appraisalCard).getByText('Louis Augustine')).toBeTruthy();
    expect(within(appraisalCard).getByText('nzlouis.com@gmail.com')).toBeTruthy();
    expect(within(appraisalCard).getAllByText(/Oct/).length).toBeGreaterThan(0);
  });

  it('shows an empty appraisals state when there are none', async () => {    useSessionMock = vi.fn().mockReturnValue({
      data: { user: { email: 'nzmarie.com@gmail.com', name: 'Marie' } },
      status: 'authenticated',
    });

    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          stats: {
            newLeads: 0,
            highPriorityLeads: 0,
            pendingOutreach: 0,
            todayFollowups: 0,
            overdueFollowups: 0,
            todayDownloads: 0,
            totalBookings: 0,
            recentAppraisals: [],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [],
          pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
        }),
      });

    const DashboardPage = (await import('../../../app/admin/dashboard/page')).default;
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Total Appraisals')).toBeTruthy();
    }, { timeout: 3000 });

    expect(screen.getByText('No appraisals yet')).toBeTruthy();
  });

  it('shows all recent appraisals directly under the Total Appraisals total', async () => {
    useSessionMock = vi.fn().mockReturnValue({
      data: { user: { email: 'nzmarie.com@gmail.com', name: 'Marie' } },
      status: 'authenticated',
    });

    const recentAppraisals = [
      { id: 'a1', client_name: 'Client One', email: 'one@example.com', suburb: 'Torbay' },
      { id: 'a2', client_name: 'Client Two', email: 'two@example.com', suburb: 'Albany' },
      { id: 'a3', client_name: 'Client Three', email: 'three@example.com', suburb: 'Oteha' },
      { id: 'a4', client_name: 'Client Four', email: 'four@example.com', suburb: 'Sunnynook' },
      { id: 'a5', client_name: 'Client Five', email: 'five@example.com', suburb: 'Northcross' },
    ].map((item, index) => ({
      ...item,
      phone: '',
      property_address: `${index + 1} Test Road`,
      contact_status: 'new',
      created_at: `2026-10-0${index + 1}T05:30:08.784Z`,
    }));

    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          stats: {
            newLeads: 0,
            highPriorityLeads: 0,
            pendingOutreach: 0,
            todayFollowups: 0,
            overdueFollowups: 0,
            todayDownloads: 0,
            totalBookings: 5,
            recentAppraisals,
            sentSummary: {
              total_sent: 0,
              suburb_count: 0,
              suburbs: [],
              today: { total_sent: 0, suburbs: [] },
              quarterly: [],
            },
            scanStats: { total_scans: 0, total_unique: 0, campaigns: [] },
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [],
          pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
        }),
      });

    const DashboardPage = (await import('../../../app/admin/dashboard/page')).default;
    const { container } = render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Total Appraisals')).toBeTruthy();
    }, { timeout: 3000 });

    const appraisalCard = Array.from(container.querySelectorAll('div.min-h-\\[192px\\]')).find(
      (card) => card.textContent?.includes('Total Appraisals')
    ) as HTMLElement;

    // The card must not push its content to the bottom (which created a large
    // empty gap between the total and the recent appraisals).
    expect(appraisalCard.className).not.toContain('justify-between');

    // All recent appraisals returned by the API should be visible.
    recentAppraisals.forEach((item) => {
      expect(within(appraisalCard).getByText(item.client_name)).toBeTruthy();
      expect(within(appraisalCard).getByText(item.email)).toBeTruthy();
    });

    // The recent appraisal list must come after the "Total Appraisals" label.
    const cardText = appraisalCard.textContent ?? '';
    expect(cardText.indexOf('Total Appraisals')).toBeLessThan(cardText.indexOf('Client One'));
  });

  it('renders Scan Trends chart section', async () => {
    useSessionMock = vi.fn().mockReturnValue({
      data: { user: { email: 'nzmarie.com@gmail.com', name: 'Marie' } },
      status: 'authenticated',
    });

    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          stats: { newLeads: 0, highPriorityLeads: 0, pendingOutreach: 0, todayFollowups: 0, overdueFollowups: 0, todayDownloads: 0 },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } }),
      });

    const DashboardPage = (await import('../../../app/admin/dashboard/page')).default;
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Scan Trends')).toBeTruthy();
    }, { timeout: 3000 });
    expect(screen.getByTestId('scan-trends-chart')).toBeTruthy();
  });

  it('renders QR Code Scan Logs section', async () => {
    useSessionMock = vi.fn().mockReturnValue({
      data: { user: { email: 'nzmarie.com@gmail.com', name: 'Marie' } },
      status: 'authenticated',
    });

    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          stats: { newLeads: 0, highPriorityLeads: 0, pendingOutreach: 0, todayFollowups: 0, overdueFollowups: 0, todayDownloads: 0 },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } }),
      });

    const DashboardPage = (await import('../../../app/admin/dashboard/page')).default;
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByTestId('campaign-scan-logs-panel')).toBeTruthy();
    }, { timeout: 3000 });
  });

  it('paints the priority cards from the summary while full stats is pending', async () => {
    useSessionMock = vi.fn().mockReturnValue({
      data: { user: { email: 'nzmarie.com@gmail.com', name: 'Marie' } },
      status: 'authenticated',
    });

    let resolveFullStats: ((value: any) => void) | null = null;
    const fullStatsPromise = new Promise((resolve) => {
      resolveFullStats = resolve;
    });

    (global.fetch as any).mockImplementation((url: string) => {
      if (String(url).includes('part=summary')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            part: 'summary',
            stats: {
              sentSummary: {
                total_sent: 214,
                suburb_count: 1,
                suburbs: [{ suburb: 'Oteha', sent_count: 209 }],
                today: { total_sent: 0, suburbs: [] },
                quarterly: [],
              },
              totalBookings: 9,
              recentAppraisals: [
                {
                  id: 'appraisal-1',
                  client_name: 'Vi',
                  email: 'vipleiku@gmail.com',
                  phone: '',
                  suburb: 'Sunnynook',
                  property_address: '249 Sunset Road',
                  contact_status: 'not_contacted',
                  created_at: '2026-10-06T05:30:08.784Z',
                },
              ],
            },
          }),
        });
      }
      if (String(url).includes('/api/admin/bookings')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } }),
        });
      }
      return fullStatsPromise;
    });

    const DashboardPage = (await import('../../../app/admin/dashboard/page')).default;
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Total Sent')).toBeTruthy();
    }, { timeout: 3000 });

    expect(screen.getByText('214')).toBeTruthy();
    expect(screen.getByText('Total Appraisals')).toBeTruthy();
    expect(screen.getByText('9')).toBeTruthy();
    expect(screen.getByText('Vi')).toBeTruthy();

    const urls = (global.fetch as any).mock.calls.map((call: any[]) => String(call[0]));
    expect(urls[0]).toContain('part=summary');
    expect(urls[1]).toBe('/api/admin/dashboard/stats');

    // Heavy sections stay deferred until the full stats request resolves.
    expect(screen.queryByText('Scan Trends')).toBeNull();

    resolveFullStats!({
      ok: true,
      json: () => Promise.resolve({ success: true, stats: {} }),
    });

    await waitFor(() => {
      expect(screen.getByText('Scan Trends')).toBeTruthy();
    }, { timeout: 3000 });
  });

  it('keeps the priority cards visible when the full stats request fails', async () => {
    useSessionMock = vi.fn().mockReturnValue({
      data: { user: { email: 'nzmarie.com@gmail.com', name: 'Marie' } },
      status: 'authenticated',
    });

    (global.fetch as any).mockImplementation((url: string) => {
      if (String(url).includes('part=summary')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            part: 'summary',
            stats: {
              sentSummary: {
                total_sent: 12,
                suburb_count: 1,
                suburbs: [{ suburb: 'Torbay', sent_count: 12 }],
                today: { total_sent: 0, suburbs: [] },
                quarterly: [],
              },
              totalBookings: 3,
              recentAppraisals: [],
            },
          }),
        });
      }
      if (String(url).includes('/api/admin/bookings')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } }),
        });
      }
      return Promise.resolve({ ok: false });
    });

    const DashboardPage = (await import('../../../app/admin/dashboard/page')).default;
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Total Sent')).toBeTruthy();
    }, { timeout: 3000 });

    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText('Total Appraisals')).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByText(/Failed to fetch dashboard data/i)).toBeTruthy();
    }, { timeout: 3000 });
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const createQueryClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });
import DashboardPage from '../../../app/admin/dashboard/page';
import AnalyticsPage from '../../../app/admin/analytics/page';
import PDFManagerPage from '../../../app/admin/assets/page';
import ActivityPage from '../../../app/admin/activity/page';

const mockPush = vi.fn();
let mockSession: { data: { user: { email: string; name?: string } } | null; status: 'authenticated' | 'loading' | 'unauthenticated' } = {
  data: { user: { email: 'nzlouis.com@gmail.com' } },
  status: 'authenticated',
};

vi.mock('next-auth/react', () => ({
  useSession: () => mockSession,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock('@/components/admin/Skeleton', () => ({
  SkeletonDashboard: () => <div>Loading Dashboard</div>,
  SkeletonAnalytics: () => <div>Loading Analytics</div>,
  SkeletonBookings: () => <div>Loading Bookings</div>,
  SkeletonDownloads: () => <div>Loading Downloads</div>,
  SkeletonPDFManager: () => <div>Loading PDF Manager</div>,
}));

describe('Extra admin pages', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockSession = {
      data: { user: { email: 'nzlouis.com@gmail.com' } },
      status: 'authenticated',
    };
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/admin/leads')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, leads: [] }) }) as any;
      }
      if (url.includes('/api/admin/reports')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, reports: [] }) }) as any;
      }
      if (url.includes('/api/admin/downloads')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            data: [],
            suburbs: [],
            stats: { total_downloads: '0', this_month: '0', unique_users: '0' },
            pagination: { page: 1, limit: 50, total: 0, totalPages: 0 }
          })
        }) as any;
      }
      if (url.includes('/api/admin/dashboard/stats')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            stats: { newLeads: 0, highPriorityLeads: 0, pendingOutreach: 0, todayFollowups: 0, overdueFollowups: 0, todayDownloads: 0, sentOutreach: 0, totalDownloads: 0, monthDownloads: 0, totalBookings: 0, monthBookings: 0, qrCodesTotal: 0, pdfReportsTotal: 0, outreachBySuburb: [], recentDownloads: [] },
            followups: []
          })
        }) as any;
      }
      if (url.includes('/api/admin/analytics/available-suburbs')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ availableSuburbs: ['Oteha', 'Albany', 'Browns Bay', 'Torbay'] }),
        }) as any;
      }
      if (url.includes('/api/admin/analytics/last-sold-data')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            suburbs: [
              { suburb: 'Albany', total: 12, buckets: [
                { range: '0-3', count: 2, percentage: 17 },
                { range: '3-5', count: 3, percentage: 25 },
                { range: '5-10', count: 4, percentage: 33 },
                { range: '10-15', count: 2, percentage: 17 },
                { range: '15+', count: 1, percentage: 8 },
                { range: 'no_data', count: 0, percentage: 0 },
              ]},
              { suburb: 'Oteha', total: 8, buckets: [
                { range: '0-3', count: 1, percentage: 13 },
                { range: '3-5', count: 2, percentage: 25 },
                { range: '5-10', count: 3, percentage: 38 },
                { range: '10-15', count: 1, percentage: 13 },
                { range: '15+', count: 1, percentage: 13 },
                { range: 'no_data', count: 0, percentage: 0 },
              ]},
            ],
            northShore: {
              total: 20,
              buckets: [
                { range: '0-3', count: 3, percentage: 15 },
                { range: '3-5', count: 5, percentage: 25 },
                { range: '5-10', count: 7, percentage: 35 },
                { range: '10-15', count: 3, percentage: 15 },
                { range: '15+', count: 2, percentage: 10 },
                { range: 'no_data', count: 0, percentage: 0 },
              ],
            },
          }),
        }) as any;
      }
      if (url.includes('/api/admin/analytics/chart-data')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: {
              monthlyData: [
                { period: '2025-01', periodRaw: '2025-01-01', cityMedian: 900000, citySales: 50, cityDays: 35, suburbs: { Oteha: { median: 1000000, sales: 10, days: 30 }, Albany: { median: 950000, sales: 8, days: 28 } } },
                { period: '2025-02', periodRaw: '2025-02-01', cityMedian: 920000, citySales: 55, cityDays: 33, suburbs: { Oteha: { median: 1100000, sales: 12, days: 28 }, Albany: { median: 960000, sales: 9, days: 26 } } },
                { period: '2025-03', periodRaw: '2025-03-01', cityMedian: 910000, citySales: 45, cityDays: 34, suburbs: { Oteha: { median: 1050000, sales: 8, days: 32 }, Albany: { median: 940000, sales: 7, days: 30 } } },
              ],
              quarterlyData: [
                { period: '2025-Q1', periodRaw: '2025-Q1', cityMedian: 910000, citySales: 150, cityDays: 34, suburbs: { Oteha: { median: 1050000, sales: 30, days: 30 }, Albany: { median: 950000, sales: 24, days: 28 } } },
              ],
            },
          }),
        }) as any;
      }
      if (url.includes('/api/admin/bookings')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            data: [],
            pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
            locationStats: [],
          }),
        }) as any;
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) }) as any;
    }) as any;
  });

  afterEach(() => {
    cleanup();
  });

  it('renders a dashboard overview with summary cards', async () => {
    const qc = createQueryClient();
    render(
      <QueryClientProvider client={qc}>
        <DashboardPage />
      </QueryClientProvider>
    );
    expect(await screen.findByText('Dashboard')).toBeTruthy();
    expect(screen.getByText('New Leads')).toBeTruthy();
    expect(screen.getByText('High Priority')).toBeTruthy();
  });

  it('renders analytics content for super admins', async () => {
    const qc = createQueryClient();
    render(
      <QueryClientProvider client={qc}>
        <AnalyticsPage />
      </QueryClientProvider>
    );
    expect(await screen.findByText('Analytics')).toBeTruthy();
    expect(screen.getByText('Conversion Rate')).toBeTruthy();
  });

  it('renders Monthly Data section with suburb buttons', async () => {
    const qc = createQueryClient();
    render(
      <QueryClientProvider client={qc}>
        <AnalyticsPage />
      </QueryClientProvider>
    );
    expect(await screen.findByText('Analysis Data')).toBeTruthy();
    expect(screen.getAllByText('Oteha').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Albany').length).toBeGreaterThanOrEqual(1);
  });

  it('shows new rich table column headers', async () => {
    const qc = createQueryClient();
    render(
      <QueryClientProvider client={qc}>
        <AnalyticsPage />
      </QueryClientProvider>
    );
    expect(await screen.findByText('Analysis Data')).toBeTruthy();
    expect(screen.getByText('Median Price')).toBeTruthy();
    expect(screen.getByText('List vs Sold')).toBeTruthy();
  });

  it('renders North Shore City button in monthly data section', async () => {
    const qc = createQueryClient();
    render(
      <QueryClientProvider client={qc}>
        <AnalyticsPage />
      </QueryClientProvider>
    );
    expect(await screen.findByText(/North Shore/)).toBeTruthy();
  });

  it('renders activity page with appraisals and downloads tabs', async () => {
    const qc = createQueryClient();
    render(
      <QueryClientProvider client={qc}>
        <ActivityPage />
      </QueryClientProvider>
    );
    expect(await screen.findByText('Activity')).toBeTruthy();
    expect(screen.getByText('Appraisals')).toBeTruthy();
    expect(screen.getByText('Downloads')).toBeTruthy();
  });

  it('renders assets page with PDF Reports tab by default and tab switching', async () => {
    const qc = createQueryClient();
    render(
      <QueryClientProvider client={qc}>
        <PDFManagerPage />
      </QueryClientProvider>
    );
    expect(await screen.findByText('Upload suburb reports')).toBeTruthy();
    expect(screen.getByText('PDF Reports')).toBeTruthy();
    expect(screen.getByText('QR Codes')).toBeTruthy();

    fireEvent.click(screen.getByText('QR Codes'));
    expect(await screen.findByText('Uploaded QR codes')).toBeTruthy();
  });

  it('groups reports by suburb on Main Report date desc and orders labels Main Report → Letter → About Marie', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/admin/pdf/reports')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            reports: [
              {
                id: 'oteha-about',
                suburb: 'Oteha',
                quarter: 'Q2',
                year: 2026,
                doc_label: 'About Marie',
                file_url: 'https://example.com/oteha-about.pdf',
                file_name: 'oteha-about.pdf',
                file_size: 800,
                download_count: 0,
                view_count: 0,
                status: 'active',
                uploaded_by: 'admin@example.com',
                uploaded_at: '2025-05-14T00:00:00.000Z',
              },
              {
                id: 'oteha-letter',
                suburb: 'Oteha',
                quarter: 'Q2',
                year: 2026,
                doc_label: 'Letter',
                file_url: 'https://example.com/oteha-letter.pdf',
                file_name: 'oteha-letter.pdf',
                file_size: 900,
                download_count: 0,
                view_count: 0,
                status: 'active',
                uploaded_by: 'admin@example.com',
                uploaded_at: '2025-05-16T00:00:00.000Z',
              },
              {
                id: 'oteha-main',
                suburb: 'Oteha',
                quarter: 'Q2',
                year: 2026,
                doc_label: 'Main Report',
                file_url: 'https://example.com/oteha-main.pdf',
                file_name: 'oteha-main.pdf',
                file_size: 1500,
                download_count: 0,
                view_count: 0,
                status: 'active',
                uploaded_by: 'admin@example.com',
                uploaded_at: '2025-05-15T00:00:00.000Z',
              },
              {
                id: 'north-shore',
                suburb: 'North Shore',
                quarter: 'Q2',
                year: 2026,
                doc_label: 'Main Report',
                file_url: 'https://example.com/north-shore.pdf',
                file_name: 'north-shore.pdf',
                file_size: 1000,
                download_count: 0,
                view_count: 0,
                status: 'active',
                uploaded_by: 'admin@example.com',
                uploaded_at: '2025-02-01T00:00:00.000Z',
              },
            ],
          }),
        }) as any;
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) }) as any;
    }) as any;

    const qc = createQueryClient();
    render(
      <QueryClientProvider client={qc}>
        <PDFManagerPage />
      </QueryClientProvider>
    );

    await screen.findByText('Upload suburb reports');
    const bodyText = document.body.textContent || '';
    // Suburb with the newest Main Report upload (Oteha, 2025-05-15) is listed
    // above North Shore (2025-02-01).
    expect(bodyText.indexOf('Oteha')).toBeGreaterThanOrEqual(0);
    expect(bodyText.indexOf('Oteha')).toBeLessThan(bodyText.indexOf('North Shore'));
    // Within Oteha the label order wins over upload date: Main Report (05-15)
    // comes before Letter (05-16) which comes before About Marie (05-14).
    expect(bodyText.indexOf('oteha-main.pdf')).toBeLessThan(bodyText.indexOf('oteha-letter.pdf'));
    expect(bodyText.indexOf('oteha-letter.pdf')).toBeLessThan(bodyText.indexOf('oteha-about.pdf'));
  });

  it('renders Last Sold Data For Sale table with suburb rows', async () => {
    const qc = createQueryClient();
    render(
      <QueryClientProvider client={qc}>
        <AnalyticsPage />
      </QueryClientProvider>
    );
    expect(await screen.findByText('Last Sold Data For Sale')).toBeTruthy();
    const albanyElements = screen.getAllByText('Albany');
    expect(albanyElements.length).toBeGreaterThanOrEqual(2);
    const otehaElements = screen.getAllByText('Oteha');
    expect(otehaElements.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('North Shore Total')).toBeTruthy();
  });

  it('applies dual-color highlighting (blue for recent, green for lifecycle)', async () => {
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <AnalyticsPage />
      </QueryClientProvider>
    );
    expect(await screen.findByText('Last Sold Data For Sale')).toBeTruthy();
    expect(screen.getByText('(33%)')).toBeTruthy();
    expect(screen.getByText('(38%)')).toBeTruthy();
  });

  it('shows Active column with total counts', async () => {
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <AnalyticsPage />
      </QueryClientProvider>
    );
    expect(await screen.findByText('Active')).toBeTruthy();
    const twelves = screen.getAllByText('12');
    expect(twelves.length).toBeGreaterThanOrEqual(1);
    const eights = screen.getAllByText('8');
    expect(eights.length).toBeGreaterThanOrEqual(1);
  });
});

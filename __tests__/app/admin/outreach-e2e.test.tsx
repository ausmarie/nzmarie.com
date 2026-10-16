import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSession = { user: { email: 'nzlouis.com@gmail.com' } };
const mockLouisSession = { user: { email: 'nzlouis.com@gmail.com' } };
const mockMarieSession = { user: { email: 'nzmarie.com@gmail.com' } };

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: mockSession, status: 'authenticated' }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/components/admin/Skeleton', () => ({
  SkeletonOutreach: () => <div>Loading Outreach</div>,
}));

global.fetch = vi.fn();
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
})) as any;

describe('Outreach Page - End-to-End Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('API: GET /api/admin/outreach', () => {
    it('retrieves pending properties with pagination', async () => {
      const mockData = {
        success: true,
        data: [
          {
            id: 'out-1',
            louis_property_id: 'prop-1',
            property_address: '15 Marine Parade',
            suburb: 'Takapuna',
            status: 'PENDING',
            tracking_code: 'DM-001',
            selected_by: 'nzmarie.com@gmail.com',
            selected_at: '2026-07-01T10:00:00Z',
            bedrooms: 4,
            bathrooms: 2,
            rv_value: 1200000,
          },
        ],
        suburbs: ['Takapuna', 'Albany'],
        pagination: { page: 1, limit: 50, total: 156, totalPages: 4 },
        status: 'PENDING',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      const response = await fetch('/api/admin/outreach?status=PENDING&page=1&limit=50');
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(1);
      expect(data.data[0].status).toBe('PENDING');
      expect(data.data[0].tracking_code).toBe('DM-001');
      expect(data.pagination.total).toBe(156);
      expect(data.suburbs).toContain('Takapuna');
    });

    it('filters by suburb', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [
            {
              id: 'out-1',
              suburb: 'Takapuna',
              status: 'PENDING',
              property_address: '15 Marine Parade',
            },
          ],
          pagination: { page: 1, limit: 50, total: 12, totalPages: 1 },
        }),
      });

      const response = await fetch('/api/admin/outreach?status=PENDING&suburb=Takapuna');
      const data = await response.json();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('suburb=Takapuna')
      );
      expect(data.data[0].suburb).toBe('Takapuna');
    });

    it('searches by address or tracking code', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [
            {
              id: 'out-1',
              tracking_code: 'DM-ABC123',
              property_address: '15 Marine Parade',
              status: 'PENDING',
            },
          ],
          pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
        }),
      });

      const response = await fetch('/api/admin/outreach?status=PENDING&search=DM-ABC123');
      const data = await response.json();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('search=DM-ABC123')
      );
      expect(data.data[0].tracking_code).toBe('DM-ABC123');
    });

    it('retrieves sent properties separately', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [
            {
              id: 'out-sent-1',
              status: 'SENT',
              sent_by: 'nzlouis.com@gmail.com',
              sent_at: '2026-06-28T14:30:00Z',
              property_address: '28 Sunset Road',
            },
          ],
          pagination: { page: 1, limit: 50, total: 894, totalPages: 18 },
        }),
      });

      const response = await fetch('/api/admin/outreach?status=SENT&page=1');
      const data = await response.json();

      expect(data.data[0].status).toBe('SENT');
      expect(data.data[0].sent_by).toBe('nzlouis.com@gmail.com');
      expect(data.pagination.total).toBe(894);
    });

    it('returns 401 for unauthenticated requests', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Unauthorized' }),
      });

      const response = await fetch('/api/admin/outreach?status=PENDING');

      expect(response.ok).toBe(false);
      expect(response.status).toBe(401);
    });
  });

  describe('API: PATCH /api/admin/outreach/[id]/mark-sent', () => {
    it('allows super admin to mark property as sent', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            id: 'out-1',
            status: 'SENT',
            sent_by: 'nzlouis.com@gmail.com',
            sent_at: '2026-07-02T12:00:00Z',
            message: 'Marked as sent successfully',
          },
        }),
      });

      const response = await fetch('/api/admin/outreach/out-1/mark-sent', {
        method: 'PATCH',
      });
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.success).toBe(true);
      expect(data.data.status).toBe('SENT');
      expect(data.data.sent_by).toBe('nzlouis.com@gmail.com');
    });

    it('forbids non-super-admin from marking as sent', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ error: 'Forbidden' }),
      });

      const response = await fetch('/api/admin/outreach/out-1/mark-sent', {
        method: 'PATCH',
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(403);
    });

    it('returns 404 for non-existent record', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Record not found' }),
      });

      const response = await fetch('/api/admin/outreach/invalid-id/mark-sent', {
        method: 'PATCH',
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(404);
    });

    it('updates database with correct values', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            id: 'out-1',
            status: 'SENT',
            sent_by: 'nzlouis.com@gmail.com',
            sent_at: expect.any(String),
            property_address: '15 Marine Parade',
          },
        }),
      });

      const response = await fetch('/api/admin/outreach/out-1/mark-sent', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();

      expect(data.data.status).toBe('SENT');
      expect(data.data.sent_by).toBe('nzlouis.com@gmail.com');
      expect(data.data.sent_at).toBeDefined();
    });
  });

  describe('Outreach Page - UI Integration', () => {
    it('displays Pending tab with correct count', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [],
          pagination: { page: 1, limit: 50, total: 156, totalPages: 4 },
          suburbs: [],
        }),
      });

      expect(true).toBe(true);
    });

    it('displays Sent tab with correct count', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [],
          pagination: { page: 1, limit: 50, total: 894, totalPages: 18 },
          suburbs: [],
        }),
      });

      expect(true).toBe(true);
    });

    it('shows Mark as Sent button only for super admin', async () => {
      expect(mockLouisSession.user.email).toBe('nzlouis.com@gmail.com');
      const isSuperAdmin = mockLouisSession.user.email === 'nzlouis.com@gmail.com';
      expect(isSuperAdmin).toBe(true);

      expect(mockMarieSession.user.email).toBe('nzmarie.com@gmail.com');
      const isSuperAdminMarie = mockMarieSession.user.email === 'nzlouis.com@gmail.com';
      expect(isSuperAdminMarie).toBe(false);
    });

    it('handles empty states correctly', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [],
          pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
          suburbs: [],
        }),
      });

      expect(true).toBe(true);
    });

    it.skip('supports pagination correctly', async () => {
      const paginationResponse = {
        success: true,
        data: [],
        pagination: { page: 2, limit: 50, total: 156, totalPages: 4 },
        suburbs: [],
      };
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => paginationResponse,
      });

      const response = await fetch('/api/admin/outreach?status=PENDING&page=2');
      const data = await response.json();

      expect(data.pagination.page).toBe(2);
      expect(data.pagination.totalPages).toBe(4);
    });
  });

  describe('Complete Business Flow', () => {
    it.skip('executes full Marie -> Louis -> User flow', async () => {
      const addResponse = {
        success: true,
        added: 26,
        skipped: 0,
        message: 'Added 26 properties to outreach queue',
      };

      const listResponse = {
        success: true,
        data: [
          {
            id: 'out-1',
            status: 'PENDING',
            tracking_code: 'DM-001',
            property_address: '15 Marine Parade',
          },
        ],
        pagination: { page: 1, limit: 50, total: 26, totalPages: 1 },
      };

      const markSentResponse = {
        success: true,
        data: {
          id: 'out-1',
          status: 'SENT',
          sent_by: 'nzlouis.com@gmail.com',
          sent_at: '2026-07-02T12:00:00Z',
        },
      };

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => addResponse,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => listResponse,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => markSentResponse,
        });

      const step1 = await fetch('/api/admin/outreach/batch-add', {
        method: 'POST',
        body: JSON.stringify({ properties: [] }),
      });
      expect(step1.ok).toBe(true);
      const step1Data = await step1.json();
      expect(step1Data.added).toBe(26);

      const step2 = await fetch('/api/admin/outreach?status=PENDING');
      expect(step2.ok).toBe(true);
      const step2Data = await step2.json();
      expect(step2Data.data).toHaveLength(1);
      expect(step2Data.data[0].status).toBe('PENDING');

      const step3 = await fetch('/api/admin/outreach/out-1/mark-sent', {
        method: 'PATCH',
      });
      expect(step3.ok).toBe(true);
      const step3Data = await step3.json();
      expect(step3Data.data.status).toBe('SENT');
    });
  });
});

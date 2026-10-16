import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { GET } from '@/app/api/cron/refresh-outreach-mv/route';
import { marieDB } from '@/lib/db';

vi.mock('@/lib/db', () => ({
  marieDB: {
    query: vi.fn(),
  },
}));

describe('Cron MV Refresh GET /api/cron/refresh-outreach-mv', () => {
  const OLD_CRON_SECRET = process.env.CRON_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'test-secret';
  });

  afterAll(() => {
    process.env.CRON_SECRET = OLD_CRON_SECRET;
  });

  it('returns 401 without auth header', async () => {
    const response = await GET(new Request('http://localhost:3000/api/cron/refresh-outreach-mv'));
    expect(response.status).toBe(401);
  });

  it('returns 401 with wrong auth header', async () => {
    const response = await GET(new Request('http://localhost:3000/api/cron/refresh-outreach-mv', {
      headers: { Authorization: 'Bearer wrong-secret' },
    }));
    expect(response.status).toBe(401);
  });

  it('refreshes MV with correct auth', async () => {
    vi.mocked(marieDB.query).mockResolvedValue({ rows: [] } as any);

    const response = await GET(new Request('http://localhost:3000/api/cron/refresh-outreach-mv', {
      headers: { Authorization: 'Bearer test-secret' },
    }));

    expect(response.status).toBe(200);
    expect(marieDB.query).toHaveBeenCalledWith(
      'REFRESH MATERIALIZED VIEW CONCURRENTLY outreach_enriched'
    );
    expect(marieDB.query).toHaveBeenCalledWith(
      'REFRESH MATERIALIZED VIEW mv_suburb_quarter_summary'
    );
    expect(marieDB.query).toHaveBeenCalledWith(
      'REFRESH MATERIALIZED VIEW mv_quarter_overview'
    );
    expect(marieDB.query).toHaveBeenCalledWith(
      'REFRESH MATERIALIZED VIEW mv_dispatch_timeline'
    );
  });

  it('returns 500 on db error', async () => {
    vi.mocked(marieDB.query).mockRejectedValueOnce(new Error('DB error'));

    const response = await GET(new Request('http://localhost:3000/api/cron/refresh-outreach-mv', {
      headers: { Authorization: 'Bearer test-secret' },
    }));

    expect(response.status).toBe(500);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Live-region check against the real CockroachDB instance. These are skipped
// automatically when DATABASE_URL is not configured so CI stays hermetic.
const hasDb = !!process.env.DATABASE_URL;

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/permissions', () => ({ isAdmin: vi.fn() }));
vi.mock('@/lib/campaign-tracker', () => ({ ensureCampaignTablesExist: vi.fn() }));

import { auth } from '@/lib/auth';
import { isAdmin } from '@/lib/permissions';
import { GET } from '../../../app/api/admin/dashboard/stats/route';

describe.skipIf(!hasDb)('dashboard stats against the live database', () => {
  beforeEach(() => {
    vi.mocked(auth).mockResolvedValue({ user: { email: 'admin@test.com' } } as any);
    vi.mocked(isAdmin).mockReturnValue(true);
  });

  it('keeps Total Sent identical to the quarter overview totals', async () => {
    const { marieDB } = await import('@/lib/db');

    const overview = await marieDB.query<{ total_sent: string }>(
      'SELECT total_sent FROM mv_quarter_overview'
    );
    const expectedTotal = overview.rows.reduce((sum, row) => sum + Number(row.total_sent || 0), 0);

    const res = await GET(new Request('http://localhost/api/admin/dashboard/stats?part=summary'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.part).toBe('summary');
    // The headline number must never disagree with the quarter cards.
    expect(body.stats.sentSummary.total_sent).toBe(expectedTotal);
    const quarterlyTotal = body.stats.sentSummary.quarterly.reduce(
      (sum: number, q: { total_sent: number }) => sum + q.total_sent,
      0
    );
    expect(quarterlyTotal).toBe(expectedTotal);
  }, 30000);
});

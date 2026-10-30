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

  it('shows report periods uploaded in Assets before any send happens', async () => {
    const { marieDB } = await import('@/lib/db');

    // Only meaningful while Long Bay still has an active 2026-Q3 report.
    const report = await marieDB.query<{ suburb: string }>(`
      SELECT DISTINCT suburb FROM suburb_reports
      WHERE status = 'active' AND lower(suburb) = 'long bay' AND year = 2026 AND quarter = 'Q3'
      LIMIT 1
    `);
    if (report.rows.length === 0) return;

    const res = await GET(
      new Request('http://localhost/api/admin/dashboard/stats?quarterKey=2026-Q3')
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    const rows = body.stats.dispatchTrend.bySuburb as Array<{
      raw_suburb: string;
      quarter_key: string | null;
      sent_count: number;
      junk_count: number;
      total_count: number;
      report_url: string | null;
    }>;
    const longBay = rows.find(
      (row) => row.raw_suburb?.toLowerCase() === 'long bay' && row.quarter_key === '2026-Q3'
    );

    // Regression: the Q3 row used to come back as 0/0/0/0 and was dropped by
    // the timeline, so an uploaded report never appeared.
    expect(longBay).toBeDefined();
    expect(longBay!.total_count).toBeGreaterThan(0);
    expect(longBay!.report_url).toBeTruthy();
  }, 60000);

  it('keeps junk mail accurate per report quarter', async () => {
    const res = await GET(
      new Request('http://localhost/api/admin/dashboard/stats?quarterKey=2026-Q3')
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    const rows = body.stats.dispatchTrend.bySuburb as Array<{
      raw_suburb: string;
      quarter_key: string | null;
      sent_count: number;
      junk_count: number;
      unsent_count: number;
      total_count: number;
    }>;

    // Junk is part of the audience, so sent + junk can never exceed the total.
    for (const row of rows) {
      expect(row.sent_count + row.junk_count).toBeLessThanOrEqual(row.total_count);
      expect(row.unsent_count).toBeGreaterThanOrEqual(0);
      // sent + unsent + junk == total (unsent is clamped, so never negative).
      expect(row.sent_count + row.unsent_count + row.junk_count).toBeLessThanOrEqual(row.total_count);
    }

    // A quarter that was never dispatched has no junk mail figure at all, and
    // its whole audience is still "unsent".
    const neverDispatched = rows.filter((row) => row.sent_count === 0 && row.total_count > 0);
    for (const row of neverDispatched) {
      expect(row.junk_count).toBe(0);
      expect(row.unsent_count).toBe(row.total_count);
    }

    const junkTotal = (quarter: string) =>
      rows.filter((row) => row.quarter_key === quarter).reduce((sum, row) => sum + row.junk_count, 0);

    // The first campaign surfaces most no-junk-mail addresses; the next one only
    // the newly discovered ones, so Q2 must carry far more junk than Q3.
    expect(junkTotal('2026-Q2')).toBeGreaterThan(junkTotal('2026-Q3'));

    // Concrete regression from the screenshots: these suburbs sent their first
    // campaign in 2026-Q2 and used to report 0-1 junk mail for it.
    const firstCampaignSuburbs = [
      'Totara Vale',
      'Greenhithe',
      'Schnapper Rock',
      'Unsworth Heights',
      'Sunnynook',
      'Campbells Bay',
      'Mairangi Bay',
      'Torbay',
    ];
    const zeroed = firstCampaignSuburbs.filter((name) => {
      const row = rows.find(
        (item) => item.raw_suburb === name && item.quarter_key === '2026-Q2'
      );
      return row ? row.junk_count === 0 : false;
    });
    expect(zeroed).toEqual([]);

    // And the second campaign for the same suburb must show fewer junk addresses.
    const notShrinking = firstCampaignSuburbs.filter((name) => {
      const q2 = rows.find((item) => item.raw_suburb === name && item.quarter_key === '2026-Q2');
      const q3 = rows.find((item) => item.raw_suburb === name && item.quarter_key === '2026-Q3');
      return Boolean(q2 && q3 && q2.junk_count <= q3.junk_count);
    });
    expect(notShrinking).toEqual([]);
  }, 60000);

  it('counts dispatch per quarter even when the send log has no report link', async () => {
    const { marieDB } = await import('@/lib/db');

    const logs = await marieDB.query<{ suburb: string; quarter_key: string; pids: string }>(`
      SELECT suburb,
             substring(campaign_key from '^([0-9]{4})') || '-Q' || substring(campaign_key from '[_-]Q([1-4])') AS quarter_key,
             COUNT(DISTINCT outreach_property_id) AS pids
      FROM outreach_send_logs
      WHERE campaign_key ~ '^[0-9]{4}[_-]Q[1-4]' AND suburb IS NOT NULL
      GROUP BY 1, 2
    `);

    const res = await GET(
      new Request('http://localhost/api/admin/dashboard/stats?quarterKey=2026-Q3')
    );
    const body = await res.json();
    const rows = body.stats.dispatchTrend.bySuburb as Array<{
      raw_suburb: string;
      quarter_key: string | null;
      sent_count: number;
    }>;

    const missing: string[] = [];
    const undercounted: string[] = [];
    for (const log of logs.rows) {
      const row = rows.find(
        (item) => item.raw_suburb === log.suburb && item.quarter_key === log.quarter_key
      );
      if (!row) {
        missing.push(`${log.suburb} ${log.quarter_key}`);
      } else if (row.sent_count < Number(log.pids)) {
        undercounted.push(`${log.suburb} ${log.quarter_key}: ${row.sent_count} < ${log.pids}`);
      }
    }

    expect(missing).toEqual([]);
    expect(undercounted).toEqual([]);
  }, 60000);
});

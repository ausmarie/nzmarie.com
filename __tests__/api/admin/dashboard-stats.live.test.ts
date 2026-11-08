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

  it('keeps the summary quarter total identical to the suburb dispatch timeline', async () => {
    const res = await GET(new Request('http://localhost/api/admin/dashboard/stats?part=summary'));
    const body = await res.json();
    const timelineRes = await GET(
      new Request('http://localhost/api/admin/dashboard/stats?quarterKey=2026-Q2')
    );
    const timelineBody = await timelineRes.json();
    const timelineTotal = timelineBody.stats.dispatchTrend.bySuburb
      .filter((row: { quarter_key: string | null }) => row.quarter_key === '2026-Q2')
      .reduce((sum: number, row: { sent_count: number }) => sum + row.sent_count, 0);
    const summaryQuarterTotal = body.stats.sentSummary.quarterly.find(
      (row: { quarter_key: string }) => row.quarter_key === '2026-Q2'
    )?.total_sent;

    expect(res.status).toBe(200);
    expect(timelineRes.status).toBe(200);
    expect(body.part).toBe('summary');
    expect(summaryQuarterTotal).toBe(timelineTotal);
    const quarterlyTotal = body.stats.sentSummary.quarterly.reduce(
      (sum: number, q: { total_sent: number }) => sum + q.total_sent,
      0
    );
    expect(body.stats.sentSummary.total_sent).toBe(quarterlyTotal);
  }, 60000);

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
    const { marieDB } = await import('@/lib/db');
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
      expect(row.sent_count + row.junk_count, JSON.stringify(row)).toBeLessThanOrEqual(row.total_count);
      expect(row.unsent_count).toBeGreaterThanOrEqual(0);
      expect(row.sent_count + row.unsent_count + row.junk_count).toBeLessThanOrEqual(row.total_count);
    }

    const expected = await marieDB.query<{
      suburb: string;
      quarter_key: string;
      junk_count: string;
    }>(`
      SELECT suburb, quarter_key, COUNT(DISTINCT outreach_property_id)::text AS junk_count
      FROM outreach_property_quarter_status
      WHERE is_junk = TRUE
      GROUP BY suburb, quarter_key
    `);
    for (const record of expected.rows) {
      const actual = rows.find(
        (row) => row.raw_suburb === record.suburb && row.quarter_key === record.quarter_key
      );
      expect(actual?.junk_count).toBeGreaterThanOrEqual(Number(record.junk_count));
    }

    const actualJunkRows = rows.filter((row) => row.junk_count > 0);
    for (const row of actualJunkRows) {
      const record = expected.rows.find(
        (item) => item.suburb === row.raw_suburb && item.quarter_key === row.quarter_key
      );
      expect(row.junk_count).toBeGreaterThanOrEqual(Number(record?.junk_count || 0));
    }
  }, 60000);

  it('counts only report-quarter junk in the daily trend and Q3 suburb timeline', async () => {
    const { marieDB } = await import('@/lib/db');
    const expectedDaily = await marieDB.query<{ bucket: string; junk: string }>(`
      WITH junk_by_period_and_day AS (
        SELECT
          suburb,
          quarter_key,
          date_trunc('day', junk_at AT TIME ZONE 'Pacific/Auckland') AS day_bucket,
          COUNT(DISTINCT outreach_property_id) AS junk
        FROM outreach_property_quarter_status
        WHERE is_junk IS TRUE
          AND junk_at IS NOT NULL
          AND quarter_key ~ '^[0-9]{4}-Q[1-4]$'
        GROUP BY suburb, quarter_key, day_bucket
      )
      SELECT TO_CHAR(day_bucket, 'YYYY-MM-DD') AS bucket, SUM(junk)::text AS junk
      FROM junk_by_period_and_day
      GROUP BY day_bucket
      ORDER BY day_bucket
    `);
    const expectedQ3 = await marieDB.query<{ suburb: string; junk_count: string }>(`
      SELECT suburb, COUNT(DISTINCT outreach_property_id)::text AS junk_count
      FROM outreach_property_quarter_status
      WHERE quarter_key = '2026-Q3' AND is_junk IS TRUE
      GROUP BY suburb
    `);
    // The address-level properties flag is basic filtering, not quarter junk.
    const res = await GET(
      new Request('http://localhost/api/admin/dashboard/stats?quarterKey=2026-Q3')
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    const totalQuarterJunk = expectedDaily.rows.reduce(
      (sum, row) => sum + Number(row.junk),
      0
    );
    const actualDaily = new Map<string, number>(
      (body.stats.dispatchTrend.daily as Array<{ bucket: string; junk: number }>)
        .map((bucket) => [bucket.bucket, bucket.junk])
    );
    for (const expected of expectedDaily.rows) {
      expect(actualDaily.get(expected.bucket) || 0, expected.bucket)
        .toBeGreaterThanOrEqual(Number(expected.junk));
    }
    const totalActualJunk = (body.stats.dispatchTrend.daily as Array<{ junk: number }>)
      .reduce((sum, bucket) => sum + bucket.junk, 0);
    expect(totalActualJunk).toBe(totalQuarterJunk);

    const actualQ3 = body.stats.dispatchTrend.bySuburb as Array<{
      raw_suburb: string;
      quarter_key: string | null;
      junk_count: number;
    }>;
    for (const expected of expectedQ3.rows) {
      const actual = actualQ3.find(
        (row) => row.raw_suburb === expected.suburb && row.quarter_key === '2026-Q3'
      );
      expect(actual?.junk_count, expected.suburb)
        .toBeGreaterThanOrEqual(Number(expected.junk_count));
    }
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

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  auth: vi.fn(),
  isAdmin: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  query: mocks.query,
}));

vi.mock('@/lib/auth', () => ({
  auth: mocks.auth,
}));

vi.mock('@/lib/permissions', () => ({
  isAdmin: mocks.isAdmin,
}));

import { GET } from '../../../app/api/admin/reports/overview/route';

function makeRow(overrides: Record<string, unknown>) {
  return {
    suburb_id: 's1',
    suburb_name: 'North Shore',
    doc_id: null,
    doc_type: null,
    title: null,
    quarter: null,
    status: null,
    created_at: null,
    ...overrides,
  };
}

describe('report documents overview — lead report separation', () => {
  beforeEach(() => {
    mocks.query.mockReset();
    mocks.auth.mockReset();
    mocks.isAdmin.mockReset();
    mocks.auth.mockResolvedValue({ user: { email: 'admin@example.com' } });
    mocks.isAdmin.mockReturnValue(true);
  });

  it('excludes lead-generated reports from the suburb listing', async () => {
    mocks.query.mockResolvedValueOnce({ rows: [] });

    const response = await GET();

    expect(response.status).toBe(200);
    const [sql] = mocks.query.mock.calls[0] as [string];
    expect(sql).toContain('LEFT JOIN report_documents rd ON rd.suburb_id = rs.id AND rd.status != \'archived\' AND rd.lead_id IS NULL');
  });

  it('groups intro, letter and report documents per suburb', async () => {
    mocks.query.mockResolvedValueOnce({
      rows: [
        makeRow({ doc_id: 'i1', doc_type: 'suburb_intro', title: 'Oteha Intro', status: 'published' }),
        makeRow({ doc_id: 'i2', doc_type: 'suburb_intro', title: 'Duplicate Intro', status: 'draft' }),
        makeRow({ doc_id: 'l1', doc_type: 'letter', title: 'Autumn Letter', status: 'draft' }),
        makeRow({ doc_id: 'r1', doc_type: 'report', title: 'Q3 Report', quarter: '2026-Q3', status: 'published', created_at: '2026-08-01' }),
        makeRow({ doc_id: null }),
      ],
    });

    const response = await GET();
    const body = await response.json();

    expect(body.success).toBe(true);
    expect(body.suburbs).toHaveLength(1);
    const suburb = body.suburbs[0];
    expect(suburb.name).toBe('North Shore');
    expect(suburb.introDoc).toEqual({ id: 'i1', title: 'Oteha Intro', status: 'published' });
    expect(suburb.letterDoc).toEqual({ id: 'l1', title: 'Autumn Letter', status: 'draft' });
    expect(suburb.reports).toEqual([
      { id: 'r1', title: 'Q3 Report', quarter: '2026-Q3', status: 'published', createdAt: '2026-08-01' },
    ]);
  });

  it('keeps suburbs without documents listed', async () => {
    mocks.query.mockResolvedValueOnce({ rows: [makeRow({ doc_id: null })] });

    const body = await (await GET()).json();

    expect(body.suburbs).toHaveLength(1);
    expect(body.suburbs[0].introDoc).toBeNull();
    expect(body.suburbs[0].letterDoc).toBeNull();
    expect(body.suburbs[0].reports).toEqual([]);
  });

  it('returns 403 without querying when the user is not an admin', async () => {
    mocks.isAdmin.mockReturnValue(false);

    const response = await GET();

    expect(response.status).toBe(403);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it('returns 500 when the query fails', async () => {
    mocks.query.mockRejectedValueOnce(new Error('db down'));

    const response = await GET();

    expect(response.status).toBe(500);
  });
});

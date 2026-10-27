import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockQuery = vi.hoisted(() => vi.fn());
const mockAuth = vi.hoisted(() => vi.fn());
const mockIsAdmin = vi.hoisted(() => vi.fn());
const mockMatchProperty = vi.hoisted(() => vi.fn());

vi.mock('@/lib/db', () => ({
  marieDB: { query: mockQuery },
}));

vi.mock('@/lib/auth', () => ({
  auth: mockAuth,
}));

vi.mock('@/lib/permissions', () => ({
  isAdmin: mockIsAdmin,
}));

vi.mock('@/lib/lead-property', () => ({
  matchPropertyIdByAddress: mockMatchProperty,
}));

import { POST } from '../../../app/api/admin/appraisal-alerts/[id]/convert/route';

function appraisalRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'appraisal-1',
    client_name: 'Margaret McDonald',
    property_address: '4 Carnmore Place, Torbay, Auckland 0630',
    suburb: 'Torbay',
    region: 'Auckland',
    city: 'Auckland',
    email: 'owner@example.com',
    phone: '0211234567',
    timeline: 'just-exploring',
    priority: 'medium',
    priority_source: 'auto',
    motivation: null,
    language_preference: null,
    heard_from: null,
    lead_id: null,
    ...overrides,
  };
}

function convertRequest() {
  return new Request('http://localhost/api/admin/appraisal-alerts/appraisal-1/convert', {
    method: 'POST',
  });
}

async function runConvert(row: Record<string, unknown>) {
  mockQuery
    .mockResolvedValueOnce({ rows: [row] })
    .mockResolvedValueOnce({ rows: [{ id: 'lead-1' }] })
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [] });

  const res = await POST(convertRequest(), { params: Promise.resolve({ id: 'appraisal-1' }) });
  const body = await res.json();
  const insertCall = mockQuery.mock.calls.find(([sql]) =>
    String(sql).includes('INSERT INTO leads')
  );
  return { res, body, insertCall };
}

describe('POST /api/admin/appraisal-alerts/[id]/convert — priority', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { email: 'admin@test.com' } });
    mockIsAdmin.mockReturnValue(true);
    mockMatchProperty.mockResolvedValue('prop-1');
  });

  it('uses the timeline mapping for auto priorities', async () => {
    const { res, body, insertCall } = await runConvert(appraisalRow());

    expect(res.status).toBe(200);
    expect(body.leadId).toBe('lead-1');
    // params: address, propertyId, suburb, city, region, name, email, phone, priority, summary, notes
    expect(insertCall?.[1][8]).toBe('low');
    expect(insertCall?.[1][9]).toContain('Just exploring');
  });

  it('honours a manual priority override', async () => {
    const { res, insertCall } = await runConvert(
      appraisalRow({ priority: 'high', priority_source: 'manual' })
    );

    expect(res.status).toBe(200);
    expect(insertCall?.[1][8]).toBe('high');
  });

  it('derives high priority for within-3-months', async () => {
    const { insertCall } = await runConvert(
      appraisalRow({ timeline: 'within-3-months', priority: 'medium' })
    );

    expect(insertCall?.[1][8]).toBe('high');
  });
});

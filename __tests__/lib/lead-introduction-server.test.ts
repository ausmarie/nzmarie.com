import { describe, it, expect, vi, beforeEach } from 'vitest';
import { query as marieQuery } from '@/lib/db';
import { ensureAllLeadIntroductions, ensureLeadIntroduction } from '@/lib/lead-introduction-server';

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
}));

const leadRow = {
  lead_id: 'lead-1',
  address: '2/65 Target Road',
  suburb: 'Totara Vale',
  city: 'North Shore City',
  region: 'Auckland',
  bedrooms: '3',
  bathrooms: '1',
  car_spaces: '2',
  floor_size: '140.0',
  land_area: null,
  land_area_numeric: null,
  property_type: 'Residential',
  year_built: '1990',
  capital_value: 940000,
  land_value: 660000,
  improvement_value: 280000,
  estimated_value_low: 800000,
  estimated_value_high: 900000,
  last_sold_price: 360000,
  last_sold_date: '2008-08-25T12:00:00.000Z',
  has_rental_history: true,
  is_currently_rented: false,
  description: 'A well presented home.',
  property_history: JSON.stringify([{ date: '26/08/2008', type: 'SOLD', price: '$360,000' }]),
};

describe('lead introduction server helper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns an existing introduction without inserting another document', async () => {
    vi.mocked(marieQuery).mockResolvedValueOnce({ rows: [{ id: 'intro-existing' }] } as never);

    await expect(ensureLeadIntroduction('lead-1', 'admin-1')).resolves.toBe('intro-existing');
    expect(marieQuery).toHaveBeenCalledTimes(1);
  });

  it('creates a lead introduction document from the lead and property data', async () => {
    vi.mocked(marieQuery)
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [leadRow] } as never)
      .mockResolvedValueOnce({ rows: [{ id: 'intro-new' }] } as never);

    await expect(ensureLeadIntroduction('lead-1', 'admin-1')).resolves.toBe('intro-new');

    const insertCall = vi.mocked(marieQuery).mock.calls[2];
    const sql = String(insertCall[0]);
    const params = insertCall[1] as unknown[];
    expect(sql).toContain("'lead_intro'");
    expect(params[0]).toBe('admin-1');
    expect(params[1]).toBe('2/65 Target Road Introduction');
    expect(params[3]).toBe('lead-1');

    const content = JSON.parse(String(params[2])) as unknown[];
    expect(JSON.stringify(content)).toContain('2/65 Target Road');
    expect(JSON.stringify(content)).toContain('Address History');
  });

  it('returns null when the lead does not exist', async () => {
    vi.mocked(marieQuery)
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [] } as never);

    await expect(ensureLeadIntroduction('missing', 'admin-1')).resolves.toBeNull();
    expect(vi.mocked(marieQuery).mock.calls.some(([sql]) => String(sql).includes('INSERT INTO report_documents'))).toBe(false);
  });

  it('backfills introductions for every lead that is missing one', async () => {
    vi.mocked(marieQuery)
      .mockResolvedValueOnce({ rows: [{ id: 'lead-1' }, { id: 'lead-2' }] } as never)
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [leadRow] } as never)
      .mockResolvedValueOnce({ rows: [{ id: 'intro-1' }] } as never)
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [{ ...leadRow, lead_id: 'lead-2', address: '11 Honour Avenue' }] } as never)
      .mockResolvedValueOnce({ rows: [{ id: 'intro-2' }] } as never);

    await expect(ensureAllLeadIntroductions('admin-1')).resolves.toBe(2);
  });
});

import { describe, expect, it } from 'vitest';
import { dedupeLeadsByAddress } from '@/lib/dedupe-leads-by-address';

describe('dedupeLeadsByAddress', () => {
  it('keeps the first lead for an address despite case, punctuation, and whitespace differences', () => {
    const newest = { id: 'newest', property_address: '13 Carberry Lane', created_at: '2026-10-05' };
    const duplicate = { id: 'duplicate', property_address: ' 13 CARBERRY LANE. ', created_at: '2026-10-01' };

    expect(dedupeLeadsByAddress([newest, duplicate])).toEqual([newest]);
  });

  it('keeps leads without an address instead of treating them as duplicates', () => {
    const leads = [
      { id: 'missing-1', property_address: '' },
      { id: 'missing-2', property_address: null },
      { id: 'addressed', property_address: '13 Carberry Lane' },
    ];

    expect(dedupeLeadsByAddress(leads)).toEqual(leads);
  });
});

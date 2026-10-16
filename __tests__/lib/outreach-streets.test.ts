import { describe, it, expect } from 'vitest';
import {
  resolveAddressStatus,
  mergeAddressStatus,
  buildStreetSummaries,
  AddressRow,
} from '@/lib/outreach-streets';

describe('outreach-streets status resolution & deduplication', () => {
  describe('resolveAddressStatus', () => {
    it('resolves to sent when sent is true even if no_junk_mail is true', () => {
      expect(resolveAddressStatus({ sent: true, no_junk_mail: true })).toBe('sent');
      expect(resolveAddressStatus({ sent: true, no_junk_mail: false })).toBe('sent');
      expect(resolveAddressStatus({ status: 'sent', no_junk_mail: true })).toBe('sent');
    });

    it('resolves to junk when not sent and no_junk_mail is true', () => {
      expect(resolveAddressStatus({ sent: false, no_junk_mail: true })).toBe('junk');
      expect(resolveAddressStatus({ no_junk_mail: true })).toBe('junk');
    });

    it('resolves to unsent when not sent and no_junk_mail is false or absent', () => {
      expect(resolveAddressStatus({ sent: false, no_junk_mail: false })).toBe('unsent');
      expect(resolveAddressStatus({})).toBe('unsent');
    });
  });

  describe('mergeAddressStatus', () => {
    it('prioritizes sent over junk and unsent', () => {
      expect(mergeAddressStatus('unsent', 'sent')).toBe('sent');
      expect(mergeAddressStatus('sent', 'unsent')).toBe('sent');
      expect(mergeAddressStatus('junk', 'sent')).toBe('sent');
      expect(mergeAddressStatus('sent', 'junk')).toBe('sent');
    });

    it('prioritizes junk over unsent', () => {
      expect(mergeAddressStatus('unsent', 'junk')).toBe('junk');
      expect(mergeAddressStatus('junk', 'unsent')).toBe('junk');
    });

    it('retains same status when merging identical values', () => {
      expect(mergeAddressStatus('sent', 'sent')).toBe('sent');
      expect(mergeAddressStatus('junk', 'junk')).toBe('junk');
      expect(mergeAddressStatus('unsent', 'unsent')).toBe('unsent');
    });
  });

  describe('buildStreetSummaries', () => {
    it('deduplicates multiple rows for the same property address and assigns single sent status', () => {
      const rows: AddressRow[] = [
        {
          id: '1',
          street: 'Helen Ryburn Place',
          property_address: '26 Helen Ryburn Place',
          house_number: 26,
          lat: -36.70333,
          lng: 174.72455,
          no_junk_mail: true,
          sent: false,
          status: 'pending',
        },
        {
          id: '2',
          street: 'Helen Ryburn Place',
          property_address: '26 Helen Ryburn Place',
          house_number: 26,
          lat: -36.70333,
          lng: 174.72455,
          no_junk_mail: false,
          sent: true,
          status: 'sent',
        },
        {
          id: '3',
          street: 'Helen Ryburn Place',
          property_address: '26 Helen Ryburn Place',
          house_number: 26,
          lat: -36.70333,
          lng: 174.72455,
          no_junk_mail: false,
          sent: false,
          status: 'pending',
        },
      ];

      const summaries = buildStreetSummaries(rows, 'Torbay', true);
      expect(summaries).toHaveLength(1);
      expect(summaries[0].addressCoords).toHaveLength(1);
      expect(summaries[0].addressCoords![0]).toEqual({
        address: '26 Helen Ryburn Place',
        lat: -36.70333,
        lng: 174.72455,
        sent: true,
        status: 'sent',
      });
    });

    it('assigns yellow junk for no_junk_mail and red unsent for plain pending', () => {
      const rows: AddressRow[] = [
        {
          id: '1',
          street: 'Helen Ryburn Place',
          property_address: '21 Helen Ryburn Place',
          house_number: 21,
          lat: -36.703,
          lng: 174.724,
          no_junk_mail: true,
          sent: false,
          status: 'pending',
        },
        {
          id: '2',
          street: 'Helen Ryburn Place',
          property_address: '28 Helen Ryburn Place',
          house_number: 28,
          lat: -36.704,
          lng: 174.725,
          no_junk_mail: false,
          sent: false,
          status: 'pending',
        },
      ];

      const summaries = buildStreetSummaries(rows, 'Torbay', true);
      expect(summaries[0].addressCoords).toHaveLength(2);
      expect(summaries[0].addressCoords![0].status).toBe('junk');
      expect(summaries[0].addressCoords![1].status).toBe('unsent');
    });
  });
});

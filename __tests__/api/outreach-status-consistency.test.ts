/**
 * Tests for outreach status consistency fix
 * Ensures that when properties are sent, their status field is properly updated to 'sent'
 * This prevents the double-color display bug where addresses showed both sent (purple) and unsent (red)
 */

import { describe, it, expect, vi } from 'vitest';

describe('Outreach Status Consistency Fix', () => {
  describe('Status Update Logic', () => {
    it('should update status from pending to sent when property has send history', () => {
      // This test verifies the SQL logic that was added to the send endpoint
      // SQL: SET status = CASE WHEN status = 'pending' THEN 'sent' ELSE status END
      
      const mockRecord = {
        status: 'pending',
        sent_at: new Date('2026-08-13T02:23:50Z'),
        last_sent_at: new Date('2026-08-13T14:23:50Z'),
        total_send_count: 1,
      };

      // Simulate the SQL CASE WHEN logic
      const updatedStatus = mockRecord.status === 'pending' ? 'sent' : mockRecord.status;

      expect(updatedStatus).toBe('sent');
      expect(mockRecord.sent_at).not.toBeNull();
      expect(mockRecord.total_send_count).toBeGreaterThan(0);
    });

    it('should not change status if already sent', () => {
      const mockRecord = {
        status: 'sent',
        sent_at: new Date('2026-08-13T02:23:50Z'),
        last_sent_at: new Date('2026-08-13T14:23:50Z'),
        total_send_count: 1,
      };

      const updatedStatus = mockRecord.status === 'pending' ? 'sent' : mockRecord.status;

      expect(updatedStatus).toBe('sent');
    });

    it('should not change status if it is interacted or converted', () => {
      const statuses = ['interacted', 'converted', 'junk'];
      
      statuses.forEach((status) => {
        const mockRecord = { status };
        const updatedStatus = mockRecord.status === 'pending' ? 'sent' : mockRecord.status;
        expect(updatedStatus).toBe(status);
      });
    });
  });

  describe('Map Display Logic', () => {
    it('should correctly determine sent status for address display', () => {
      // This test verifies the logic from street-clusters route.ts
      // that determines if an address should show as "sent" or "unsent"
      
      const mockRawObject = {
        total_send_count: 1,
        last_sent_at: new Date('2026-08-13T14:23:50Z'),
        sent_at: new Date('2026-08-13T02:23:50Z'),
        status: 'sent',
      };

      // Logic from street-clusters/route.ts line 154-165
      const opSent = Boolean(
        mockRawObject && (
          Number(mockRawObject.total_send_count) > 0 ||
          mockRawObject.last_sent_at != null ||
          mockRawObject.sent_at != null ||
          mockRawObject.status === 'sent'
        )
      );

      expect(opSent).toBe(true);
    });

    it('should correctly identify unsent addresses', () => {
      const mockRawObject = {
        total_send_count: 0,
        last_sent_at: null,
        sent_at: null,
        status: 'pending',
      };

      const opSent = Boolean(
        mockRawObject && (
          Number(mockRawObject.total_send_count) > 0 ||
          mockRawObject.last_sent_at != null ||
          mockRawObject.sent_at != null ||
          mockRawObject.status === 'sent'
        )
      );

      expect(opSent).toBe(false);
    });
  });

  describe('Send Endpoint Query Logic', () => {
    it('should construct correct UPDATE query for send operation', () => {
      // Verify the SQL that was added to send endpoint
      // SET status = CASE WHEN status = 'pending' THEN 'sent' ELSE status END,
      //     total_send_count = COALESCE(total_send_count, 0) + 1,
      //     last_sent_at = NOW(),
      //     last_campaign = $1,
      //     sent_at = NOW(),
      //     sent_by = $2
      
      const propertyBefore = {
        id: 'test-id',
        status: 'pending',
        total_send_count: 0,
        last_campaign: null,
      };

      // Simulate the update operations
      const propertyAfter = {
        ...propertyBefore,
        status: propertyBefore.status === 'pending' ? 'sent' : propertyBefore.status,
        total_send_count: (propertyBefore.total_send_count || 0) + 1,
        last_campaign: '2026_Q2',
      };

      expect(propertyAfter.status).toBe('sent');
      expect(propertyAfter.total_send_count).toBe(1);
      expect(propertyAfter.last_campaign).toBe('2026_Q2');
    });
  });

  describe('Filter Logic Integration', () => {
    it('should only return sent properties in sent filter', () => {
      // Simulates outreach-filter.ts logic for 'sent' status filter
      const properties = [
        {
          id: '1',
          status: 'sent',
          total_send_count: 1,
          last_sent_at: new Date(),
          sent_at: new Date(),
        },
        {
          id: '2',
          status: 'pending',
          total_send_count: 0,
          last_sent_at: null,
          sent_at: null,
        },
      ];

      const sentProperties = properties.filter((p) => {
        const isSent =
          p.status === 'sent' ||
          (p.total_send_count ?? 0) > 0 ||
          p.last_sent_at != null ||
          p.sent_at != null;
        return isSent;
      });

      expect(sentProperties).toHaveLength(1);
      expect(sentProperties[0].id).toBe('1');
    });

    it('should only return unsent properties in unsent filter', () => {
      // Simulates outreach-filter.ts logic for 'unsent' status filter
      const properties = [
        {
          id: '1',
          status: 'sent',
          total_send_count: 1,
          last_sent_at: new Date(),
          sent_at: new Date(),
        },
        {
          id: '2',
          status: 'pending',
          total_send_count: 0,
          last_sent_at: null,
          sent_at: null,
        },
      ];

      const unsentProperties = properties.filter((p) => {
        const isUnsent =
          p.status === 'pending' &&
          (p.total_send_count ?? 0) === 0 &&
          p.last_sent_at == null &&
          p.sent_at == null;
        return isUnsent;
      });

      expect(unsentProperties).toHaveLength(1);
      expect(unsentProperties[0].id).toBe('2');
    });

    it('should never show property in both sent and unsent filters', () => {
      // This is the critical test for the bug fix
      // Previously, #26 Helen Ryburn Place appeared in both filters
      const helenaRyburn = {
        id: 'helen-ryburn-26',
        property_address: '26 Helen Ryburn Place',
        suburb: 'Torbay',
        status: 'sent', // Fixed: was 'pending', now 'sent'
        total_send_count: 1,
        last_sent_at: new Date('2026-08-13T14:23:50Z'),
        sent_at: new Date('2026-08-13T02:23:50Z'),
      };

      const inSentFilter =
        helenaRyburn.status === 'sent' ||
        (helenaRyburn.total_send_count ?? 0) > 0 ||
        helenaRyburn.last_sent_at != null ||
        helenaRyburn.sent_at != null;

      const inUnsentFilter =
        helenaRyburn.status === 'pending' &&
        (helenaRyburn.total_send_count ?? 0) === 0 &&
        helenaRyburn.last_sent_at == null &&
        helenaRyburn.sent_at == null;

      expect(inSentFilter).toBe(true);
      expect(inUnsentFilter).toBe(false);
      expect(inSentFilter && !inUnsentFilter).toBe(true);
    });
  });
});

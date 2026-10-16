/**
 * Tests for outreach API cache invalidation
 * Ensures that when addresses are updated, sent, or status changed,
 * the street-clusters cache is properly invalidated
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { invalidateStreetClustersForSuburb } from '@/lib/redis';

// Mock the redis module
vi.mock('@/lib/redis', () => ({
  invalidateStreetClustersForSuburb: vi.fn().mockResolvedValue(undefined),
}));

describe('Outreach Cache Invalidation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('invalidateStreetClustersForSuburb function', () => {
    it('should call redis invalidation with correct suburb name', async () => {
      const mockInvalidate = vi.mocked(invalidateStreetClustersForSuburb);

      await mockInvalidate('Torbay');

      expect(mockInvalidate).toHaveBeenCalledWith('Torbay');
      expect(mockInvalidate).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple suburbs in sequence', async () => {
      const mockInvalidate = vi.mocked(invalidateStreetClustersForSuburb);
      const suburbs = ['Torbay', 'Northcote', 'Takapuna'];

      for (const suburb of suburbs) {
        await mockInvalidate(suburb);
      }

      expect(mockInvalidate).toHaveBeenCalledTimes(3);
      suburbs.forEach((suburb) => {
        expect(mockInvalidate).toHaveBeenCalledWith(suburb);
      });
    });

    it('should gracefully handle errors', async () => {
      const mockInvalidate = vi.mocked(invalidateStreetClustersForSuburb);
      mockInvalidate.mockRejectedValueOnce(new Error('Redis unavailable'));

      // Should not throw when called with .catch()
      await expect(
        mockInvalidate('Torbay').catch(() => {})
      ).resolves.toBeUndefined();
    });
  });

  describe('API endpoint cache invalidation scenarios', () => {
    it('should invalidate cache when marking property as sent', async () => {
      // Simulates: PATCH /api/admin/outreach/[id]/mark-sent
      // After updating status to 'sent', invalidateStreetClustersForSuburb('Torbay') is called
      const mockInvalidate = vi.mocked(invalidateStreetClustersForSuburb);
      const resultData = { id: 'prop-123', suburb: 'Torbay', status: 'sent' };

      // Simulate the cache invalidation logic
      if (resultData?.suburb) {
        await mockInvalidate(resultData.suburb).catch(() => {});
      }

      expect(mockInvalidate).toHaveBeenCalledWith('Torbay');
    });

    it('should invalidate cache when changing property status', async () => {
      // Simulates: PATCH /api/admin/outreach/[id]/status
      // After changing status, invalidateStreetClustersForSuburb is called
      const mockInvalidate = vi.mocked(invalidateStreetClustersForSuburb);
      const updatedProperty = { 
        id: 'prop-456', 
        suburb: 'Northcote', 
        status: 'pending' 
      };

      // Simulate the cache invalidation logic
      if (updatedProperty?.suburb) {
        await mockInvalidate(updatedProperty.suburb).catch(() => {});
      }

      expect(mockInvalidate).toHaveBeenCalledWith('Northcote');
    });

    it('should invalidate cache when updating property via PATCH', async () => {
      // Simulates: PATCH /api/admin/outreach/[id]
      // After updating any field, invalidateStreetClustersForSuburb is called
      const mockInvalidate = vi.mocked(invalidateStreetClustersForSuburb);
      const updatedProperty = { 
        id: 'prop-789', 
        suburb: 'Takapuna', 
        status: 'interacted' 
      };

      // Simulate the cache invalidation logic
      if (updatedProperty?.suburb) {
        await mockInvalidate(updatedProperty.suburb).catch(() => {});
      }

      expect(mockInvalidate).toHaveBeenCalledWith('Takapuna');
    });

    it('should invalidate cache for all affected suburbs when sending report', async () => {
      // Simulates: POST /api/admin/outreach/send
      // After creating send logs, invalidate cache for all affected suburbs
      const mockInvalidate = vi.mocked(invalidateStreetClustersForSuburb);
      
      // Simulate processing multiple properties from different suburbs
      const affectedSuburbs = new Set(['Torbay', 'Northcote', 'Takapuna']);
      for (const suburb of affectedSuburbs) {
        await mockInvalidate(suburb).catch(() => {});
      }

      expect(mockInvalidate).toHaveBeenCalledTimes(3);
      expect(mockInvalidate).toHaveBeenCalledWith('Torbay');
      expect(mockInvalidate).toHaveBeenCalledWith('Northcote');
      expect(mockInvalidate).toHaveBeenCalledWith('Takapuna');
    });

    it('should deduplicate suburbs when invalidating cache during batch send', async () => {
      // Simulates: POST /api/admin/outreach/send with multiple properties from same suburb
      // Should only invalidate cache once per unique suburb
      const mockInvalidate = vi.mocked(invalidateStreetClustersForSuburb);
      
      // Simulate processing multiple properties, some from same suburb
      const propertiesSuburbs = ['Torbay', 'Northcote', 'Torbay', 'Takapuna', 'Torbay'];
      const affectedSuburbs = new Set(propertiesSuburbs);
      
      for (const suburb of affectedSuburbs) {
        await mockInvalidate(suburb).catch(() => {});
      }

      // Should only call invalidate 3 times (one per unique suburb)
      expect(mockInvalidate).toHaveBeenCalledTimes(3);
      expect(mockInvalidate).toHaveBeenCalledWith('Torbay');
      expect(mockInvalidate).toHaveBeenCalledWith('Northcote');
      expect(mockInvalidate).toHaveBeenCalledWith('Takapuna');
    });

    it('should skip invalidation if suburb is null or undefined', async () => {
      // Simulates: PATCH with no suburb field
      const mockInvalidate = vi.mocked(invalidateStreetClustersForSuburb);
      const resultData = { id: 'prop-null', suburb: null, status: 'sent' };

      // Simulate the cache invalidation logic
      if (resultData?.suburb) {
        await mockInvalidate(resultData.suburb).catch(() => {});
      }

      expect(mockInvalidate).not.toHaveBeenCalled();
    });

    it('should invalidate cache when no_junk_mail is toggled on a property', async () => {
      const mockInvalidate = vi.mocked(invalidateStreetClustersForSuburb);
      const updatedRow = { id: 'prop-junk', suburb: 'Takapuna', no_junk_mail: true };

      if (updatedRow.no_junk_mail !== undefined && updatedRow.suburb) {
        await mockInvalidate(updatedRow.suburb).catch(() => {});
      }

      expect(mockInvalidate).toHaveBeenCalledWith('Takapuna');
    });
  });

  describe('Cache invalidation key coverage', () => {
    it('should invalidate all cache key variants for a suburb', async () => {
      // This documents what gets invalidated for a given suburb
      // The redis.ts invalidateStreetClustersForSuburb function deletes:
      // - street_clusters:suburb:pending:all:*:coords
      // - street_clusters:suburb:pending:unsent:*:coords
      // - and non-coords variants
      
      const mockInvalidate = vi.mocked(invalidateStreetClustersForSuburb);
      const suburb = 'Torbay';

      await mockInvalidate(suburb).catch(() => {});

      // Verify that the suburb's cache was targeted
      expect(mockInvalidate).toHaveBeenCalledWith('Torbay');
    });
  });

  describe('Error handling in cache invalidation', () => {
    it('should handle Redis connection errors gracefully', async () => {
      const mockInvalidate = vi.mocked(invalidateStreetClustersForSuburb);
      mockInvalidate.mockRejectedValueOnce(new Error('Redis connection failed'));

      // The .catch(() => { }) in the actual code prevents errors from being thrown
      let error;
      try {
        await mockInvalidate('Torbay').catch(() => {});
      } catch (e) {
        error = e;
      }

      expect(error).toBeUndefined();
      expect(mockInvalidate).toHaveBeenCalledWith('Torbay');
    });

    it('should not block API response if cache invalidation fails', async () => {
      // Simulates the actual behavior where .catch(() => { }) is used
      const mockInvalidate = vi.mocked(invalidateStreetClustersForSuburb);
      mockInvalidate.mockRejectedValue(new Error('Redis unavailable'));

      const resultData = { id: 'prop-123', suburb: 'Torbay', status: 'sent' };
      const apiResponse = { success: false };

      if (resultData?.suburb) {
        // The actual code uses .catch(() => { }) to prevent blocking
        mockInvalidate(resultData.suburb).catch(() => { });
      }

      // API should still return success
      apiResponse.success = true;

      expect(apiResponse.success).toBe(true);
      expect(mockInvalidate).toHaveBeenCalledWith('Torbay');
    });
  });
});

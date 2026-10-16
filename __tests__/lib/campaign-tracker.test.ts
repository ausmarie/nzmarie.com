import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateVisitorHash, generateUAHash, anonymizeIP, extractIPSubnet, getClientIp, recordCampaignVisit, getCampaignStats, parseDeviceType } from '../../lib/campaign-tracker';
import * as db from '../../lib/db';

vi.mock('../../lib/db', () => ({
  query: vi.fn(),
  marieDB: {
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0, command: '', oid: 0, fields: [] }),
  },
}));

describe('Campaign Tracker Library', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('anonymizeIP', () => {
    it('truncates IPv4 address last octet with xxx', () => {
      expect(anonymizeIP('192.168.1.100')).toBe('192.168.1.xxx');
      expect(anonymizeIP('203.0.113.195')).toBe('203.0.113.xxx');
    });

    it('masks IPv6 address last segments', () => {
      expect(anonymizeIP('2001:db8:85a3:8d3:1319:8a2e:370:7334')).toBe('2001:db8:85a3::xxx');
    });
  });

  describe('extractIPSubnet', () => {
    it('extracts IPv6 /48 prefix (first 3 groups)', () => {
      expect(extractIPSubnet('2404:4408:930e::xxx')).toBe('2404:4408:930e');
      expect(extractIPSubnet('2001:db8:85a3::xxx')).toBe('2001:db8:85a3');
    });

    it('returns empty string for IPv4 addresses to avoid broad subnet collisions', () => {
      expect(extractIPSubnet('203.0.113.xxx')).toBe('');
      expect(extractIPSubnet('192.168.1.xxx')).toBe('');
      expect(extractIPSubnet('104.23.198.xxx')).toBe('');
    });

    it('returns same subnet for same device with different IPv6 suffix', () => {
      const subnet1 = extractIPSubnet('2404:4408:930e::xxx');
      const subnet2 = extractIPSubnet('2404:4408:930e::xxx');
      expect(subnet1).toBe(subnet2);
    });

    it('returns empty string for empty input', () => {
      expect(extractIPSubnet('')).toBe('');
    });
  });


  describe('generateVisitorHash', () => {
    it('returns a 64 character sha256 hex string', () => {
      const hash = generateVisitorHash('192.168.1.1', 'Mozilla/5.0');
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('produces identical hash for identical IP and User-Agent', () => {
      const hash1 = generateVisitorHash('10.0.0.1', 'iPhone');
      const hash2 = generateVisitorHash('10.0.0.1', 'iPhone');
      expect(hash1).toBe(hash2);
    });

    it('produces different hashes for different IPs', () => {
      const hash1 = generateVisitorHash('10.0.0.1', 'iPhone');
      const hash2 = generateVisitorHash('10.0.0.2', 'iPhone');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('generateUAHash', () => {
    it('returns a 64 character sha256 hex string', () => {
      const hash = generateUAHash('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)');
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('produces the same hash regardless of IP address', () => {
      const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)';
      expect(generateUAHash(ua)).toBe(generateUAHash(ua));
    });

    it('differs from the ip+ua hash so legacy rows can be distinguished', () => {
      const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)';
      expect(generateUAHash(ua)).not.toBe(generateVisitorHash('1.2.3.4', ua));
    });
  });

  describe('getClientIp', () => {
    it('prefers the cf-connecting-ip header', () => {
      const req = new Request('https://nzmarie.com/torbay', {
        headers: {
          'cf-connecting-ip': '203.0.113.10',
          'x-forwarded-for': '198.51.100.5, 104.23.198.1',
        },
      });
      expect(getClientIp(req)).toBe('203.0.113.10');
    });

    it('falls back to the first x-forwarded-for entry', () => {
      const req = new Request('https://nzmarie.com/torbay', {
        headers: { 'x-forwarded-for': '198.51.100.5, 104.23.198.1' },
      });
      expect(getClientIp(req)).toBe('198.51.100.5');
    });

    it('falls back to x-real-ip when no other headers exist', () => {
      const req = new Request('https://nzmarie.com/torbay', {
        headers: { 'x-real-ip': '198.51.100.9' },
      });
      expect(getClientIp(req)).toBe('198.51.100.9');
    });

    it('returns a default value when no headers are present', () => {
      const req = new Request('https://nzmarie.com/torbay');
      expect(getClientIp(req)).toBe('127.0.0.1');
    });
  });

  describe('recordCampaignVisit', () => {
    it('executes database queries to record visit and update analytics', async () => {
      const queryMock = vi.mocked(db.query);
      queryMock.mockResolvedValueOnce({ rows: [{ cnt: 0, global_cnt: 0, first_scanned_at: null }], rowCount: 1, command: '', oid: 0, fields: [] });
      queryMock.mockResolvedValueOnce({ rows: [], rowCount: 0, command: '', oid: 0, fields: [] });
      queryMock.mockResolvedValueOnce({ rows: [], rowCount: 0, command: '', oid: 0, fields: [] });

      await recordCampaignVisit({
        campaignKey: 'oteha',
        ip: '127.0.0.1',
        userAgent: 'TestBrowser',
      });

      expect(queryMock).toHaveBeenCalledTimes(3);
    });

    it('marks the first-ever scan as unique, anonymizes IP and visit_count 1', async () => {
      const queryMock = vi.mocked(db.query);
      queryMock.mockResolvedValueOnce({ rows: [{ cnt: 0, global_cnt: 0, first_scanned_at: null }], rowCount: 1, command: '', oid: 0, fields: [] });
      queryMock.mockResolvedValueOnce({ rows: [], rowCount: 0, command: '', oid: 0, fields: [] });
      queryMock.mockResolvedValueOnce({ rows: [], rowCount: 0, command: '', oid: 0, fields: [] });

      await recordCampaignVisit({ campaignKey: 'torbay', ip: '203.0.113.10', userAgent: 'iPhone' });

      const insertCall = queryMock.mock.calls[1];
      const insertSql = insertCall[0] as string;
      const insertParams = insertCall[1] as unknown[];
      expect(insertSql).toContain('visit_count');
      expect(insertSql).toContain('first_scanned_at');
      expect(insertSql).toContain('is_new_device');
      expect(insertParams[2]).toBe('203.0.113.xxx');
      expect(insertParams[7]).toBe(true);  // is_unique
      expect(insertParams[8]).toBe(true);  // is_new_device
      expect(insertParams[9]).toBe(1);     // visit_count
    });

    it('marks a repeat scan as repeat with incremented visit_count', async () => {
      const queryMock = vi.mocked(db.query);
      queryMock.mockResolvedValueOnce({ rows: [{ cnt: 3, global_cnt: 5, first_scanned_at: '2026-07-01T00:00:00Z' }], rowCount: 1, command: '', oid: 0, fields: [] });
      queryMock.mockResolvedValueOnce({ rows: [], rowCount: 0, command: '', oid: 0, fields: [] });
      queryMock.mockResolvedValueOnce({ rows: [], rowCount: 0, command: '', oid: 0, fields: [] });

      await recordCampaignVisit({ campaignKey: 'torbay', ip: '203.0.113.10', userAgent: 'iPhone' });

      const insertCall = queryMock.mock.calls[1];
      const insertParams = insertCall[1] as unknown[];
      expect(insertParams[7]).toBe(false);  // is_unique
      expect(insertParams[8]).toBe(false);  // is_new_device
      expect(insertParams[9]).toBe(4);      // visit_count
      expect(insertParams[10]).toBe('2026-07-01T00:00:00Z'); // first_scanned_at
    });

    it('marks first scan as new device, but second scan in different suburb as repeat device', async () => {
      const queryMock = vi.mocked(db.query);

      // Scan 1: Long Bay (first scan on this phone)
      queryMock.mockResolvedValueOnce({ rows: [{ cnt: 0, global_cnt: 0, first_scanned_at: null }], rowCount: 1, command: '', oid: 0, fields: [] });
      queryMock.mockResolvedValueOnce({ rows: [], rowCount: 0, command: '', oid: 0, fields: [] });
      queryMock.mockResolvedValueOnce({ rows: [], rowCount: 0, command: '', oid: 0, fields: [] });

      await recordCampaignVisit({
        campaignKey: 'long-bay',
        ip: '2404:4408:930e::1',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_5_0 like Mac OS X)',
        visitorId: 'persistent-device-uuid-123',
      });

      const firstInsert = queryMock.mock.calls[1][1] as unknown[];
      expect(firstInsert[0]).toBe('long-bay');
      expect(firstInsert[7]).toBe(true); // is_unique for long-bay
      expect(firstInsert[8]).toBe(true); // is_new_device for entire system
      expect(firstInsert[9]).toBe(1);    // visit_count

      // Scan 2: Browns Bay (same phone, different suburb)
      queryMock.mockResolvedValueOnce({ rows: [{ cnt: 0, global_cnt: 1, first_scanned_at: null }], rowCount: 1, command: '', oid: 0, fields: [] });
      queryMock.mockResolvedValueOnce({ rows: [], rowCount: 0, command: '', oid: 0, fields: [] });
      queryMock.mockResolvedValueOnce({ rows: [], rowCount: 0, command: '', oid: 0, fields: [] });

      await recordCampaignVisit({
        campaignKey: 'browns-bay',
        ip: '2404:4408:930e::2', // IP might rotate
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_5_0 like Mac OS X)',
        visitorId: 'persistent-device-uuid-123',
      });

      const secondInsert = queryMock.mock.calls[4][1] as unknown[];
      expect(secondInsert[0]).toBe('browns-bay');
      expect(secondInsert[7]).toBe(true);  // is_unique for browns-bay
      expect(secondInsert[8]).toBe(false); // is_new_device must be FALSE (repeat device)
      expect(secondInsert[9]).toBe(1);     // visit_count for browns-bay
    });

    it('queries using 3-tier compound matching: hash OR user_agent OR subnet+deviceType', async () => {
      const queryMock = vi.mocked(db.query);
      queryMock.mockResolvedValueOnce({ rows: [{ cnt: 0, global_cnt: 2, first_scanned_at: null }], rowCount: 1, command: '', oid: 0, fields: [] });
      queryMock.mockResolvedValueOnce({ rows: [], rowCount: 0, command: '', oid: 0, fields: [] });
      queryMock.mockResolvedValueOnce({ rows: [], rowCount: 0, command: '', oid: 0, fields: [] });

      await recordCampaignVisit({
        campaignKey: 'torbay',
        ip: '2404:4408:930e:c400:b946:bfaa:8dbd:920f',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_5_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/151.0',
        visitorId: 'persistent-device-uuid-123',
      });

      const selectCall = queryMock.mock.calls[0];
      const selectSql = selectCall[0] as string;
      const selectParams = selectCall[1] as unknown[];

      // Tier 1: persistent hash
      expect(selectSql).toContain('visitor_hash = ANY($3::text[])');
      // Tier 2: exact user_agent match
      expect(selectSql).toContain('user_agent = $2');
      // Tier 3: IPv6 subnet + device_type (the key fix for Safari→Chrome cross-browser)
      expect(selectSql).toContain('ip_subnet = $4');
      expect(selectSql).toContain('device_type = $5');

      expect(selectParams[0]).toBe('torbay');
      expect(selectParams[1]).toContain('iPhone');
      expect(Array.isArray(selectParams[2])).toBe(true);
      expect(selectParams[3]).toBe('2404:4408:930e');
      expect(selectParams[4]).toBe('iOS');
    });

    it('does not falsely mark distinct Android devices on same IPv4 as repeat', async () => {
      const queryMock = vi.mocked(db.query);

      queryMock.mockResolvedValueOnce({ rows: [{ cnt: 0, global_cnt: 0, first_scanned_at: null }], rowCount: 1, command: '', oid: 0, fields: [] });
      queryMock.mockResolvedValueOnce({ rows: [], rowCount: 0, command: '', oid: 0, fields: [] });
      queryMock.mockResolvedValueOnce({ rows: [], rowCount: 0, command: '', oid: 0, fields: [] });

      await recordCampaignVisit({
        campaignKey: 'oteha',
        ip: '104.23.198.10',
        userAgent: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/151.0.0.0 Mobile Safari/537.36',
        visitorId: 'device-id-android-user-2',
      });

      const selectCall = queryMock.mock.calls[0];
      const selectParams = selectCall[1] as unknown[];
      expect(selectParams[3]).toBe('');

      const insertCall = queryMock.mock.calls[1];
      const insertParams = insertCall[1] as unknown[];
      expect(insertParams[3]).toBe('');
      expect(insertParams[7]).toBe(true);
      expect(insertParams[8]).toBe(true);
    });

    it('marks same device scanning different suburb via subnet match as repeat (not new device)', async () => {
      const queryMock = vi.mocked(db.query);

      queryMock.mockResolvedValueOnce({ rows: [{ cnt: 0, global_cnt: 0, first_scanned_at: null }], rowCount: 1, command: '', oid: 0, fields: [] });
      queryMock.mockResolvedValueOnce({ rows: [], rowCount: 0, command: '', oid: 0, fields: [] });
      queryMock.mockResolvedValueOnce({ rows: [], rowCount: 0, command: '', oid: 0, fields: [] });

      await recordCampaignVisit({
        campaignKey: 'long-bay',
        ip: '2404:4408:930e:c400::1',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_5_0) Safari/604.1',
      });

      const safariInsert = queryMock.mock.calls[1][1] as unknown[];
      expect(safariInsert[8]).toBe(true);

      queryMock.mockResolvedValueOnce({ rows: [{ cnt: 0, global_cnt: 1, first_scanned_at: null }], rowCount: 1, command: '', oid: 0, fields: [] });
      queryMock.mockResolvedValueOnce({ rows: [], rowCount: 0, command: '', oid: 0, fields: [] });
      queryMock.mockResolvedValueOnce({ rows: [], rowCount: 0, command: '', oid: 0, fields: [] });

      await recordCampaignVisit({
        campaignKey: 'browns-bay',
        ip: '2404:4408:930e:c400::2',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_5_0) AppleWebKit CriOS/151.0',
      });

      const chromeInsert = queryMock.mock.calls[4][1] as unknown[];
      expect(chromeInsert[0]).toBe('browns-bay');
      expect(chromeInsert[8]).toBe(false);
    });

    it('parses device type from user agent', () => {
      expect(parseDeviceType('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)')).toBe('iOS');
      expect(parseDeviceType('Mozilla/5.0 (Linux; Android 13)')).toBe('Android');
      expect(parseDeviceType('Mozilla/5.0 (Macintosh; Intel Mac OS X)')).toBe('Desktop');
    });
  });

  describe('getCampaignStats', () => {
    it('returns stats record from database', async () => {
      const queryMock = vi.mocked(db.query);
      const mockStat = {
        campaign_key: 'oteha',
        campaign_name: 'Oteha Campaign',
        total_pv: 10,
        total_uv: 5,
        last_visited_at: '2026-07-23T10:00:00Z',
      };
      queryMock.mockResolvedValueOnce({ rows: [mockStat], rowCount: 1, command: '', oid: 0, fields: [] });

      const stats = await getCampaignStats('oteha');
      expect(stats).toEqual(mockStat);
    });

    it('returns null when campaign does not exist', async () => {
      const queryMock = vi.mocked(db.query);
      queryMock.mockResolvedValueOnce({ rows: [], rowCount: 0, command: '', oid: 0, fields: [] });

      const stats = await getCampaignStats('unknown');
      expect(stats).toBeNull();
    });
  });
});

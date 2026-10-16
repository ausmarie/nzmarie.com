import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../../app/api/track-scan/route';

vi.mock('../../lib/campaign-tracker', () => ({
  recordCampaignVisit: vi.fn().mockResolvedValue(undefined),
  getClientIp: vi.fn(() => '203.0.113.195'),
}));

import { recordCampaignVisit } from '../../lib/campaign-tracker';

describe('POST /api/track-scan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects invalid or missing body with 400', async () => {
    const req = new Request('https://www.nzmarie.com/api/track-scan', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Invalid suburb');
  });

  it('records scan for normal suburb like torbay', async () => {
    const req = new Request('https://www.nzmarie.com/api/track-scan', {
      method: 'POST',
      body: JSON.stringify({
        suburb: 'torbay',
        visitorId: 'fp-12345',
        ua: 'Mozilla/5.0 (iPhone)',
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);

    expect(recordCampaignVisit).toHaveBeenCalledWith({
      campaignKey: 'torbay',
      campaignName: 'Torbay',
      ip: '203.0.113.195',
      userAgent: 'Mozilla/5.0 (iPhone)',
      referrer: 'qr_scan',
      visitorId: 'fp-12345',
    });
  });

  it('records scan for suburb with underscore like business_card', async () => {
    const req = new Request('https://www.nzmarie.com/api/track-scan', {
      method: 'POST',
      body: JSON.stringify({
        suburb: 'business_card',
        visitorId: 'fp-card-user',
        ua: 'Mozilla/5.0 (iPhone)',
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);

    expect(recordCampaignVisit).toHaveBeenCalledWith({
      campaignKey: 'business_card',
      campaignName: 'Business Card',
      ip: '203.0.113.195',
      userAgent: 'Mozilla/5.0 (iPhone)',
      referrer: 'qr_scan',
      visitorId: 'fp-card-user',
    });
  });

  it('records scan for hyphenated suburb like long-bay', async () => {
    const req = new Request('https://www.nzmarie.com/api/track-scan', {
      method: 'POST',
      body: JSON.stringify({
        suburb: 'long-bay',
        visitorId: 'fp-long-bay',
        ua: 'Mozilla/5.0 (iPhone)',
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);

    expect(recordCampaignVisit).toHaveBeenCalledWith({
      campaignKey: 'long-bay',
      campaignName: 'Long Bay',
      ip: '203.0.113.195',
      userAgent: 'Mozilla/5.0 (iPhone)',
      referrer: 'qr_scan',
      visitorId: 'fp-long-bay',
    });
  });
});

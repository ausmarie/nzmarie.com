import { describe, it, expect, vi } from 'vitest';
import { GET } from '../../app/oteha/route';

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return {
    ...actual,
    after: vi.fn((fn: () => Promise<void>) => fn()),
  };
});

vi.mock('../../lib/campaign-tracker', () => ({
  recordCampaignVisit: vi.fn().mockResolvedValue(undefined),
  getClientIp: vi.fn(() => '203.0.113.195'),
}));

describe('GET /oteha route handler', () => {
  it('returns immediate 302 redirect to homepage with utm parameters', async () => {
    const req = new Request('https://www.nzmarie.com/oteha', {
      headers: {
        'x-forwarded-for': '203.0.113.195',
        'user-agent': 'Mozilla/5.0 (iPhone)',
      },
    });

    const response = await GET(req);

    expect(response.status).toBe(307);
    const location = response.headers.get('location');
    expect(location).toContain('utm_source=qr');
    expect(location).toContain('utm_campaign=oteha');
  });
});

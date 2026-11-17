import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';

describe('market report URL redirects', () => {
  it('permanently redirects mixed-case published report URLs to lowercase', () => {
    const request = new NextRequest('https://www.nzmarie.com/market-reports/October-2026/cn?utm_source=test');
    const response = middleware(request);

    expect(response.status).toBe(301);
    expect(response.headers.get('location')).toBe(
      'https://www.nzmarie.com/market-reports/october-2026/cn?utm_source=test',
    );
  });

  it('redirects legacy Chinese query URLs to the cacheable localized path', () => {
    const request = new NextRequest('https://www.nzmarie.com/market-reports/october-2026?lang=zh&utm_source=test');
    const response = middleware(request);

    expect(response.status).toBe(301);
    expect(response.headers.get('location')).toBe(
      'https://www.nzmarie.com/market-reports/october-2026/cn?utm_source=test',
    );
  });

  it('returns not found for unsupported public report languages', () => {
    const request = new NextRequest('https://www.nzmarie.com/market-reports/october-2026?lang=fr');

    expect(middleware(request).status).toBe(404);
  });
});

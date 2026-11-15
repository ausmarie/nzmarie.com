import React from 'react';
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PageViewTracker from '@/components/PageViewTracker';

const eventId = 'c0a80123-4567-489a-8abc-0123456789ab';

describe('PageViewTracker', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', { randomUUID: () => eventId });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('sends a non-blocking event with the report language and slug', async () => {
    render(<PageViewTracker pageType="market_report" language="zh" slug="october-2026" />);

    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe('/api/track-page-view');
    expect(options).toMatchObject({
      method: 'POST',
      keepalive: true,
    });
    expect(JSON.parse(String(options?.body))).toEqual({
      eventId,
      pageType: 'market_report',
      language: 'zh',
      slug: 'october-2026',
    });
  });

  it('does not send a duplicate event when the same route rerenders', async () => {
    const { rerender } = render(<PageViewTracker pageType="home" language="en" />);
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());

    rerender(<PageViewTracker pageType="home" language="en" />);

    expect(fetch).toHaveBeenCalledOnce();
  });
});

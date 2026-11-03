import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAppraisalAlerts } from '../../lib/hooks/useAppraisalAlerts';

describe('useAppraisalAlerts', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('shares an in-flight request between initial, focus, and layout refresh triggers', async () => {
    let resolveFetch!: (response: { ok: boolean; json: () => Promise<{ data: [] }> }) => void;
    const fetchPromise = new Promise<{ ok: boolean; json: () => Promise<{ data: [] }> }>((resolve) => {
      resolveFetch = resolve;
    });
    const fetchMock = vi.fn(() => fetchPromise);
    vi.stubGlobal('fetch', fetchMock);

    const { result, unmount } = renderHook(() => useAppraisalAlerts());
    act(() => {
      window.dispatchEvent(new Event('focus'));
      void result.current.refresh();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFetch({ ok: true, json: async () => ({ data: [] }) });
      await fetchPromise;
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => window.dispatchEvent(new Event('focus')));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    unmount();
  });
});

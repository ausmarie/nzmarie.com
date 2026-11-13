import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAppraisalAlerts } from '../../lib/hooks/useAppraisalAlerts';

describe('useAppraisalAlerts', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
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

  it('polls every two minutes only while visible and refreshes on visibility return', async () => {
    vi.useFakeTimers();
    const visibilityState = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { unmount } = renderHook(() => useAppraisalAlerts());
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(119_999);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    visibilityState.mockReturnValue('hidden');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    visibilityState.mockReturnValue('visible');
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);

    unmount();
  });
});

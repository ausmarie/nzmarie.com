import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { useCtrlS } from '@/app/admin/reports/hooks/useCtrlS';

function fireKey(init: KeyboardEventInit) {
  const event = new KeyboardEvent('keydown', { ...init, cancelable: true });
  window.dispatchEvent(event);
  return event;
}

describe('useCtrlS', () => {
  afterEach(() => {
    cleanup();
  });

  it('calls onSave and prevents default on Ctrl+S', () => {
    const onSave = vi.fn();
    renderHook(() => useCtrlS(onSave));

    const event = fireKey({ key: 's', ctrlKey: true });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('calls onSave on Cmd+S (meta key)', () => {
    const onSave = vi.fn();
    renderHook(() => useCtrlS(onSave));

    fireKey({ key: 's', metaKey: true });

    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('does not call onSave for other shortcuts or plain keys', () => {
    const onSave = vi.fn();
    renderHook(() => useCtrlS(onSave));

    fireKey({ key: 'k', ctrlKey: true });
    fireKey({ key: 's' });
    fireKey({ key: 's', ctrlKey: true, shiftKey: true });
    fireKey({ key: 'S', ctrlKey: true, altKey: true });

    expect(onSave).not.toHaveBeenCalled();
  });

  it('removes the listener on unmount', () => {
    const onSave = vi.fn();
    const { unmount } = renderHook(() => useCtrlS(onSave));

    unmount();
    fireKey({ key: 's', ctrlKey: true });

    expect(onSave).not.toHaveBeenCalled();
  });
});
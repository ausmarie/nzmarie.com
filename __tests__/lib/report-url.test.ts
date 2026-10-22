import { afterEach, describe, expect, it, vi } from 'vitest';
import { canonicalizeReportUrl } from '@/lib/report-url';

const UUID = 'a6705439-5ac5-4b98-9efc-d848828dfb5e';

describe('canonicalizeReportUrl', () => {
  afterEach(() => {
    window.history.replaceState({}, '', '/');
  });

  it('replaces a mapped UUID URL without triggering a router navigation', () => {
    const replaceState = vi.fn();
    const applied = canonicalizeReportUrl(
      `/admin/reports/${UUID}`,
      { [UUID]: 'pinehill-q3-2026' },
      { 'pinehill-q3-2026': UUID },
      replaceState
    );

    expect(applied).toBe(true);
    expect(replaceState).toHaveBeenCalledWith('/admin/reports/pinehill-q3-2026');
  });

  it('updates the browser path while keeping the current history entry', () => {
    window.history.replaceState({ marker: 'same-entry' }, '', `/admin/reports/${UUID}`);

    const applied = canonicalizeReportUrl(
      `/admin/reports/${UUID}`,
      { [UUID]: 'pinehill-q3-2026' },
      { 'pinehill-q3-2026': UUID }
    );

    expect(applied).toBe(true);
    expect(window.location.pathname).toBe('/admin/reports/pinehill-q3-2026');
    expect(window.history.state).toEqual({ marker: 'same-entry' });
  });

  it('leaves non-UUID, unmapped, or mismatched URLs untouched', () => {
    const replaceState = vi.fn();

    expect(
      canonicalizeReportUrl('/admin/reports/pinehill-q3-2026', {}, {}, replaceState)
    ).toBe(false);
    expect(
      canonicalizeReportUrl(`/admin/reports/${UUID}`, {}, {}, replaceState)
    ).toBe(false);
    expect(
      canonicalizeReportUrl(
        `/admin/reports/${UUID}`,
        { [UUID]: 'pinehill-q3-2026' },
        { 'pinehill-q3-2026': 'different-id' },
        replaceState
      )
    ).toBe(false);
    expect(replaceState).not.toHaveBeenCalled();
  });
});

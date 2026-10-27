import { describe, it, expect, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import CardCopyToast from '@/app/admin/reports/components/CardCopyToast';
import { CARD_IMAGE_COPIED_EVENT, CARD_IMAGE_FAILED_EVENT } from '@/lib/card-image-copy';

describe('CardCopyToast', () => {
  afterEach(() => cleanup());

  it('renders nothing until a copy event fires', () => {
    const { queryByTestId } = render(<CardCopyToast />);
    expect(queryByTestId('card-copied-toast')).toBeNull();
  });

  it('confirms a successful image copy', () => {
    const { getByTestId } = render(<CardCopyToast />);

    act(() => {
      window.dispatchEvent(new CustomEvent(CARD_IMAGE_COPIED_EVENT));
    });

    const toast = getByTestId('card-copied-toast');
    expect(toast.getAttribute('data-kind')).toBe('success');
    expect(toast.getAttribute('role')).toBe('status');
    expect(toast.textContent).toContain('Card copied as image');
  });

  it('explains the rich-text fallback when the image copy fails', () => {
    const { getByTestId } = render(<CardCopyToast />);

    act(() => {
      window.dispatchEvent(new CustomEvent(CARD_IMAGE_FAILED_EVENT));
    });

    const toast = getByTestId('card-copied-toast');
    expect(toast.getAttribute('data-kind')).toBe('warning');
    expect(toast.textContent).toContain('formatted text');
  });

  it('does not listen for events after unmount', () => {
    const { queryByTestId, unmount } = render(<CardCopyToast />);
    unmount();

    act(() => {
      window.dispatchEvent(new CustomEvent(CARD_IMAGE_COPIED_EVENT));
    });

    expect(queryByTestId('card-copied-toast')).toBeNull();
  });
});

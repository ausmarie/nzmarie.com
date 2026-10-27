'use client';

import { useEffect, useState } from 'react';
import { CARD_IMAGE_COPIED_EVENT, CARD_IMAGE_FAILED_EVENT } from '@/lib/card-image-copy';

type CopyNotice = { kind: 'success' | 'warning'; text: string };

const NOTICE_DURATION_MS = 2600;

const MESSAGES: Record<CopyNotice['kind'], string> = {
  success: 'Card copied as image',
  warning: 'Copied as formatted text — image copy is unavailable in this browser',
};

/**
 * Small confirmation banner shown after a card copy.
 *
 * Kept separate from the editor so the clipboard events can be exercised in
 * isolation, without booting a full BlockNote instance.
 */
export default function CardCopyToast({ duration = NOTICE_DURATION_MS }: { duration?: number }) {
  const [notice, setNotice] = useState<CopyNotice | null>(null);

  useEffect(() => {
    const show = (kind: CopyNotice['kind']) => setNotice({ kind, text: MESSAGES[kind] });
    const handleCopied = () => show('success');
    const handleFailed = () => show('warning');

    window.addEventListener(CARD_IMAGE_COPIED_EVENT, handleCopied);
    window.addEventListener(CARD_IMAGE_FAILED_EVENT, handleFailed);
    return () => {
      window.removeEventListener(CARD_IMAGE_COPIED_EVENT, handleCopied);
      window.removeEventListener(CARD_IMAGE_FAILED_EVENT, handleFailed);
    };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), duration);
    return () => clearTimeout(timer);
  }, [notice, duration]);

  if (!notice) return null;

  return (
    <div
      className="print:hidden"
      data-testid="card-copied-toast"
      data-kind={notice.kind}
      role="status"
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        background: notice.kind === 'success' ? '#065f46' : '#92400e',
        color: 'white',
        padding: '8px 20px',
        borderRadius: 8,
        fontSize: '0.8rem',
        fontWeight: 500,
        boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
        pointerEvents: 'none',
      }}
    >
      {notice.text}
    </div>
  );
}

'use client';

import type { AppraisalAlertItem } from '@/lib/hooks/useAppraisalAlerts';

interface AppraisalAlertBannerProps {
  items: AppraisalAlertItem[];
  onReview: () => void;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('en-NZ', {
    timeZone: 'Pacific/Auckland',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export default function AppraisalAlertBanner({ items, onReview }: AppraisalAlertBannerProps) {
  if (items.length === 0) return null;

  return (
    <div
      className="bg-amber-50 border-b border-amber-300 shadow-sm"
      role="alert"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-white text-xs font-bold">
              {items.length}
            </span>
            <span className="text-sm font-semibold text-amber-900 truncate">
              New appraisal request{items.length > 1 ? 's' : ''}
            </span>
          </div>
          <button
            type="button"
            onClick={onReview}
            className="shrink-0 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors"
          >
            Review
          </button>
        </div>

        <div className={`mt-2 ${items.length > 3 ? 'max-h-32 overflow-y-auto' : ''}`}>
          <ul className="space-y-1">
            {items.map(item => (
              <li key={item.id} className="flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-medium text-amber-950 truncate">{item.client_name}</span>
                  <span className="text-amber-800 truncate hidden sm:inline">{item.email}</span>
                </div>
                <span className="shrink-0 text-xs text-amber-700">{formatTime(item.created_at)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

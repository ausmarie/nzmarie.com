'use client';

import type { AppraisalAlertItem } from '@/lib/hooks/useAppraisalAlerts';

interface AppraisalAlertModalProps {
  open: boolean;
  items: AppraisalAlertItem[];
  convertingId: string | null;
  onClose: () => void;
  onConvert: (id: string) => void;
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

export default function AppraisalAlertModal({ open, items, convertingId, onClose, onConvert }: AppraisalAlertModalProps) {
  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.4)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white', borderRadius: 12,
          width: 560, maxWidth: '92vw', maxHeight: '85vh',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          overflow: 'hidden', display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{ padding: '24px 24px 12px', borderBottom: '1px solid #f3f4f6' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#111' }}>
              New Appraisal Requests
            </h2>
            <span style={{
              background: '#fef3c7', color: '#92400e', borderRadius: 999,
              padding: '2px 10px', fontSize: '0.75rem', fontWeight: 700,
            }}>
              {items.length} pending
            </span>
          </div>
          <p style={{ margin: '8px 0 0', fontSize: '0.85rem', color: '#6b7280', lineHeight: 1.5 }}>
            These requests arrived via the homepage Book Appraisal form.
            Convert each one into a Lead to clear it from the alerts.
          </p>
        </div>

        <div style={{ padding: '8px 24px', overflowY: 'auto', flex: 1 }}>
          {items.length === 0 ? (
            <p style={{ padding: '24px 0', textAlign: 'center', color: '#9ca3af', fontSize: '0.9rem' }}>
              All appraisal requests have been processed.
            </p>
          ) : (
            items.map(item => (
              <div
                key={item.id}
                style={{
                  padding: '14px 0', borderBottom: '1px solid #f3f4f6',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 600, color: '#111', fontSize: '0.9rem' }}>
                    {item.client_name}
                  </p>
                  <p style={{ margin: '2px 0 0', color: '#6b7280', fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.email}
                  </p>
                  <p style={{ margin: '2px 0 0', color: '#9ca3af', fontSize: '0.75rem' }}>
                    {formatTime(item.created_at)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onConvert(item.id)}
                  disabled={convertingId === item.id}
                  style={{
                    flexShrink: 0, padding: '8px 14px', fontSize: '0.8rem', borderRadius: 8,
                    border: 'none', background: convertingId === item.id ? '#a5b4fc' : '#4f46e5',
                    cursor: convertingId === item.id ? 'not-allowed' : 'pointer',
                    color: 'white', fontWeight: 600, whiteSpace: 'nowrap',
                  }}
                >
                  {convertingId === item.id ? 'Adding...' : 'Add to Leads'}
                </button>
              </div>
            ))
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '16px 24px', borderTop: '1px solid #f3f4f6' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 16px', fontSize: '0.85rem', borderRadius: 8,
              border: '1px solid #d1d5db', background: 'white', cursor: 'pointer',
              color: '#374151', fontWeight: 500,
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

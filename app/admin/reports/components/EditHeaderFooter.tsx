'use client';

import { useState, useEffect } from 'react';

interface EditHeaderFooterProps {
  open: boolean;
  header: string;
  footer: string;
  onSave: (header: string, footer: string) => void;
  onCancel: () => void;
}

export default function EditHeaderFooter({ open, header, footer, onSave, onCancel }: EditHeaderFooterProps) {
  const [h, setH] = useState(header);
  const [f, setF] = useState(footer);

  useEffect(() => { setH(header); setF(footer); }, [header, footer]);

  if (!open) return null;

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.4)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white', borderRadius: 12, padding: 0,
          width: 480, maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '24px 24px 8px' }}>
          <h2 style={{ margin: '0 0 4px', fontSize: '1.1rem', fontWeight: 700, color: '#111' }}>
            Edit Page Header &amp; Footer
          </h2>
          <p style={{ margin: '0 0 20px', fontSize: '0.85rem', color: '#666' }}>
            These appear on every page when exported to PDF.
          </p>

          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>
            Page Header
          </label>
          <textarea
            value={h}
            onChange={(e) => setH(e.target.value)}
            placeholder="e.g. nzmarie.com | Market Report"
            rows={3}
            style={{
              width: '100%', padding: '8px 10px', fontSize: '0.9rem',
              border: '1px solid #d1d5db', borderRadius: 8, outline: 'none',
              background: 'white', boxSizing: 'border-box', marginBottom: 16,
              resize: 'vertical',
            }}
          />

          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>
            Page Footer
          </label>
          <textarea
            value={f}
            onChange={(e) => setF(e.target.value)}
            placeholder="e.g. Prepared independently by Marie Nian"
            rows={3}
            style={{
              width: '100%', padding: '8px 10px', fontSize: '0.9rem',
              border: '1px solid #d1d5db', borderRadius: 8, outline: 'none',
              background: 'white', boxSizing: 'border-box',
              resize: 'vertical',
            }}
          />
          <p style={{ margin: '8px 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>
            Page numbers are automatically added to the right side of the footer.
          </p>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '16px 24px' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 16px', fontSize: '0.85rem', borderRadius: 8,
              border: '1px solid #d1d5db', background: 'white', cursor: 'pointer',
              color: '#374151', fontWeight: 500,
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(h, f)}
            style={{
              padding: '8px 16px', fontSize: '0.85rem', borderRadius: 8,
              border: 'none', background: '#1a73e8', cursor: 'pointer',
              color: 'white', fontWeight: 600,
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

'use client';

import type { ReportDocument } from '@/types/report';

interface AnalyticsPickerProps {
  open: boolean;
  onClose: () => void;
  documents: ReportDocument[];
  onInsert: (docId: string, imageUrl: string, label: string) => void;
  suburb?: string;
}

export default function AnalyticsPicker({ open, onClose, documents, onInsert, suburb }: AnalyticsPickerProps) {
  if (!open) return null;

  const filtered = documents.filter((d) => d.doc_type === 'report');
  const targetDocs = suburb
    ? filtered.filter((d) => d.suburb_id !== undefined)
    : filtered;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.4)',
    }}>
      <div style={{
        background: 'white', borderRadius: 12, padding: 24, width: 420,
        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
      }}>
        <h2 style={{ margin: '0 0 16px', fontSize: '1.1rem', fontWeight: 600, color: '#333' }}>
          Add to Report
        </h2>
        <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: 16 }}>
          Select a document to insert this chart into.
        </p>

        {targetDocs.length === 0 ? (
          <p style={{ color: '#999', fontSize: '0.85rem' }}>
            {suburb ? `No reports for ${suburb} yet.` : 'No reports found. Create one first.'}
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
            {targetDocs.map((doc) => (
              <button
                key={doc.id}
                onClick={() => {
                  onInsert(doc.id, '', doc.title);
                  onClose();
                }}
                style={{
                  textAlign: 'left', padding: '10px 12px', borderRadius: 6,
                  border: '1px solid #eee', background: 'white', cursor: 'pointer',
                  fontSize: '0.9rem', color: '#333',
                }}
              >
                <div style={{ fontWeight: 500 }}>{doc.title || 'Untitled'}</div>
                {doc.quarter && <div style={{ fontSize: '0.8rem', color: '#999' }}>{doc.quarter}</div>}
              </button>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            padding: '8px 16px', borderRadius: 6, border: '1px solid #ddd',
            background: 'white', cursor: 'pointer', color: '#555',
          }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

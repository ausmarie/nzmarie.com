import React from 'react';

interface PropertyHistoryRecord {
  date?: string;
  type?: string;
  price?: string;
  agent?: string;
  interval?: string;
}

export function PropertyHistoryView({ raw }: { raw: string }) {
  if (!raw || !raw.trim()) {
    return (
      <div style={{
        padding: '10px 12px', border: '2px solid #e2e8f0', borderRadius: '8px',
        fontSize: '0.9rem', color: '#a0aec0', backgroundColor: '#f8fafc',
      }}>
        No property history available
      </div>
    );
  }

  let records: PropertyHistoryRecord[] = [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) records = parsed as PropertyHistoryRecord[];
  } catch {
    records = [];
  }

  if (records.length === 0) {
    return (
      <div style={{
        padding: '10px 12px', border: '2px solid #e2e8f0', borderRadius: '8px',
        fontSize: '0.9rem', color: '#2D3748', whiteSpace: 'pre-wrap',
        fontFamily: 'monospace', backgroundColor: '#f8fafc',
      }}>
        {raw}
      </div>
    );
  }

  const typeColor: Record<string, string> = {
    SOLD: '#dc2626',
    Listed: '#2563eb',
    Rented: '#0891b2',
    Built: '#16a34a',
  };

  return (
    <div style={{
      border: '2px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden',
      fontSize: '0.85rem', backgroundColor: '#f8fafc',
    }}>
      <div style={{
        display: 'grid', gridTemplateColumns: '120px 90px 1fr',
        backgroundColor: '#edf2f7', fontWeight: '700', color: '#4a5568',
        padding: '8px 12px', borderBottom: '1px solid #e2e8f0',
      }}>
        <span>Date</span>
        <span>Type</span>
        <span>Price / Detail</span>
      </div>
      {records.map((rec, i) => (
        <div key={i} style={{
          display: 'grid', gridTemplateColumns: '120px 90px 1fr',
          padding: '8px 12px', borderBottom: i < records.length - 1 ? '1px solid #edf2f7' : 'none',
          color: '#2D3748',
        }}>
          <span style={{ fontFamily: 'monospace' }}>{rec.date || '—'}</span>
          <span style={{ fontWeight: '600', color: typeColor[rec.type || ''] || '#4a5568' }}>
            {rec.type || '—'}
          </span>
          <span style={{ fontFamily: 'monospace' }}>
            {rec.price ? rec.price : '—'}
            {rec.interval ? <span style={{ color: '#a0aec0', marginLeft: '8px', fontFamily: 'inherit' }}>({rec.interval})</span> : null}
          </span>
        </div>
      ))}
    </div>
  );
}

export default PropertyHistoryView;

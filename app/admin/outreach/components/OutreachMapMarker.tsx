'use client';

import React from 'react';

export default function OutreachMapMarker({ color, size = 12, count }: { color: string; size?: number; count?: number }) {
  const s = size;
  return (
    <div style={{ width: s, height: s, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.2)', border: '2px solid white' }}>
      {typeof count === 'number' && (
        <div style={{ color: 'white', fontSize: Math.max(8, Math.floor(s / 2)), fontWeight: 700 }}>{count}</div>
      )}
    </div>
  );
}

'use client';

import React from 'react';

export default function OutreachMapInfoWindow({ street, total, addresses }: { street: string; total: number; addresses?: string[] }) {
  return (
    <div style={{ padding: 8, minWidth: 200 }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{street}</div>
      <div style={{ color: '#6b7280', marginBottom: 6 }}>{total} addresses</div>
      {addresses && addresses.length > 0 && (
        <div style={{ fontSize: '0.85rem', color: '#374151' }}>{addresses.slice(0, 6).join(' · ')}{addresses.length > 6 ? ' · …' : ''}</div>
      )}
    </div>
  );
}

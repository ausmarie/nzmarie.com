'use client';

import React from 'react';
import { getRunColor } from '@/lib/outreach-map';

interface OutreachMapToolbarProps {
  onFitAll: () => void;
  runs: Array<{ runId: number; totalPending: number }>;
  activeRunId: number | null;
  onRunSelect: (runId: number) => void;
  showRunNumbers?: boolean;
}

export default function OutreachMapToolbar({
  onFitAll,
  runs,
  activeRunId,
  onRunSelect,
  showRunNumbers = true,
}: OutreachMapToolbarProps) {
  return (
    <div style={{ position: 'absolute', right: 12, top: 12, display: 'flex', gap: 8, zIndex: 40, flexWrap: 'wrap' }}>
      <button
        onClick={onFitAll}
        title="Fit all addresses"
        style={{ padding: '6px 10px', borderRadius: 999, background: 'white', border: '1px solid #e5e7eb', cursor: 'pointer' }}
      >
        ⊞ Fit All
      </button>
      {runs.map((r) => {
        const active = activeRunId === r.runId;
        return (
          <button
            key={r.runId}
            onClick={() => onRunSelect(r.runId)}
            title={`Fit Run ${r.runId}`}
            style={{
              padding: '6px 10px',
              borderRadius: 999,
              background: active ? '#f5f3ff' : '#f8fafc',
              border: active ? `2px solid ${getRunColor(r.runId)}` : '1px solid #e5e7eb',
              cursor: 'pointer',
              fontWeight: active ? 700 : 400,
            }}
          >
            {showRunNumbers ? `● Run ${r.runId} (${r.totalPending})` : `● (${r.totalPending})`}
          </button>
        );
      })}
    </div>
  );
}
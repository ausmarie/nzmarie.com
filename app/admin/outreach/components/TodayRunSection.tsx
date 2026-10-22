'use client';

import React from 'react';

export interface RunStreet {
  street: string;
  suburb: string;
  lat: number;
  lng: number;
  pendingCount: number;
  addresses?: string[];
  addressCoords?: Array<{
    address: string;
    lat: number;
    lng: number;
    sent: boolean;
    status: 'unsent' | 'sent' | 'junk';
  }>;
}

export interface RunGroup {
  groupId: number;
  streets: RunStreet[];
  totalPending: number;
  extentMeters: number;
}

export interface Run {
  runId: number;
  groups: RunGroup[];
  totalPending: number;
  streetCount: number;
}

export interface TodayRunData {
  suburb: string;
  groups: RunGroup[];
  runs: Run[];
  unclusteredStreets: { street: string; has_coords: boolean }[];
  manualOrder?: boolean;
  manualOrderCount?: number;
  startStreet?: string | null;
  allStreets?: { street: string; count: number }[];
}

interface TodayRunSectionProps {
  status: 'all' | 'unsent' | 'sent';
  data: TodayRunData | null;
  loading: boolean;
  error: string | null;
  onSelectStreet: (suburb: string, street: string) => void;
  startStreet?: string;
  onStartStreetChange?: (suburb: string, street: string) => void;
}

export default function TodayRunSection({
  status,
  data,
  loading,
  error,
  onSelectStreet,
  startStreet = '',
  onStartStreetChange = () => {},
}: TodayRunSectionProps) {
  if (status !== 'unsent') return null;

  const routeStreets = data?.runs[0]?.groups.flatMap((group) => group.streets)
    ?? data?.groups[0]?.streets
    ?? [];
  const allStreetCounts =
    data?.allStreets ??
    (data?.groups ?? []).flatMap((group) =>
      group.streets.map((street) => ({
        street: street.street,
        count: street.pendingCount,
      }))
    );
  const totalAddressCount = allStreetCounts.reduce((sum, street) => sum + street.count, 0);
  const totalStreetCount = allStreetCounts.length;
  const hasStreets = routeStreets.length > 0;

  return (
    <div
      style={{
        marginBottom: '20px',
        borderRadius: '12px',
        border: '2px solid #8b5cf6',
        backgroundColor: '#faf5ff',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          padding: '12px 16px',
          backgroundColor: '#8b5cf6',
          color: 'white',
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontWeight: '600', fontSize: '0.95rem' }}>🚀 Today&apos;s Route</span>
        {data && totalStreetCount > 0 && (
          <span style={{ fontSize: '0.78rem', opacity: 0.9 }}>
            {totalAddressCount} {totalAddressCount === 1 ? 'address' : 'addresses'} ·{' '}
            {totalStreetCount} {totalStreetCount === 1 ? 'street' : 'streets'}
          </span>
        )}
      </div>

      {data && data.allStreets && data.allStreets.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 16px',
            backgroundColor: '#ffffff',
            borderBottom: '1px solid #ede9fe',
            flexWrap: 'wrap',
          }}
        >
          <label
            htmlFor="today-run-start-street"
            style={{ fontSize: '0.8rem', color: '#6d28d9', fontWeight: '600' }}
          >
            Start from
          </label>
          <select
            id="today-run-start-street"
            aria-label="Start street"
            value={startStreet || ''}
            onChange={(e) => onStartStreetChange(data.suburb, e.target.value)}
            style={{
              minWidth: '200px',
              padding: '5px 10px',
              borderRadius: '8px',
              border: '1px solid #d8b4fe',
              backgroundColor: '#ffffff',
              fontSize: '0.8rem',
              color: '#374151',
              cursor: 'pointer',
            }}
          >
            <option value="">
              Auto (default{data.startStreet ? `: ${data.startStreet}` : ''})
            </option>
            {data.allStreets.map((s) => (
              <option key={s.street} value={s.street}>
                {s.street} ({s.count})
              </option>
            ))}
          </select>
        </div>
      )}

      <div style={{ padding: '12px 16px' }}>
        {loading && <div style={{ fontSize: '0.85rem', color: '#7c3aed' }}>Loading…</div>}
        {error && <div style={{ fontSize: '0.85rem', color: '#dc2626' }}>{error}</div>}
        {!loading && !error && data && !hasStreets && (
          <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
            No pending addresses in this suburb.
          </div>
        )}
        {!loading && !error && data && hasStreets && (
          <>
            <div
              style={{
                fontSize: '0.75rem',
                color: '#7c3aed',
                fontWeight: '600',
                marginBottom: '8px',
              }}
            >
              Nearby streets in walking order
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {routeStreets.map((street) => (
                <button
                  key={`${street.suburb}::${street.street}`}
                  type="button"
                  onClick={() => onSelectStreet(street.suburb, street.street)}
                  aria-label={`${street.street} (${street.pendingCount})`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '5px 10px',
                    borderRadius: '999px',
                    border: street.street === startStreet
                      ? '1px solid #7c3aed'
                      : '1px solid #e9d5ff',
                    backgroundColor: street.street === startStreet ? '#f5f3ff' : '#ffffff',
                    color: '#4c1d95',
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                  }}
                >
                  <span>{street.street}</span>
                  <span style={{ color: '#8b5cf6', fontSize: '0.72rem' }}>
                    {street.pendingCount}
                  </span>
                </button>
              ))}
            </div>
            <div style={{ marginTop: '8px', fontSize: '0.72rem', color: '#94a3b8' }}>
              Cards follow this order. Click a street to focus on it.
            </div>
          </>
        )}

        {!loading && !error && data && data.unclusteredStreets.length > 0 && (
          <div style={{ marginTop: '12px', fontSize: '0.75rem', color: '#b45309' }}>
            {data.unclusteredStreets.length} street
            {data.unclusteredStreets.length === 1 ? '' : 's'} without location data (not clustered).
          </div>
        )}
      </div>
    </div>
  );
}

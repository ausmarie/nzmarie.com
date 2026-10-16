'use client';

import React, { useEffect, useState } from 'react';
import ManualRunPanel from './ManualRunPanel';

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
  isMobile: boolean;
  status: 'all' | 'unsent' | 'sent';
  data: TodayRunData | null;
  loading: boolean;
  error: string | null;
  budget: number;
  onBudgetChange: (budget: number) => void;
  onSelectRun: (suburb: string, streets: string[]) => void;
  onSelectStreet: (suburb: string, street: string) => void;
  reportQuarter?: string;
  onOrderApplied?: (streets: string[]) => void;
  onResetManualOrder?: (suburb: string) => void;
  startStreet?: string;
  onStartStreetChange?: (suburb: string, street: string) => void;
}

const VISIBLE_RUNS = 2;

export default function TodayRunSection({
  isMobile,
  status,
  data,
  loading,
  error,
  budget,
  onBudgetChange,
  onSelectRun,
  onSelectStreet,
  reportQuarter,
  onOrderApplied = () => {},
  onResetManualOrder = () => {},
  startStreet = '',
  onStartStreetChange = () => {},
}: TodayRunSectionProps) {
  const [customBudget, setCustomBudget] = useState<string>('');
  const [expandedRuns, setExpandedRuns] = useState<Set<number>>(new Set());
  const [showAllRuns, setShowAllRuns] = useState(false);
  const [activeRunId, setActiveRunId] = useState<number | null>(null);
  const [manualOpen, setManualOpen] = useState(false);

  useEffect(() => {
    setExpandedRuns(new Set());
    setShowAllRuns(false);
    if (data && data.runs.length > 0) {
      const first = data.runs[0];
      const streets = first.groups.flatMap((g) => g.streets.map((s) => s.street));
      setActiveRunId(first.runId);
      onSelectRun(data.suburb, streets);
    } else {
      setActiveRunId(null);
    }
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  if (status !== 'unsent') return null;

  const toggleRun = (id: number) => {
    setExpandedRuns((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectRun = (run: Run, suburb: string) => {
    const streets = run.groups.flatMap((g) => g.streets.map((s) => s.street));
    setActiveRunId(run.runId);
    onSelectRun(suburb, streets);
  };

  const totalUnsent = data?.runs.reduce((s, r) => s + r.totalPending, 0) ?? 0;
  const runs = data?.runs ?? [];
  const visibleRuns = showAllRuns ? runs : runs.slice(0, VISIBLE_RUNS);
  const hiddenRunCount = Math.max(0, runs.length - VISIBLE_RUNS);

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
        <span style={{ fontWeight: '600', fontSize: '0.95rem' }}>🚀 Today&apos;s Run</span>
        <button
          type="button"
          onClick={() => setManualOpen((v) => !v)}
          style={{
            fontSize: '0.8rem',
            fontWeight: '600',
            padding: '6px 12px',
            borderRadius: '8px',
            cursor: 'pointer',
            backgroundColor: manualOpen ? '#ffffff' : 'rgba(255,255,255,0.15)',
            color: manualOpen ? '#6d28d9' : '#ffffff',
            border: manualOpen ? '1px solid #ffffff' : '1px solid rgba(255,255,255,0.5)',
            transition: 'all 0.2s ease',
          }}
        >
          ⚙️ Manual Run
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.8rem', opacity: 0.9 }}>Addresses</span>
          <input
            type="number"
            min={1}
            max={500}
            value={customBudget !== '' ? customBudget : budget}
            aria-label="Addresses per run"
            onChange={(e) => setCustomBudget(e.target.value)}
            onBlur={() => {
              const n = parseInt(customBudget || String(budget), 10);
              if (Number.isFinite(n) && n > 0) onBudgetChange(n);
              setCustomBudget('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const n = parseInt(customBudget || String(budget), 10);
                if (Number.isFinite(n) && n > 0) onBudgetChange(n);
                setCustomBudget('');
                (e.target as HTMLInputElement).blur();
              }
            }}
            style={{
              width: '56px',
              padding: '4px 8px',
              borderRadius: '6px',
              border: 'none',
              fontSize: '0.8rem',
              fontWeight: '600',
              textAlign: 'center',
            }}
          />
          <span style={{ fontSize: '0.72rem', opacity: 0.85 }}>per run</span>
        </div>
      </div>

      {data?.manualOrder && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            padding: '8px 16px',
            backgroundColor: '#f5f3ff',
            borderBottom: '1px solid #ede9fe',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: '0.8rem', color: '#7c3aed', fontWeight: '600' }}>
            ⚙️ Manual order applied · {data.manualOrderCount}{' '}
            {data.manualOrderCount === 1 ? 'street' : 'streets'} ordered
          </span>
          <button
            type="button"
            onClick={() => onResetManualOrder(data.suburb)}
            style={{
              fontSize: '0.72rem',
              fontWeight: '600',
              color: '#7c3aed',
              backgroundColor: '#ffffff',
              border: '1px solid #d8b4fe',
              borderRadius: '6px',
              padding: '3px 10px',
              cursor: 'pointer',
            }}
          >
            ↺ Reset to Auto
          </button>
        </div>
      )}

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
            disabled={!!data.manualOrder}
            onChange={(e) => onStartStreetChange(data.suburb, e.target.value)}
            style={{
              minWidth: '200px',
              padding: '5px 10px',
              borderRadius: '8px',
              border: '1px solid #d8b4fe',
              backgroundColor: data.manualOrder ? '#f3f4f6' : '#ffffff',
              fontSize: '0.8rem',
              color: '#374151',
              cursor: data.manualOrder ? 'not-allowed' : 'pointer',
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
          {data.manualOrder && (
            <span style={{ fontSize: '0.72rem', color: '#b45309' }}>
              Manual order applied — reset to Auto to use the start street
            </span>
          )}
        </div>
      )}

      <div style={{ padding: '12px 16px' }}>
        {loading && <div style={{ fontSize: '0.85rem', color: '#7c3aed' }}>Loading…</div>}
        {error && <div style={{ fontSize: '0.85rem', color: '#dc2626' }}>{error}</div>}
        {!loading && !error && data && runs.length === 0 && (
          <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
            No pending addresses in this suburb.
          </div>
        )}
        {!loading && !error && data && runs.length > 0 && (
          <div
            style={{
              fontSize: '0.8rem',
              color: '#7c3aed',
              fontWeight: '600',
              marginBottom: '10px',
            }}
          >
            {data.suburb} · {totalUnsent} addresses planned · {runs.length} runs
          </div>
        )}

        {!loading && !error && data && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {visibleRuns.map((run, index) => {
              const expanded = expandedRuns.has(run.runId);
              const allStreets = run.groups.flatMap((g) => g.streets);
              const preview = allStreets.slice(0, isMobile ? 2 : 4).map((s) => s.street);
              const hidden = allStreets.length - preview.length;
              const isActive = activeRunId === run.runId;
              return (
                <div
                  key={run.runId}
                  style={{
                    borderRadius: '10px',
                    border: isActive
                      ? '2px solid #6d28d9'
                      : index === 0
                        ? '2px solid #8b5cf6'
                        : '1px solid #e9d5ff',
                    backgroundColor: isActive ? '#f5f3ff' : index === 0 ? '#ffffff' : '#fdfaff',
                    padding: '12px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                      flexWrap: 'wrap',
                      cursor: 'pointer',
                    }}
                    onClick={() => selectRun(run, data.suburb)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontWeight: '600',
                          fontSize: '0.85rem',
                          color: index === 0 ? '#6d28d9' : '#4a5568',
                        }}
                      >
                        {index === 0 ? 'Run 1 (Recommended · Start here)' : `Run ${run.runId}`}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                        {run.totalPending} addresses · {run.streetCount} streets
                      </span>
                    </div>
                    <button
                      type="button"
                      aria-expanded={expanded}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleRun(run.runId);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        color: '#7c3aed',
                        fontWeight: '500',
                      }}
                    >
                      {expanded ? 'Collapse ▲' : 'View streets ▼'}
                    </button>
                  </div>

                  <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {preview.map((street) => (
                      <span
                        key={street}
                        style={{
                          fontSize: '0.75rem',
                          backgroundColor: '#f3e8ff',
                          color: '#6d28d9',
                          padding: '2px 8px',
                          borderRadius: '999px',
                        }}
                      >
                        {street}
                      </span>
                    ))}
                    {hidden > 0 && (
                      <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>+{hidden} more</span>
                    )}
                  </div>

                  {expanded && (
                    <div
                      style={{
                        marginTop: '8px',
                        borderTop: '1px dashed #e9d5ff',
                        paddingTop: '8px',
                      }}
                    >
                      {allStreets.map((s) => (
                        <button
                          key={`${s.suburb}::${s.street}`}
                          type="button"
                          onClick={() => onSelectStreet(s.suburb, s.street)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            width: '100%',
                            background: 'none',
                            border: 'none',
                            padding: '4px 0',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            color: '#374151',
                            textAlign: 'left',
                          }}
                        >
                          <span>{s.street}</span>
                          <span style={{ color: '#6b7280', fontSize: '0.72rem' }}>
                            {s.pendingCount} address{s.pendingCount === 1 ? '' : 'es'}
                          </span>
                        </button>
                      ))}
                      <div
                        style={{
                          marginTop: '4px',
                          fontSize: '0.72rem',
                          color: '#94a3b8',
                        }}
                      >
                        Click a street to filter the list to that street only.
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {!showAllRuns && hiddenRunCount > 0 && (
              <button
                type="button"
                onClick={() => setShowAllRuns(true)}
                style={{
                  padding: '10px',
                  borderRadius: '10px',
                  border: '1px dashed #8b5cf6',
                  backgroundColor: '#ffffff',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  color: '#7c3aed',
                  fontWeight: '600',
                }}
              >
                More runs ({hiddenRunCount})
              </button>
            )}
            {showAllRuns && hiddenRunCount > 0 && (
              <button
                type="button"
                onClick={() => setShowAllRuns(false)}
                style={{
                  padding: '10px',
                  borderRadius: '10px',
                  border: '1px dashed #8b5cf6',
                  backgroundColor: '#ffffff',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  color: '#7c3aed',
                  fontWeight: '600',
                }}
              >
                Show fewer runs
              </button>
            )}
          </div>
        )}

        {!loading && !error && data && data.unclusteredStreets.length > 0 && (
          <div style={{ marginTop: '12px', fontSize: '0.75rem', color: '#b45309' }}>
            {data.unclusteredStreets.length} street
            {data.unclusteredStreets.length === 1 ? '' : 's'} without location data (not clustered).
          </div>
        )}
      </div>

      {manualOpen && data && (
        <ManualRunPanel
          isOpen={manualOpen}
          onClose={() => setManualOpen(false)}
          suburb={data.suburb}
          reportQuarter={reportQuarter}
          onOrderApplied={onOrderApplied}
        />
      )}
    </div>
  );
}

'use client';

import React, { useEffect, useState } from 'react';
import type { TodayRunData, Run } from './TodayRunSection';

type StreetStatus = 'has-unsent' | 'all-sent' | 'junk-only' | 'no-pending';

interface OutreachMapSidebarProps {
  data: TodayRunData | null;
  loading: boolean;
  error: string | null;
  activeRunId: number | null;
  collapsedStreets: Set<string>;
  onToggleStreet: (suburb: string, street: string) => void;
  onStreetSelect: (suburb: string, street: string) => void;
  onRunSelect: (runId: number) => void;
  onSuburbClick?: (suburb: string) => void;
  hidden: boolean;
  onToggleHidden: () => void;
  streetStatusMap?: Map<string, StreetStatus>;
  addressCounts?: { total: number; unsent: number; sent: number; junk: number } | null;
  statusFilter?: 'all' | 'unsent' | 'sent' | 'junk';
  onStatusFilterChange?: (status: 'all' | 'unsent' | 'sent' | 'junk') => void;
}

const MIN_COLLAPSED_STREETS = 4;

export default function OutreachMapSidebar({
  data,
  loading,
  error,
  activeRunId,
  collapsedStreets,
  onToggleStreet,
  onStreetSelect,
  onRunSelect,
  onSuburbClick,
  hidden,
  onToggleHidden,
  statusFilter = 'all',
  addressCounts = null,
  onStatusFilterChange,
}: OutreachMapSidebarProps) {
  const [revealedRuns, setRevealedRuns] = useState<Set<number>>(new Set());
  const [expandedRuns, setExpandedRuns] = useState<Set<number>>(new Set());

  useEffect(() => {
    setRevealedRuns(new Set());
    setExpandedRuns(new Set(activeRunId ? [activeRunId] : []));
  }, [data, activeRunId]);

  if (hidden) {
    return (
      <div style={{ padding: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <button
          aria-label="Show Sidebar"
          onClick={onToggleHidden}
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1rem',
          }}
        >
          ⏩
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: 12, fontSize: '0.9rem', color: '#334155' }}>
        {loading ? 'Loading outreach summary…' : error ? error : 'No outreach data available.'}
      </div>
    );
  }

  const allStreetsMap = new Map<string, {
    street: string;
    unsentCount: number;
    sentCount: number;
    junkCount: number;
    totalCount: number;
  }>();

  if (data?.runs) {
    for (const r of data.runs) {
      for (const g of r.groups) {
        for (const s of g.streets) {
          if (!s.street) continue;
          const coords = s.addressCoords ?? [];
          let unsent = 0;
          let sent = 0;
          let junk = 0;
          if (coords.length > 0) {
            for (const c of coords) {
              if (c.status === 'unsent') unsent++;
              else if (c.status === 'sent') sent++;
              else if (c.status === 'junk') junk++;
            }
          } else {
            unsent = s.pendingCount ?? 0;
          }
          allStreetsMap.set(s.street, {
            street: s.street,
            unsentCount: unsent,
            sentCount: sent,
            junkCount: junk,
            totalCount: coords.length > 0 ? coords.length : (s.pendingCount ?? 0),
          });
        }
      }
    }
  }

  const getStreetFilterCount = (streetName: string) => {
    const info = allStreetsMap.get(streetName);
    if (!info) return 0;
    if (statusFilter === 'unsent') return info.unsentCount;
    if (statusFilter === 'sent') return info.sentCount;
    if (statusFilter === 'junk') return info.junkCount;
    return info.totalCount;
  };

  const isStreetMatching = (streetName: string) => {
    const info = allStreetsMap.get(streetName);
    if (!info) return statusFilter === 'all';
    if (statusFilter === 'unsent') return info.unsentCount > 0;
    if (statusFilter === 'sent') return info.sentCount > 0;
    if (statusFilter === 'junk') return info.junkCount > 0;
    return info.totalCount > 0;
  };

  let matchingStreetsCount = 0;

  if (data?.runs) {
    for (const r of data.runs) {
      for (const g of r.groups) {
        for (const s of g.streets) {
          if (isStreetMatching(s.street)) {
            matchingStreetsCount++;
          }
        }
      }
    }
  }

  const countFallback = {
    total: 0,
    unsent: 0,
    sent: 0,
    junk: 0,
  };
  for (const { unsentCount, sentCount, junkCount, totalCount } of allStreetsMap.values()) {
    countFallback.total += totalCount;
    countFallback.unsent += unsentCount;
    countFallback.sent += sentCount;
    countFallback.junk += junkCount;
  }

  const effectiveCounts = addressCounts ?? countFallback;
  const statusCount = statusFilter === 'unsent'
    ? effectiveCounts.unsent
    : statusFilter === 'sent'
      ? effectiveCounts.sent
      : statusFilter === 'junk'
        ? effectiveCounts.junk
        : effectiveCounts.total;
  const percent = effectiveCounts.total > 0
    ? `${((statusCount / effectiveCounts.total) * 100).toFixed(1)}%`
    : '0.0%';

  const summaryText = statusFilter === 'all'
    ? `${effectiveCounts.total} pending · ${effectiveCounts.unsent} Unsent · ${effectiveCounts.sent} Sent`
    : statusFilter === 'unsent'
      ? `${effectiveCounts.unsent} Unsent · ${percent}`
      : statusFilter === 'sent'
        ? `${effectiveCounts.sent} Sent · ${percent}`
        : `${effectiveCounts.junk} Junk · ${percent}`;

  return (
    <div style={{ padding: 12, fontSize: '0.9rem' }}>
      <div style={{ marginBottom: 12, display: 'flex', gap: 6 }}>
        {(['all', 'unsent', 'sent', 'junk'] as const).map((status) => {
          const labels = { all: 'All', unsent: 'Unsent', sent: 'Sent', junk: 'Junk' };
          const isActive = statusFilter === status;
          return (
            <button
              key={status}
              onClick={() => onStatusFilterChange?.(status)}
              style={{
                flex: 1,
                padding: '5px 8px',
                borderRadius: 8,
                border: isActive ? '1.5px solid #2563eb' : '1px solid #d1d5db',
                background: isActive ? '#eff6ff' : '#ffffff',
                color: isActive ? '#1d4ed8' : '#374151',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: isActive ? 600 : 500,
                transition: 'all 0.15s ease',
              }}
            >
              {labels[status]}
            </button>
          );
        })}
      </div>

      {data && (
        <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
          <button
            onClick={() => {
              onStatusFilterChange?.('all');
              onSuburbClick?.(data.suburb);
            }}
            style={{
              cursor: 'pointer',
              border: '1px solid #cbd5e1',
              borderRadius: 8,
              padding: '6px 10px',
              background: '#f8fafc',
              color: '#1e293b',
              fontWeight: 600,
              fontSize: '0.88rem',
            }}
          >
            {data.suburb}
          </button>
          <div style={{ color: '#334155', fontSize: '0.9rem', lineHeight: '1.3', flex: 1 }}>
            {summaryText}
          </div>
          <button
            onClick={onToggleHidden}
            title="Hide Sidebar"
            style={{ padding: '4px 8px', borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0', cursor: 'pointer', fontSize: '0.8rem' }}
          >
            ⏪
          </button>
        </div>
      )}

      {loading && !data && (
        <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>Loading streets…</div>
      )}

      {error && !data && (
        <div style={{ color: '#dc2626', fontSize: '0.9rem' }}>{error}</div>
      )}

      {data && (
        <>
          {data.unclusteredStreets.length > 0 && (
            <div style={{ marginBottom: 8, color: '#d97706', fontSize: '0.8rem' }}>
              ⚠ {data.unclusteredStreets.length} {data.unclusteredStreets.length === 1 ? 'street' : 'streets'} missing coordinates (not located)
            </div>
          )}

          {matchingStreetsCount === 0 && (
            <div style={{ color: '#6b7280', fontSize: '0.85rem', marginTop: 12 }}>
              No addresses found for this status.
            </div>
          )}

          {data.runs.map((run: Run) => {
            const reveal = revealedRuns.has(run.runId) || run.runId <= 3;
            if (!reveal) return null;

            const matchingStreets = run.groups.flatMap((g) => g.streets).filter((s) => isStreetMatching(s.street));
            if (statusFilter !== 'all' && matchingStreets.length === 0) return null;

            const runCount = matchingStreets.reduce((sum, s) => sum + getStreetFilterCount(s.street), 0);
            const expanded = expandedRuns.has(run.runId);

            return (
              <div key={run.runId} style={{ marginBottom: 10 }}>
                <div
                  onClick={() => {
                    onRunSelect(run.runId);
                    setExpandedRuns((prev) => {
                      const next = new Set(prev);
                      if (next.has(run.runId)) next.delete(run.runId);
                      else next.add(run.runId);
                      return next;
                    });
                    setRevealedRuns((prev) => {
                      const next = new Set(prev);
                      next.add(run.runId);
                      return next;
                    });
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    cursor: 'pointer',
                    fontWeight: activeRunId === run.runId ? 700 : 500,
                    color: activeRunId === run.runId ? '#7c3aed' : '#374151',
                    padding: '4px 6px',
                    borderRadius: 6,
                    background: activeRunId === run.runId ? '#f5f3ff' : 'transparent',
                  }}
                  role="button"
                  aria-expanded={expanded}
                >
                  <span>{expanded ? '▾' : '▸'}</span>
                  <span>● Run {run.runId}</span>
                  <span style={{ color: '#6b7280', fontWeight: 400 }}>({runCount})</span>
                </div>
                {expanded && (
                  <div style={{ marginLeft: 14, marginTop: 4 }}>
                    {matchingStreets.map((s, i) => {
                      const street = s.street;
                      const count = getStreetFilterCount(street);
                      const info = allStreetsMap.get(street);

                      const collapsed = collapsedStreets.has(`${data.suburb}::${street}`) && count > MIN_COLLAPSED_STREETS;

                      let bulletColor = '#9ca3af';
                      if (statusFilter === 'unsent') {
                        bulletColor = '#dc2626';
                      } else if (statusFilter === 'sent') {
                        bulletColor = '#7c3aed';
                      } else if (statusFilter === 'junk') {
                        bulletColor = '#eab308';
                      } else if (info) {
                        if (info.unsentCount > 0) bulletColor = '#dc2626';
                        else if (info.junkCount > 0) bulletColor = '#eab308';
                        else if (info.sentCount > 0) bulletColor = '#7c3aed';
                      }

                      const streetFontWeight = (statusFilter === 'unsent' || (statusFilter === 'all' && info?.unsentCount && info.unsentCount > 0)) ? 700 : 400;
                      const streetColor =
                        bulletColor === '#dc2626' ? '#111827'
                          : bulletColor === '#7c3aed' ? '#7c3aed'
                            : bulletColor === '#eab308' ? '#d97706'
                              : '#9ca3af';

                      return (
                        <div key={`${street}-${i}`} style={{ marginBottom: 2 }}>
                          <div
                            onClick={() => onStreetSelect(data.suburb, street)}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 6px', borderRadius: 4, cursor: 'pointer', color: '#374151' }}
                          >
                            <span style={{ color: bulletColor, flexShrink: 0 }}>●</span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: streetFontWeight, color: streetColor }}>{street}</span>
                            <span style={{ marginLeft: 'auto', color: '#6b7280', flexShrink: 0 }}>{count}</span>
                            {count > MIN_COLLAPSED_STREETS && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onToggleStreet(data.suburb, street);
                                }}
                                style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#6b7280', fontSize: '0.8rem' }}
                                title={collapsed ? 'Expand addresses' : 'Collapse addresses'}
                              >
                                {collapsed ? '▾' : '▴'}
                              </button>
                            )}
                          </div>
                          {collapsed && (
                            <div style={{ marginLeft: 18, color: '#6b7280', fontSize: '0.8rem' }}>{s.addresses?.slice(0, 3).join(' · ')}{count > 3 ? ` · +${count - 3}` : ''}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {data.runs.length > 3 && data.runs.slice(3).some((run) => !revealedRuns.has(run.runId)) && (
            <button
              onClick={() =>
                setRevealedRuns((prev) => {
                  const next = new Set(prev);
                  data.runs.forEach((r) => next.add(r.runId));
                  return next;
                })
              }
              style={{ marginTop: 8, color: '#7c3aed', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem' }}
            >
              Show all {data.runs.length} runs
            </button>
          )}
        </>
      )}
    </div>
  );
}
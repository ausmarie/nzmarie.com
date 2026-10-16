'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';


interface ScanLogCampaign {
  campaign_key: string;
  campaign_name: string;
  total_pv: number;
  total_uv: number;
}

interface CampaignScanLogsPanelProps {
  initialCampaign?: string;
  initialDateFilter?: string;
}

export default function CampaignScanLogsPanel({ initialCampaign, initialDateFilter }: CampaignScanLogsPanelProps = {}) {
  const [selectedCampaign, setSelectedCampaign] = useState<string>(initialCampaign || 'all');
  const [dateFilter, setDateFilter] = useState(initialDateFilter || '');
  const [typeFilter, setTypeFilter] = useState<'all' | 'new_device'>('all');
  const [open, setOpen] = useState(true);

  const limit = 20;

  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['scanLogs', selectedCampaign, typeFilter, dateFilter],
    queryFn: async ({ pageParam = 1 }) => {
      const params = new URLSearchParams({ page: String(pageParam), limit: String(limit) });
      if (selectedCampaign && selectedCampaign !== 'all') params.set('campaign', selectedCampaign);
      if (typeFilter && typeFilter !== 'all') params.set('type', typeFilter);
      if (dateFilter) params.set('date', dateFilter);
      const res = await fetch(`/api/admin/analytics/scans?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load scan logs');
      return json;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const page = lastPage.page ?? 1;
      const limitVal = lastPage.limit ?? limit;
      const total = lastPage.total_logs ?? 0;
      const fetchedSoFar = page * limitVal;
      return fetchedSoFar < total ? page + 1 : undefined;
    },
  });

  const campaigns: ScanLogCampaign[] = data?.pages?.[0]?.campaigns || [];
  const totalScans = data?.pages?.[0]?.total_scans ?? 0;
  const totalNewDevices = data?.pages?.[0]?.total_new_devices ?? 0;
  const allLogs = data ? data.pages.flatMap((p) => p.logs || []) : [];
  const filteredLogs = allLogs;

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!hasNextPage || !sentinelRef.current) return;
    const el = sentinelRef.current;
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      });
    }, { rootMargin: '200px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm transition-all duration-200">
      <button
        type="button"
        onClick={() => {
          if (!open) {
            setDateFilter('');
            setTypeFilter('all');
          }
          setOpen((v) => !v);
        }}
        className="w-full flex items-center justify-between px-6 py-4 text-left focus:outline-none"
      >
        <div>
          <h3 className="text-sm font-semibold text-slate-700">QR Code Scan Logs</h3>
          <p className="text-xs text-slate-400 mt-0.5">Detailed record of direct mail visitor scans</p>
        </div>
        <span className="text-slate-400 text-xs font-medium">
          {open ? '\u25B2 Hide' : '\u25BC Show'}
        </span>
      </button>

      {open && (
        <div className="border-t border-slate-100">
          <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => { setSelectedCampaign('all'); setTypeFilter('all'); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                selectedCampaign === 'all' && typeFilter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              All Campaigns ({totalScans})
            </button>
            <button
              type="button"
              onClick={() => { setSelectedCampaign('all'); setTypeFilter('new_device'); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                typeFilter === 'new_device'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              New Devices ({totalNewDevices})
            </button>
            {campaigns.map((c) => (
              <button
                key={c.campaign_key}
                type="button"
                onClick={() => { setSelectedCampaign(c.campaign_key); setTypeFilter('all'); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  selectedCampaign === c.campaign_key && typeFilter === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                {c.campaign_name || c.campaign_key} ({c.total_pv})
              </button>
            ))}
            <div className="ml-auto flex items-center gap-2">
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="px-2 py-1.5 rounded-lg text-xs border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {dateFilter && (
                <button
                  type="button"
                  onClick={() => setDateFilter('')}
                  className="text-xs font-medium text-slate-500 hover:text-slate-700"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="p-6 min-h-[300px]">
            {isLoading && allLogs.length === 0 ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-8 bg-slate-100 rounded animate-pulse" />
                ))}
              </div>
            ) : isError && allLogs.length === 0 ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
                Failed to load scan logs
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-sm">No scan logs recorded yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse" data-testid="scan-logs-table">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                      <th className="py-3 px-4">Time</th>
                      <th className="py-3 px-4">Campaign</th>
                      <th className="py-3 px-4">Visitor Fingerprint</th>
                      <th className="py-3 px-4">Device &amp; IP</th>
                      <th className="py-3 px-4">Type</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-mono text-xs text-slate-600 select-text">
                          {new Date(log.created_at).toLocaleString('en-NZ')}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-slate-900 text-xs bg-slate-100 px-2 py-0.5 rounded">
                            {log.campaign_key
                              .replace(/_/g, ' ')
                              .replace(/\b\w/g, (c: string) => c.toUpperCase())}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-500 select-text">
                          {log.visitor_hash
                            ? `${log.visitor_hash.substring(0, 12)}...`
                            : 'N/A'}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600">
                          <div>{log.ip_address || 'Unknown IP'}</div>
                          <div
                            className="text-slate-400 truncate max-w-[200px] select-text"
                            title={log.user_agent}
                          >
                            {log.device_type ? `${log.device_type} \u00b7 ` : ''}
                            {log.user_agent || 'Unknown UA'}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {log.is_new_device ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300">
                              New Device
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
                              Repeat{log.visit_count ? ` ×${log.visit_count}` : ''}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {hasNextPage && <div ref={sentinelRef} />}
                {isFetchingNextPage && (
                  <div className="pt-4 space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="h-8 bg-slate-100 rounded animate-pulse" />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

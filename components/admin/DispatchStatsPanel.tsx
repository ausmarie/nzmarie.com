'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ComposedChart, PieChart, Pie, Cell,
} from 'recharts';
import CampaignScanLogsPanel from './CampaignScanLogsPanel';

interface Summary {
  pending_count: number;
  sent_count: number;
  interacted_count: number;
  converted_count: number;
  no_junk_mail_count: number;
  remaining_count: number;
  total_scans_pv: number;
  total_scans_uv: number;
}

interface DailySend {
  date: string;
  total_sent: number;
  no_junk_sent?: number;
}

interface DailyScan {
  date: string;
  pv: number;
  uv: number;
}

interface CampaignStats {
  campaign: string;
  summary: Summary;
  daily_sends: DailySend[];
  daily_scans: DailyScan[];
  business_card_summary: { pv: number; uv: number };
  business_card_daily_scans: DailyScan[];
}

const SUMMARY_CARDS = [
  { key: 'pending_count', label: 'Pending', icon: '📬', color: 'text-amber-600' },
  { key: 'sent_count', label: 'Sent', icon: '✅', color: 'text-blue-600' },
  { key: 'no_junk_mail_count', label: 'No Junk Mail', icon: '🚫', color: 'text-orange-600' },
  { key: 'total_scans_pv', label: 'QR Scans (PV/UV)', icon: '👁', color: 'text-indigo-600' },
  { key: 'biz_pv', label: 'Business Card 🪪', icon: '🪪', color: 'text-indigo-600' },
  { key: 'interacted_count', label: 'Interacted', icon: '💬', color: 'text-purple-600' },
  { key: 'converted_count', label: 'Converted', icon: '🎯', color: 'text-green-600' },
] as const;

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-NZ', { month: 'short', day: 'numeric' });
}

function SummaryCards({ summary, bizPv, bizUv }: { summary: Summary; bizPv: number; bizUv: number }) {
  const fmt = (n: unknown): number => {
    const v = Number(n);
    return Number.isFinite(v) ? v : 0;
  };
  const totalScans = `${fmt(summary.total_scans_pv)} / ${fmt(summary.total_scans_uv)}`;
  const bizScans = `${fmt(bizPv)} / ${fmt(bizUv)}`;
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-7 gap-4">
      {SUMMARY_CARDS.map(({ key, label, icon, color }) => {
        let value: string | number;
        if (key === 'total_scans_pv') {
          value = totalScans;
        } else if (key === 'biz_pv') {
          value = bizScans;
        } else {
          value = summary[key as keyof Summary];
        }
        return (
          <div key={key} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{icon}</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
            </div>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
          </div>
        );
      })}
    </div>
  );
}

// Unsent → red, Sent → purple, No Junk Mail → yellow (keyed by name so the
// mapping is stable regardless of the order pieData is built in).
const PIE_COLORS: Record<string, string> = {
  Unsent: '#DC2626',
  Sent: '#7C3AED',
  'No Junk Mail': '#EAB308',
};

function pieColor(name: string, fallbackIdx: number): string {
  return PIE_COLORS[name] ?? ['#DC2626', '#7C3AED', '#EAB308'][fallbackIdx % 3];
}

function PieChartLegend({ pieData, total }: { pieData: { name: string; value: number }[]; total: number }) {
  return (
    <div className="space-y-2 text-sm">
      {pieData.map((d, idx) => {
        const pct = ((d.value / total) * 100).toFixed(1);
        return (
          <div key={d.name} className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: pieColor(d.name, idx) }} />
            <span className="font-medium text-slate-700 w-32">{d.name}</span>
            <span className="text-slate-500">{d.value} ({pct}%)</span>
          </div>
        );
      })}
    </div>
  );
}

function CampaignOverview({ summary }: { summary: Summary }) {
  const total = summary.pending_count;
  if (total === 0) return null;

  // remaining_count is computed server-side as the distinct count of unsent
  // addresses (no send log and no no-junk flag). Fall back to the old
  // subtraction when the field is absent (older cached responses).
  const remaining = summary.remaining_count ?? summary.pending_count - summary.sent_count - summary.no_junk_mail_count;

  const pieData = [
    { name: 'Unsent', value: remaining },
    { name: 'Sent', value: summary.sent_count },
    { name: 'No Junk Mail', value: summary.no_junk_mail_count },
  ].filter(d => d.value > 0);

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">Campaign Overview — {total} Addresses</h3>
      <div className="flex flex-col md:flex-row items-center gap-8">
        <div className="shrink-0">
          <ResponsiveContainer width={220} height={220}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={50}>
                {pieData.map((entry, idx) => (
                  <Cell key={entry.name} fill={pieColor(entry.name, idx)} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <PieChartLegend pieData={pieData} total={total} />
      </div>
    </div>
  );
}

function DailySendChart({ data, noJunkTotal }: { data: DailySend[]; noJunkTotal: number }) {
  if (data.length === 0 && noJunkTotal === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-2">Daily Dispatch Volume</h3>
        <p className="text-sm text-slate-400">No dispatch data for this campaign.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-700">Daily Dispatch Volume</h3>
        {noJunkTotal > 0 && (
          <span className="text-xs font-medium text-yellow-600 bg-yellow-50 px-2.5 py-1 rounded-full">
            No Junk Mail: {noJunkTotal}
          </span>
        )}
      </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={formatDateLabel} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip labelFormatter={(v) => formatDateLabel(String(v))} />
          <Legend formatter={(value) => {
            let color = '#1e293b';
            let weight = 600;
            if (value.includes('Total Scans')) {
              color = '#064E3B';
              weight = 700;
            } else if (value.includes('Business Card Unique')) {
              color = '#1e3a5f';
              weight = 600;
            } else if (value.includes('Oteha Unique')) {
              color = '#14532D';
              weight = 600;
            }
            return <span style={{ color, fontWeight: weight, fontSize: '0.875rem' }}>{value}</span>;
          }} />
              <Bar dataKey="total_sent" name="Sent" fill="#7C3AED" radius={[4, 4, 0, 0]} />
              {noJunkTotal > 0 && (
                <Bar dataKey="no_junk_sent" name="No Junk Mail" fill="#EAB308" radius={[4, 4, 0, 0]} />
              )}
            </BarChart>
          </ResponsiveContainer>
    </div>
  );
}

// Scan Logs are in a separate component: CampaignScanLogsPanel

// ─── Combined Scan Chart ──────────────────────────────────────────────────────

interface CombinedScan {
  date: string;
  campaign_pv: number;
  campaign_uv: number;
  campaign_repeat: number;
  biz_pv: number;
  biz_uv: number;
  biz_repeat: number;
}

function mergeScanData(campaign: DailyScan[], bizCard: DailyScan[]): CombinedScan[] {
  const allDates = new Set([...campaign.map(d => d.date), ...bizCard.map(d => d.date)]);
  return [...allDates].sort().map(date => {
    const campaignPv = campaign.find(d => d.date === date)?.pv ?? 0;
    const campaignUv = campaign.find(d => d.date === date)?.uv ?? 0;
    const bizPv = bizCard.find(d => d.date === date)?.pv ?? 0;
    const bizUv = bizCard.find(d => d.date === date)?.uv ?? 0;
    return {
      date,
      campaign_pv: campaignPv,
      campaign_uv: campaignUv,
      campaign_repeat: Math.max(0, campaignPv - campaignUv),
      biz_pv: bizPv,
      biz_uv: bizUv,
      biz_repeat: Math.max(0, bizPv - bizUv),
    };
  });
}

function CombinedScanChart({ campaignScans, bizCardScans, campaignName = 'Campaign' }: { campaignScans: DailyScan[]; bizCardScans: DailyScan[]; campaignName?: string }) {
  const data = mergeScanData(campaignScans, bizCardScans);
  const displayCampaignName = campaignName
    ? campaignName.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : 'Campaign';

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-2">QR Code Scan Trend</h3>
        <p className="text-sm text-slate-400">Awaiting first QR scan.</p>
      </div>
    );
  }

  const totalCampaignPv = data.reduce((s, d) => s + d.campaign_pv, 0);
  const totalCampaignUv = data.reduce((s, d) => s + d.campaign_uv, 0);
  const totalBizPv = data.reduce((s, d) => s + d.biz_pv, 0);
  const totalBizUv = data.reduce((s, d) => s + d.biz_uv, 0);

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-700">QR Code Scan Trend</h3>
        <div className="flex gap-3 text-xs">
          <span className="font-medium text-green-600 bg-green-50 px-2.5 py-1 rounded-full">
            {displayCampaignName}: {totalCampaignPv} / {totalCampaignUv}
          </span>
          <span className="font-medium text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">
            Business Card: {totalBizPv} / {totalBizUv}
          </span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={250}>
        <ComposedChart data={data} barSize={16}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={formatDateLabel} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
          <Tooltip
            content={({ active, label }) => {
              if (!active || !label) return null;
              const row = data.find((d) => d.date === label);
              if (!row) return null;
              return (
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', fontSize: 13 }}>
                  <p style={{ fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>{formatDateLabel(String(label))}</p>
                  {(row.campaign_pv > 0 || row.campaign_uv > 0) && (
                    <div style={{ marginBottom: 6 }}>
                      <p style={{ color: '#16a34a', fontWeight: 700 }}>
                        {displayCampaignName} Total Scans (PV): {row.campaign_pv}
                      </p>
                      <p style={{ color: '#14532d', fontWeight: 600, paddingLeft: 8 }}>
                        └ Unique Visitors (UV): {row.campaign_uv}
                      </p>
                      {row.campaign_repeat > 0 && (
                        <p style={{ color: '#16a34a', fontWeight: 500, paddingLeft: 8, opacity: 0.85 }}>
                          └ Repeat Scans: {row.campaign_repeat}
                        </p>
                      )}
                    </div>
                  )}
                  {(row.biz_pv > 0 || row.biz_uv > 0) && (
                    <div>
                      <p style={{ color: '#2563eb', fontWeight: 700 }}>
                        Business Card Total Scans (PV): {row.biz_pv}
                      </p>
                      <p style={{ color: '#1d4ed8', fontWeight: 600, paddingLeft: 8 }}>
                        └ Unique Visitors (UV): {row.biz_uv}
                      </p>
                      {row.biz_repeat > 0 && (
                        <p style={{ color: '#2563eb', fontWeight: 500, paddingLeft: 8, opacity: 0.85 }}>
                          └ Repeat Scans: {row.biz_repeat}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            }}
          />
          <Legend formatter={(value) => {
            const colorMap: Record<string, string> = {
              'Business Card Repeat Scans': '#6366f1',
              'Business Card Unique Visitors': '#1d4ed8',
              [`${displayCampaignName} Repeat Scans`]: '#16a34a',
              [`${displayCampaignName} Unique Visitors`]: '#14532d',
            };
            const color = colorMap[value] ?? '#1e293b';
            return <span style={{ color, fontWeight: 600, fontSize: '0.8125rem' }}>{value}</span>;
          }} />
          <Bar dataKey="campaign_uv" name={`${displayCampaignName} Unique Visitors`} stackId="a" fill="#16A34A" radius={[0, 0, 0, 0]} />
          <Bar dataKey="campaign_repeat" name={`${displayCampaignName} Repeat Scans`} stackId="a" fill="rgba(22, 163, 74, 0.25)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="biz_uv" name="Business Card Unique Visitors" stackId="b" fill="#2563EB" radius={[0, 0, 0, 0]} />
          <Bar dataKey="biz_repeat" name="Business Card Repeat Scans" stackId="b" fill="rgba(99, 102, 241, 0.3)" radius={[4, 4, 0, 0]} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

const CAMPAIGN_STORAGE_KEY = 'activity_dispatch_campaign';

function getStoredCampaign(): string {
  try {
    return window.localStorage.getItem(CAMPAIGN_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

function storeCampaign(campaign: string): void {
  try {
    if (campaign) window.localStorage.setItem(CAMPAIGN_STORAGE_KEY, campaign);
    else window.localStorage.removeItem(CAMPAIGN_STORAGE_KEY);
  } catch {
    // ignore storage errors (private browsing / SSR)
  }
}

export default function DispatchStatsPanel() {
  const [campaigns, setCampaigns] = useState<string[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string>('');
  const [defaultCampaign, setDefaultCampaign] = useState<string>('');
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [savingDefault, setSavingDefault] = useState(false);
  const [error, setError] = useState('');

  const statsCacheRef = React.useRef<Map<string, CampaignStats>>(new Map());

  // "2026_Q2_Torbay" → "Torbay 2026 Q2"; falls back to a readable key.
  const formatCampaignLabel = (c: string) => {
    const parts = c.split('_');
    if (parts.length >= 3) {
      const [year, quarter, ...suburbParts] = parts;
      return `${suburbParts.join(' ')} ${year} ${quarter}`.trim();
    }
    return c.replace(/_/g, ' ');
  };

  const fetchStats = useCallback(async (campaign: string) => {
    const cached = statsCacheRef.current.get(campaign);
    if (cached) {
      setStats(cached);
    } else {
      setLoading(true);
    }
    setError('');
    try {
      const params = new URLSearchParams({ campaign });
      const res = await fetch(`/api/admin/outreach/campaign-stats?${params}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to fetch');
      }
      const data = await res.json();
      setStats(data);
      statsCacheRef.current.set(campaign, data);
    } catch (err) {
      if (!cached) {
        setError(err instanceof Error ? err.message : 'Failed to load stats');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    // Optimistic: start loading the last-known campaign immediately so the
    // default content appears as soon as a single request returns, without
    // waiting for the campaign list round-trip first.
    const optimistic = getStoredCampaign();
    if (optimistic) {
      fetchStats(optimistic);
    }

    const fetchCampaigns = async () => {
      setLoadingCampaigns(true);
      try {
        const res = await fetch('/api/admin/outreach/campaign-stats');
        if (res.ok) {
          const data = await res.json();
          const list: string[] = data.available_campaigns || [];
          const def: string = data.default_campaign || '';
          if (cancelled) return;
          setCampaigns(list);
          setDefaultCampaign(def);
          const chosen = list.length > 0
            ? def && list.includes(def)
              ? def
              : list[0]
            : '';
          setSelectedCampaign(chosen);
          storeCampaign(chosen);
        } else {
          const data = await res.json().catch(() => ({}));
          if (!cancelled) setError(data.error || `Failed to load campaigns (${res.status})`);
        }
      } catch {
        if (!cancelled) setError('Failed to load campaigns');
      } finally {
        if (!cancelled) setLoadingCampaigns(false);
      }
    };
    fetchCampaigns();

    return () => { cancelled = true; };
  }, [fetchStats]);

  const setAsDefault = async () => {
    if (!selectedCampaign) return;
    setSavingDefault(true);
    setError('');
    try {
      const res = await fetch('/api/admin/outreach/default-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign: selectedCampaign }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to set default campaign');
      }
      setDefaultCampaign(selectedCampaign);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set default campaign');
    } finally {
      setSavingDefault(false);
    }
  };

  useEffect(() => {
    if (selectedCampaign) {
      fetchStats(selectedCampaign);
    }
  }, [selectedCampaign, fetchStats]);

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm font-semibold text-slate-700 mr-1">Campaign:</label>
        {loadingCampaigns ? (
          <div className="h-10 w-64 bg-slate-100 rounded-xl animate-pulse" />
        ) : campaigns.length === 0 ? (
          <span className="text-sm text-slate-400">No campaign data available.</span>
        ) : (
          campaigns.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setSelectedCampaign(c)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                selectedCampaign === c
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              {formatCampaignLabel(c)}
              {defaultCampaign === c && <span className="ml-1 opacity-80" title="Default campaign">★</span>}
            </button>
          ))
        )}
        {!loadingCampaigns && campaigns.length > 0 && selectedCampaign && (
          <button
            type="button"
            onClick={setAsDefault}
            disabled={savingDefault}
            title="Open this page with this campaign pre-selected"
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer border ${
              defaultCampaign === selectedCampaign
                ? 'bg-amber-50 text-amber-700 border-amber-300 cursor-default'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-amber-50 hover:border-amber-300'
            } disabled:opacity-50`}
          >
            {savingDefault
              ? 'Saving…'
              : defaultCampaign === selectedCampaign
                ? '★ Default'
                : '☆ Set as default'}
          </button>
        )}
      </div>

      {stats ? (
        <>
          <SummaryCards summary={stats.summary} bizPv={stats.business_card_summary.pv} bizUv={stats.business_card_summary.uv} />
          <CampaignOverview summary={stats.summary} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <DailySendChart data={stats.daily_sends} noJunkTotal={stats.summary.no_junk_mail_count} />
            <CombinedScanChart campaignScans={stats.daily_scans} bizCardScans={stats.business_card_daily_scans} campaignName={stats.campaign} />
          </div>
          <CampaignScanLogsPanel />
        </>
      ) : loading || loadingCampaigns ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
                <div className="h-4 bg-slate-100 rounded w-16 mb-2 animate-pulse" />
                <div className="h-7 bg-slate-100 rounded w-12 animate-pulse" />
              </div>
            ))}
          </div>
          <div className="h-64 bg-slate-50 rounded-xl animate-pulse" />
        </div>
      ) : !error && campaigns.length > 0 ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
          Select a campaign to view dispatch statistics.
        </div>
      ) : null}
    </div>
  );
}

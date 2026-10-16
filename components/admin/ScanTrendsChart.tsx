'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Customized,
} from 'recharts';

type Campaign = { key: string; name: string };

const TIME_RANGES = ['1h', '6h', '1d', '2d', '1w', '2w', '1m', '2m', '3m', '6m', '1y'] as const;
type TimeRange = typeof TIME_RANGES[number];

const COLORS = [
  '#2563EB', '#DC2626', '#16A34A', '#D97706', '#8B5CF6',
  '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16',
  '#0D9488', '#7C3AED', '#DB2777', '#CA8A04',
];

const NEW_DEVICES_COLOR = '#059669';

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function formatTime(time: string, isSubDay: boolean): string {
  if (isSubDay) {
    const d = new Date(time);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  const parts = time.split('-');
  if (parts.length >= 3) {
    return `${parts[1]}/${parts[2].substring(0, 2)}`;
  }
  return time;
}

function CustomTooltip({
  active, payload, label, isSubDay, campaigns, colors,
}: {
  active?: boolean; payload?: { dataKey?: string; value?: number; color?: string }[]; label?: string;
  isSubDay: boolean; campaigns: Campaign[]; colors: string[];
}) {
  if (!active || !payload || payload.length === 0) return null;

  const dateLabel = isSubDay
    ? new Date(label as string).toLocaleString('en-NZ', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
      })
    : new Date((label as string) + 'T00:00:00').toLocaleDateString('en-NZ', {
        weekday: 'short', month: 'short', day: 'numeric',
      });

  const total = payload.reduce((sum, p) => sum + (Number(p.value) || 0), 0);

  return (
    <div
      style={{
        background: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: 10,
        padding: '10px 14px',
        fontSize: 12,
        boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
        minWidth: 160,
      }}
    >
      <p style={{ fontWeight: 600, color: '#374151', marginBottom: 8 }}>{dateLabel}</p>
      {payload.map((p, i) => {
        const isNewDevices = p.dataKey === 'newDevices';
        const campaign = campaigns.find(c => c.key === p.dataKey);
        const color = isNewDevices ? NEW_DEVICES_COLOR : colors[i % colors.length];
        const label = isNewDevices ? 'New Devices' : (campaign?.name ?? String(p.dataKey));
        return (
          <div key={String(p.dataKey)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
              <span style={{ color: '#6b7280' }}>{label}</span>
            </div>
            <span style={{ fontWeight: 600, color: '#111827' }}>{Number(p.value).toLocaleString()}</span>
          </div>
        );
      })}
      {payload.length > 1 && (
        <div style={{ borderTop: '1px solid #f3f4f6', marginTop: 6, paddingTop: 6, display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#9ca3af', fontSize: 11 }}>Total</span>
          <span style={{ fontWeight: 700, color: '#111827' }}>{total.toLocaleString()}</span>
        </div>
      )}
    </div>
  );
}

interface ScanTrendsChartProps {
  onDrillDown: (date: string, campaignKey: string) => void;
}

export default function ScanTrendsChart({ onDrillDown }: ScanTrendsChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('1m');
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isSubDay, setIsSubDay] = useState(false);
  const [visibleCampaigns, setVisibleCampaigns] = useState<Set<string>>(new Set());
  const [showNewDevices, setShowNewDevices] = useState(true);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/analytics/scan-trends?range=${timeRange}`);
      const result = await res.json();
      if (result.success) {
        setData(result.data || []);
        setCampaigns(result.campaigns || []);
        setIsSubDay(result.isSubDay || false);
        setVisibleCampaigns(new Set((result.campaigns || []).map((c: Campaign) => c.key)));
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleCampaign = (key: string) => {
    setVisibleCampaigns(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        const canRemove = next.size > 1 || showNewDevices;
        if (canRemove) next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const campaignsToShow = campaigns.filter(c => visibleCampaigns.has(c.key));
  const campaignKeys = campaignsToShow.map(c => c.key);
  const zeroScanTimes = new Set(
    data
      .filter(d => {
        const campaignsZero = campaignKeys.length === 0 || campaignKeys.every(k => (Number(d[k]) || 0) === 0);
        const newDevicesZero = !showNewDevices || (Number(d.newDevices) || 0) === 0;
        return (campaignKeys.length > 0 || showNewDevices) && campaignsZero && newDevicesZero;
      })
      .map(d => d.time as string)
  );

  const ZeroScanDots = (props: { formattedGraphicalItems?: unknown[]; xAxisMap?: Record<string, { scale: (v: string) => number }> }) => {
    if (zeroScanTimes.size === 0 || !props.xAxisMap) return null;
    const xAxis = props.xAxisMap?.[0];
    if (!xAxis) return null;
    const margin = { top: 5, right: 20, left: 10, bottom: 5 };
    return (
      <g>
        {Array.from(zeroScanTimes).map(t => {
          const cx = xAxis.scale(t);
          if (!cx || cx < 0) return null;
          return (
            <g key={t}>
              <line x1={cx} y1={margin.top} x2={cx} y2={300 - margin.bottom} stroke="#f3f4f6" strokeWidth={1} strokeDasharray="2 2" />
              <circle cx={cx} cy={300 - margin.bottom - 2} r={3} fill="#e5e7eb" />
            </g>
          );
        })}
      </g>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Scan Trends</h3>
        <div className="flex flex-wrap gap-1">
          {TIME_RANGES.map(r => (
            <button
              key={r}
              onClick={() => setTimeRange(r)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                timeRange === r
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {/* New Devices toggle — always first */}
        <button
          onClick={() => {
            setShowNewDevices(v => {
              const next = !v;
              if (!next && visibleCampaigns.size === 0) {
                setVisibleCampaigns(new Set(campaigns.map(c => c.key)));
              }
              return next;
            });
          }}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all border"
          style={{
            backgroundColor: showNewDevices ? hexToRgba(NEW_DEVICES_COLOR, 0.1) : '#f9fafb',
            borderColor: showNewDevices ? NEW_DEVICES_COLOR : '#e5e7eb',
            color: showNewDevices ? NEW_DEVICES_COLOR : '#9ca3af',
          }}
        >
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: showNewDevices ? NEW_DEVICES_COLOR : '#d1d5db' }} />
          New Devices
        </button>
        {campaigns.map((c, i) => {
          const active = visibleCampaigns.has(c.key);
          const color = COLORS[i % COLORS.length];
          return (
            <button
              key={c.key}
              onClick={() => toggleCampaign(c.key)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all border"
              style={{
                backgroundColor: active ? hexToRgba(color, 0.08) : '#f9fafb',
                borderColor: active ? color : '#e5e7eb',
                color: active ? color : '#9ca3af',
              }}
            >
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
              {c.name}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-[300px] text-gray-400 text-sm">
          Loading chart data...
        </div>
      ) : data.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[300px] gap-3">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
            <rect width="40" height="40" rx="8" fill="#f3f4f6" />
            <path d="M8 28 L14 20 L20 23 L26 14 L32 18" stroke="#d1d5db" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <circle cx="14" cy="20" r="2" fill="#d1d5db" />
            <circle cx="20" cy="23" r="2" fill="#d1d5db" />
            <circle cx="26" cy="14" r="2" fill="#d1d5db" />
          </svg>
          <p className="text-sm text-gray-400">No scan data yet for this time range.</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart
            data={data}
            margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
            onClick={(e) => {
              const date = e?.activeLabel as string | undefined;
              const campaignKey = e?.activeDataKey as string | undefined;
              if (date) {
                const displayDate = isSubDay
                  ? new Date(date).toISOString().split('T')[0]
                  : date;
                onDrillDown(displayDate, campaignKey || '');
              }
            }}
          >
            <defs>
              {campaignsToShow.map((c, i) => {
                const color = COLORS[i % COLORS.length];
                return (
                  <linearGradient key={c.key} id={`grad-${c.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={color} stopOpacity={0.18} />
                    <stop offset="95%" stopColor={color} stopOpacity={0.02} />
                  </linearGradient>
                );
              })}
              <linearGradient id="grad-newDevices" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={NEW_DEVICES_COLOR} stopOpacity={0.25} />
                <stop offset="95%" stopColor={NEW_DEVICES_COLOR} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis
              dataKey="time"
              tickFormatter={(v) => formatTime(v, isSubDay)}
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              axisLine={{ stroke: '#e5e7eb' }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              allowDecimals={false}
              domain={[0, 'auto']}
              tickCount={5}
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
              width={32}
            />
            <Tooltip
              content={
                <CustomTooltip
                  isSubDay={isSubDay}
                  campaigns={campaignsToShow}
                  colors={COLORS}
                />
              }
              cursor={{ stroke: '#e5e7eb', strokeWidth: 1, strokeDasharray: '4 4' }}
            />
            {campaignsToShow.map((c, i) => {
              const color = COLORS[i % COLORS.length];
              return (
                <Area
                  key={c.key}
                  type="monotone"
                  dataKey={c.key}
                  name={c.name}
                  stroke={color}
                  strokeWidth={2}
                  fill={`url(#grad-${c.key})`}
                  dot={{ r: 3, fill: color, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: color, strokeWidth: 2, stroke: 'white' }}
                  connectNulls
                />
              );
            })}
            {showNewDevices && (
              <Area
                type="monotone"
                dataKey="newDevices"
                name="New Devices"
                stroke={NEW_DEVICES_COLOR}
                strokeWidth={2.5}
                strokeDasharray="5 3"
                fill="url(#grad-newDevices)"
                dot={{ r: 3, fill: NEW_DEVICES_COLOR, strokeWidth: 0 }}
                activeDot={{ r: 5, fill: NEW_DEVICES_COLOR, strokeWidth: 2, stroke: 'white' }}
                connectNulls
              />
            )}
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
              onClick={(e) => {
                const key = e.dataKey as string;
                if (key) toggleCampaign(key);
              }}
              iconType="circle"
              iconSize={8}
            />
            <Customized component={ZeroScanDots} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

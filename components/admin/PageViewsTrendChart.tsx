'use client';

import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { buildPageViewTrendChartData } from '@/lib/page-view-trend';
import { usePageViews } from '@/components/admin/PageViewsProvider';

const PERIODS = [7, 30, 90] as const;
const SERIES_COLORS = {
  market_report: ['#1D4ED8', '#2563EB', '#3B82F6', '#1E40AF', '#60A5FA'],
  blog_article: ['#15803D', '#16A34A', '#22C55E', '#166534', '#4ADE80'],
} as const;

function formatDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-NZ', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

export default function PageViewsTrendChart() {
  const { analytics, error, loading, refresh } = usePageViews();
  const [days, setDays] = useState<number>(7);
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());
  const chartData = useMemo(
    () => analytics
      ? buildPageViewTrendChartData(analytics, days)
      : { points: [], series: [] },
    [analytics, days],
  );

  return (
    <section
      aria-label="Content view trends"
      className="min-w-0 rounded-lg border border-slate-100 bg-white p-6 shadow-sm"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">Content View Trends</h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-3 text-xs" aria-label="Content types">
            <span className="inline-flex items-center gap-1.5 text-blue-700">
              <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-blue-700" />
              North Shore Reports
            </span>
            <span className="inline-flex items-center gap-1.5 text-green-700">
              <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-green-700" />
              Blog
            </span>
          </div>
          <div className="flex gap-1" aria-label="Date range">
            {PERIODS.map((period) => (
              <button
                key={period}
                type="button"
                aria-pressed={days === period}
                onClick={() => setDays(period)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                  days === period
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {period}d
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {loading && !analytics ? (
        <div role="status" aria-label="Loading content view trends" className="h-[300px] animate-pulse rounded bg-slate-50" />
      ) : error && !analytics ? (
        <p role="alert" className="flex h-[300px] items-center justify-center text-sm text-red-700">
          Views unavailable: {error}
        </p>
      ) : chartData.series.length === 0 ? (
        <p className="flex h-[300px] items-center justify-center text-sm text-slate-500">
          No published content views in this period.
        </p>
      ) : (
        <>
          {error && <p role="alert" className="mb-2 text-xs text-red-700">Refresh failed: {error}</p>}
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData.points} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                axisLine={{ stroke: '#e5e7eb' }}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                allowDecimals={false}
                domain={[0, 'auto']}
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                axisLine={false}
                tickLine={false}
                width={36}
              />
              <Tooltip
                labelFormatter={(label) => formatDate(String(label))}
                formatter={(value, name) => [Number(value).toLocaleString('en-NZ'), String(name)]}
                contentStyle={{ borderRadius: 8, borderColor: '#e2e8f0', fontSize: 12 }}
              />
              <Legend
                wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
                onClick={(entry) => {
                  const key = String(entry.dataKey ?? '');
                  if (!key) return;
                  setHiddenSeries((current) => {
                    const next = new Set(current);
                    if (next.has(key)) next.delete(key);
                    else next.add(key);
                    return next;
                  });
                }}
              />
              {chartData.series.map((series, index) => {
                const colorIndex = chartData.series
                  .slice(0, index)
                  .filter((previous) => previous.page_type === series.page_type).length;
                const labelPrefix = series.page_type === 'market_report' ? 'North Shore Report' : 'Blog';
                return (
                  <Line
                    key={series.key}
                    type="monotone"
                    dataKey={series.key}
                    name={`${labelPrefix} - ${series.label}`}
                    stroke={SERIES_COLORS[series.page_type][colorIndex % SERIES_COLORS[series.page_type].length]}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                    hide={hiddenSeries.has(series.key)}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
          <div className="mt-2 text-center text-xs text-slate-500">
            Showing up to 5 items per content type. Click a legend item to toggle its line.
          </div>
        </>
      )}
    </section>
  );
}

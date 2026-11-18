'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { PageViewAnalytics, PageViewPeriods } from '@/lib/page-view-analytics';
import { pageViewPeriodLabel } from '@/lib/page-view-analytics';

function formatCount(value: number): string {
  return value.toLocaleString('en-NZ');
}

function PeriodCounts({ views }: { views: PageViewPeriods }) {
  return (
    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
      <span>This week: {formatCount(views.week)}</span>
      <span>This month: {formatCount(views.month)}</span>
      <span>This year: {formatCount(views.year)}</span>
    </div>
  );
}

export default function PageViewsCard() {
  const [analytics, setAnalytics] = useState<PageViewAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [queueWarning, setQueueWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  const loadAnalytics = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    setError(null);
    setQueueWarning(null);
    try {
      const response = await fetch('/api/admin/analytics/page-views', {
        method: 'POST',
        cache: 'no-store',
        signal,
      });
      const result = await response.json() as {
        success: boolean;
        data?: PageViewAnalytics;
        error?: string;
        queueSync?: { warning?: string };
      };
      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error || 'Failed to load page views.');
      }
      setAnalytics(result.data);
      setQueueWarning(result.queueSync?.warning ?? null);
    } catch (caught) {
      if (signal.aborted) return;
      setError(caught instanceof Error ? caught.message : 'Failed to load page views.');
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadAnalytics(controller.signal);
    return () => controller.abort();
  }, [loadAnalytics, reloadKey]);

  const recentPeriods = useMemo(() => {
    const periods = new Map<string, {
      label: string;
      en?: number;
      zh?: number;
    }>();
    for (const report of analytics?.reports ?? []) {
      if (report.status === 'draft') continue;
      const key = `${report.period_type}:${report.period_key}`;
      const period = periods.get(key) ?? {
        label: pageViewPeriodLabel(report),
      };
      period[report.language] = report.views.total;
      periods.set(key, period);
    }
    return [...periods.values()].slice(0, 4);
  }, [analytics]);
  const recentBlogPosts = useMemo(
    () => (analytics?.blog_posts ?? [])
      .filter((post) => post.status === 'published')
      .slice()
      .sort((a, b) => b.views.total - a.views.total)
      .slice(0, 4),
    [analytics],
  );

  return (
    <section
      aria-label="Views"
      className="min-h-[192px] min-w-0 rounded-lg border border-slate-100 bg-white p-5 shadow-sm"
    >
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Views</h2>
          <p className="text-xs text-slate-500">Page loads since tracking began</p>
        </div>
        <span aria-hidden="true" className="text-2xl">👁</span>
      </div>

      {loading && !analytics ? (
        <div role="status" aria-label="Loading page views" className="space-y-3">
          <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-slate-100" />
        </div>
      ) : error && !analytics ? (
        <div>
          <p role="alert" className="text-sm text-red-700">Views unavailable: {error}</p>
          <button
            type="button"
            onClick={() => setReloadKey((key) => key + 1)}
            className="mt-2 text-xs font-medium text-blue-700 hover:underline"
          >
            Retry
          </button>
        </div>
      ) : analytics ? (
        <>
          {error && <p role="alert" className="mb-2 text-xs text-red-700">Refresh failed: {error}</p>}
          {queueWarning && <p role="alert" className="mb-2 text-xs text-amber-700">{queueWarning}</p>}
          <div className="space-y-3">
            <div className="rounded-md bg-blue-50 p-3">
              <p className="text-xs font-medium text-blue-800">Market Views</p>
              <p className="mt-0.5 text-2xl font-bold text-blue-950">{formatCount(analytics.market.total)}</p>
              <PeriodCounts views={analytics.market} />
            </div>
            <div className="rounded-md bg-violet-50 p-3">
              <p className="text-xs font-medium text-violet-800">Blog Views</p>
              <p className="mt-0.5 text-2xl font-bold text-violet-950">{formatCount(analytics.blog.total)}</p>
              <PeriodCounts views={analytics.blog} />
            </div>
            <div className="border-t border-slate-100 pt-2">
              <div className="mb-1 flex items-center justify-between">
                <h3 className="text-xs font-semibold text-slate-700">Report Views by Period</h3>
                <Link href="/admin/market" className="text-[11px] font-medium text-blue-700 hover:underline">
                  Open Market
                </Link>
              </div>
              {recentPeriods.length > 0 ? (
                <div className="space-y-1">
                  {recentPeriods.map((period) => (
                    <div key={period.label} className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate font-medium text-slate-700">{period.label}</span>
                      <span className="shrink-0 text-slate-500">
                        English {period.en === undefined ? '—' : formatCount(period.en)}
                        {' · '}
                        Chinese {period.zh === undefined ? '—' : formatCount(period.zh)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500">No published Market reports yet.</p>
              )}
            </div>
            <div className="border-t border-slate-100 pt-2">
              <div className="mb-1 flex items-center justify-between">
                <h3 className="text-xs font-semibold text-slate-700">Article Views</h3>
                <Link href="/admin/blog" className="text-[11px] font-medium text-blue-700 hover:underline">
                  Open Blog
                </Link>
              </div>
              {recentBlogPosts.length > 0 ? (
                <div className="space-y-1">
                  {recentBlogPosts.map((post) => (
                    <div key={post.id} className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate font-medium text-slate-700">{post.title}</span>
                      <span className="shrink-0 text-slate-500">{formatCount(post.views.total)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500">No published Blog articles yet.</p>
              )}
            </div>
            <div className="rounded-md bg-slate-50 p-3">
              <p className="text-xs font-medium text-slate-600">Home Views</p>
              <p className="mt-0.5 text-2xl font-bold text-slate-900">{formatCount(analytics.home.total)}</p>
              <PeriodCounts views={analytics.home} />
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}

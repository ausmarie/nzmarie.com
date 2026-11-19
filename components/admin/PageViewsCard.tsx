'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import type { PageViewAnalytics, PageViewPeriods } from '@/lib/page-view-analytics';
import { pageViewPeriodLabel } from '@/lib/page-view-analytics';
import { usePageViews } from '@/components/admin/PageViewsProvider';

function formatCount(value: number): string {
  return value.toLocaleString('en-NZ');
}

function PeriodCounts({ views }: { views: PageViewPeriods }) {
  return (
    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
      <span>Today {formatCount(views.today)}</span>
      <span>This week: {formatCount(views.week)}</span>
      <span>This month: {formatCount(views.month)}</span>
      <span>This year: {formatCount(views.year)}</span>
    </div>
  );
}

export default function PageViewsCard() {
  const { analytics, error, loading, refresh } = usePageViews();

  const recentPeriods = useMemo(() => {
    const periods = new Map<string, {
      label: string;
      en?: PageViewPeriods;
      zh?: PageViewPeriods;
    }>();
    for (const report of analytics?.reports ?? []) {
      if (report.status === 'draft') continue;
      const key = `${report.period_type}:${report.period_key}`;
      const period = periods.get(key) ?? {
        label: pageViewPeriodLabel(report),
      };
      period[report.language] = report.views;
      periods.set(key, period);
    }
    return [...periods.values()].slice(0, 4);
  }, [analytics]);
  const recentBlogPosts = useMemo(
    () => {
      const groups = new Map<string, {
        id: string;
        title: string;
        published_at: string | null;
        en?: PageViewAnalytics['blog_posts'][number];
        cn?: PageViewAnalytics['blog_posts'][number];
      }>();
      for (const post of analytics?.blog_posts ?? []) {
        if (post.status !== 'published') continue;
        const group = groups.get(post.translation_group_id) ?? {
          id: post.translation_group_id,
          title: post.title,
          published_at: post.published_at,
        };
        group[post.language] = post;
        if (post.language === 'en') group.title = post.title;
        if (post.published_at && (!group.published_at || post.published_at > group.published_at)) {
          group.published_at = post.published_at;
        }
        groups.set(post.translation_group_id, group);
      }
      return [...groups.values()]
        .sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? ''))
        .slice(0, 4);
    },
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
            onClick={refresh}
            className="mt-2 text-xs font-medium text-blue-700 hover:underline"
          >
            Retry
          </button>
        </div>
      ) : analytics ? (
        <>
          {error && <p role="alert" className="mb-2 text-xs text-red-700">Refresh failed: {error}</p>}
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
                      <span className="shrink-0 text-right text-slate-500">
                        <span className="block">
                          Today {formatCount((period.en?.today ?? 0) + (period.zh?.today ?? 0))}
                          {' · '}
                          Total {formatCount((period.en?.total ?? 0) + (period.zh?.total ?? 0))}
                        </span>
                        <span className="block text-[10px]">
                          English {period.en ? formatCount(period.en.total) : '—'}
                          {' · '}
                          Chinese {period.zh ? formatCount(period.zh.total) : '—'}
                        </span>
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
                <h3 className="text-xs font-semibold text-slate-700">Article Views by Language</h3>
                <Link href="/admin/blog" className="text-[11px] font-medium text-blue-700 hover:underline">
                  Open Blog
                </Link>
              </div>
              {recentBlogPosts.length > 0 ? (
                <div className="space-y-1">
                  {recentBlogPosts.map((group) => (
                    <div key={group.id} className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate font-medium text-slate-700">{group.title}</span>
                      <span className="shrink-0 text-right text-slate-500">
                        <span className="block">
                          Today {formatCount((group.en?.views.today ?? 0) + (group.cn?.views.today ?? 0))}
                          {' · '}
                          Total {formatCount((group.en?.views.total ?? 0) + (group.cn?.views.total ?? 0))}
                        </span>
                        <span className="block text-[10px]">
                          English {group.en ? formatCount(group.en.views.total) : '—'}
                          {' · '}
                          Chinese {group.cn ? formatCount(group.cn.views.total) : '—'}
                        </span>
                      </span>
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

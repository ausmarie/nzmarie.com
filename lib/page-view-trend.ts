import type { PageViewAnalytics, PageViewTrendPoint } from '@/lib/page-view-analytics';
import { pageViewPeriodLabel } from '@/lib/page-view-analytics';

export interface PageViewTrendSeries {
  key: string;
  id: string;
  label: string;
  total: number;
  page_type: PageViewTrendPoint['page_type'];
}

export interface PageViewTrendChartData {
  points: Array<Record<string, number | string>>;
  series: PageViewTrendSeries[];
}

const EMPTY_CHART_DATA: PageViewTrendChartData = { points: [], series: [] };

function getTrendDates(todayDate: string, days: number): string[] {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(todayDate);
  if (!match) return [];

  const today = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (!Number.isFinite(today)) return [];

  return Array.from({ length: days }, (_, index) =>
    new Date(today - (days - index - 1) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  );
}

export function buildPageViewTrendChartData(
  analytics: PageViewAnalytics,
  days: number,
  maxSeriesPerType = 5,
): PageViewTrendChartData {
  const dates = getTrendDates(analytics.today_date, days);
  if (dates.length === 0) return EMPTY_CHART_DATA;

  const dateSet = new Set(dates);
  const contentGroups = new Map<string, { label: string }>();
  const contentGroupById = new Map<string, string>();
  const contentKey = (pageType: PageViewTrendPoint['page_type'], id: string) => `${pageType}:${id}`;

  for (const post of analytics.blog_posts) {
    if (post.status !== 'published') continue;
    const groupId = contentKey('blog_article', post.translation_group_id);
    const current = contentGroups.get(groupId);
    if (!current || post.language === 'en') {
      contentGroups.set(groupId, {
        label: post.title,
      });
    }
    contentGroupById.set(contentKey('blog_article', post.id), groupId);
  }
  for (const report of analytics.reports) {
    if (report.status !== 'published') continue;
    const groupId = contentKey('market_report', `${report.period_type}:${report.period_key}`);
    contentGroups.set(groupId, {
      label: pageViewPeriodLabel(report),
    });
    contentGroupById.set(contentKey('market_report', report.id), groupId);
  }

  const viewsByGroup = new Map<string, Map<string, number>>();
  for (const point of analytics.trend) {
    if (!dateSet.has(point.date)) continue;
    const groupId = contentGroupById.get(contentKey(point.page_type, point.content_id));
    if (!groupId) continue;

    const dateViews = viewsByGroup.get(groupId) ?? new Map<string, number>();
    dateViews.set(point.date, (dateViews.get(point.date) ?? 0) + point.views);
    viewsByGroup.set(groupId, dateViews);
  }

  const series = (['market_report', 'blog_article'] as const).flatMap((pageType) =>
    [...viewsByGroup.entries()]
      .filter(([id]) => id.startsWith(`${pageType}:`))
      .map(([groupId, dateViews]) => ({
        id: groupId.slice(pageType.length + 1),
        page_type: pageType,
        label: contentGroups.get(groupId)?.label ?? groupId,
        total: [...dateViews.values()].reduce((sum, views) => sum + views, 0),
      }))
      .filter((item) => item.total > 0)
      .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label))
      .slice(0, maxSeriesPerType)
      .map((item) => ({
        ...item,
        key: `series-${pageType}-${encodeURIComponent(item.id)}`,
      })),
  );

  if (series.length === 0) return { points: [], series: [] };

  const points = dates.map((date) => {
    const point: Record<string, number | string> = { date };
    for (const item of series) {
      const groupId = contentKey(item.page_type, item.id);
      point[item.key] = viewsByGroup.get(groupId)?.get(date) ?? 0;
    }
    return point;
  });

  return { points, series };
}

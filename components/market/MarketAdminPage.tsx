'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import MarketReportEditor from '@/components/market/MarketReportEditor';
import MarketGenerateReportModal from '@/components/market/MarketGenerateReportModal';
import type { MarketReportLanguage, MarketReportSnapshot, MarketReportPeriodType } from '@/lib/market-report-data';
import { ensureMarketReportTitleIcon, refreshMarketReportGeneratedBlocks } from '@/lib/market-report-document';
import type { PageViewAnalytics } from '@/lib/page-view-analytics';
import { pageViewPeriodLabel } from '@/lib/page-view-analytics';
import {
  marketReportAdminPublicUrl,
  marketReportDraftPreviewUrl,
  marketReportDraftUrl,
  parseMarketReportSlug,
} from '@/lib/market-report-url';
import { getDefaultMarketReportFooter } from '@/lib/market-report-footer';
import type { ReportEditorContent } from '@/types/report';

interface MarketReportSummary {
  id: string;
  period_type: MarketReportPeriodType;
  period_key: string;
  language: MarketReportLanguage;
  title: string;
  summary: string;
  status: 'draft' | 'published' | 'withdrawn';
  has_unpublished_changes: boolean;
  published_at: string | null;
  withdrawn_at: string | null;
  updated_at: string;
}

interface MarketReport extends MarketReportSummary {
  content: ReportEditorContent;
  data_snapshot: MarketReportSnapshot;
  footer: string | null;
}

const buttonClass = 'rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50';

function periodLabel(report: Pick<MarketReportSummary, 'period_type' | 'period_key'>): string {
  if (report.period_type === 'quarterly') {
    const [year, quarter] = report.period_key.split('-Q');
    return `Q${quarter} ${year}`;
  }
  const [year, month] = report.period_key.split('-').map(Number);
  return new Intl.DateTimeFormat('en-NZ', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, 1)));
}

function periodOrder(report: Pick<MarketReportSummary, 'period_type' | 'period_key'>): number {
  const [yearText, periodText] = report.period_key.split(report.period_type === 'monthly' ? '-' : '-Q');
  const year = Number(yearText);
  const period = Number(periodText);
  return report.period_type === 'monthly' ? year * 12 + period : year * 12 + period * 3;
}

function initialContent(value: unknown): ReportEditorContent {
  return Array.isArray(value) ? value as ReportEditorContent : [{ type: 'paragraph' }];
}

function formatViewCount(value: number): string {
  return value.toLocaleString('en-NZ');
}

function ViewMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-white px-3 py-2">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="mt-0.5 text-lg font-semibold text-slate-900">{formatViewCount(value)}</p>
    </div>
  );
}

export default function MarketAdminPage({
  initialSlug,
  initialLanguage = 'en',
}: {
  initialSlug?: string;
  initialLanguage?: MarketReportLanguage;
} = {}) {
  const router = useRouter();
  const [reports, setReports] = useState<MarketReportSummary[]>([]);
  const [latestAvailableMonth, setLatestAvailableMonth] = useState<string | null>(null);
  const [active, setActive] = useState<MarketReport | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);
  const [working, setWorking] = useState(false);
  const [deletingReportId, setDeletingReportId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [footer, setFooter] = useState('');
  const [footerDraft, setFooterDraft] = useState('');
  const [footerDialogOpen, setFooterDialogOpen] = useState(false);
  const [pageViews, setPageViews] = useState<PageViewAnalytics | null>(null);
  const [pageViewsError, setPageViewsError] = useState<string | null>(null);
  const [pageViewsLoading, setPageViewsLoading] = useState(true);
  const [pageViewsReloadKey, setPageViewsReloadKey] = useState(0);
  const [content, setContent] = useState<ReportEditorContent>([{ type: 'paragraph' }]);
  const [editorRevision, setEditorRevision] = useState(0);
  const [draftRevision, setDraftRevision] = useState(0);
  const [savedRevision, setSavedRevision] = useState(0);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'unsaved' | 'saving'>('saved');
  const getContentRef = useRef<(() => ReportEditorContent) | null>(null);
  const draftRevisionRef = useRef(0);
  const saveInProgressRef = useRef(false);

  const markDraftChanged = useCallback(() => {
    const revision = draftRevisionRef.current + 1;
    draftRevisionRef.current = revision;
    setDraftRevision(revision);
    setSaveStatus('unsaved');
  }, []);

  const loadList = useCallback(async () => {
    setLoadingList(true);
    try {
      const response = await fetch('/api/admin/market-reports', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Failed to load Market reports.');
      setReports(data.reports || []);
      setLatestAvailableMonth(data.latestAvailableMonth);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to load Market reports.');
    } finally {
      setLoadingList(false);
    }
  }, []);

  const loadReport = useCallback(async (id: string): Promise<MarketReport | null> => {
    setLoadingReport(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/market-reports/${id}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Failed to load report.');
      const report = data.report as MarketReport;
      setActive(report);
      setTitle(report.title);
      setSummary(report.summary || '');
      setFooter(report.footer ?? getDefaultMarketReportFooter(report.data_snapshot, report.language));
      setContent(ensureMarketReportTitleIcon(
        refreshMarketReportGeneratedBlocks(initialContent(report.content), report.data_snapshot, report.language),
      ));
      setEditorRevision((revision) => revision + 1);
      draftRevisionRef.current = 0;
      setDraftRevision(0);
      setSavedRevision(0);
      setSaveStatus('saved');
      setFooterDialogOpen(false);
      return report;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to load report.');
      return null;
    } finally {
      setLoadingReport(false);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    const controller = new AbortController();
    const loadPageViews = async () => {
      setPageViewsLoading(true);
      setPageViewsError(null);
      try {
        const response = await fetch('/api/admin/analytics/page-views', {
          cache: 'no-store',
          signal: controller.signal,
        });
        const result = await response.json() as {
          success: boolean;
          data?: PageViewAnalytics;
          error?: string;
        };
        if (!response.ok || !result.success || !result.data) {
          throw new Error(result.error || 'Failed to load report views.');
        }
        setPageViews(result.data);
      } catch (caught) {
        if (controller.signal.aborted) return;
        setPageViewsError(caught instanceof Error ? caught.message : 'Failed to load report views.');
      } finally {
        if (!controller.signal.aborted) setPageViewsLoading(false);
      }
    };
    void loadPageViews();
    return () => controller.abort();
  }, [pageViewsReloadKey]);

  useEffect(() => {
    if (!initialSlug) return;
    const period = parseMarketReportSlug(initialSlug);
    if (!period) {
      setError('Invalid Market report URL.');
      return;
    }
    if (loadingList || loadingReport) return;
    const report = reports.find(
      (item) => item.period_type === period.periodType
        && item.period_key === period.periodKey
        && item.language === initialLanguage,
    );
    if (!report) {
      setError('Market report not found.');
      return;
    }
    if (active?.id !== report.id) void loadReport(report.id);
  }, [active?.id, initialLanguage, initialSlug, loadReport, loadingList, loadingReport, reports]);

  const sortedReports = useMemo(
    () => reports.slice().sort((a, b) => periodOrder(b) - periodOrder(a)),
    [reports],
  );

  const handleGenerated = useCallback(async (id: string, reused: boolean) => {
    setShowCreate(false);
    setNotice(reused
      ? 'Existing report refreshed. Your saved commentary was preserved; preview before publishing the update.'
      : 'Report generated from Analytics data. Add your commentary, then preview before publishing.');
    await loadList();
    const report = await loadReport(id);
    if (report) router.push(marketReportDraftUrl(report));
  }, [loadList, loadReport, router]);

  const handleSave = useCallback(async ({
    titleToSave = title,
    footerToSave = footer,
    notify = true,
    refreshReports = notify,
  }: {
    titleToSave?: string;
    footerToSave?: string;
    notify?: boolean;
    refreshReports?: boolean;
  } = {}) => {
    if (!active || saveInProgressRef.current) return false;
    saveInProgressRef.current = true;
    setWorking(true);
    setSaveStatus('saving');
    setError(null);
    try {
      const contentToSave = getContentRef.current?.() ?? content;
      const revisionAtSave = draftRevisionRef.current;
      const response = await fetch(`/api/admin/market-reports/${active.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: titleToSave,
          summary,
          footer: footerToSave,
          content: contentToSave,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Failed to save report.');
      setTitle(titleToSave);
      setFooter(footerToSave);
      if (notify) setNotice('Draft saved.');
      if (revisionAtSave === draftRevisionRef.current) {
        setSavedRevision(revisionAtSave);
        setSaveStatus('saved');
      } else {
        setSaveStatus('unsaved');
      }
      if (refreshReports) await loadList();
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to save report.');
      setSaveStatus('unsaved');
      return false;
    } finally {
      saveInProgressRef.current = false;
      setWorking(false);
    }
  }, [active, content, footer, loadList, summary, title]);

  useEffect(() => {
    if (!active || loadingReport || working || footerDialogOpen || draftRevision === savedRevision) return;
    const timeout = window.setTimeout(() => {
      void handleSave({ notify: false, refreshReports: false });
    }, 800);
    return () => window.clearTimeout(timeout);
  }, [active, draftRevision, footer, footerDialogOpen, handleSave, loadingReport, savedRevision, working]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!active || !(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 's') return;
      event.preventDefault();
      void handleSave({
        footerToSave: footerDialogOpen ? footerDraft : footer,
      }).then((saved) => {
        if (saved && footerDialogOpen) {
          setFooterDialogOpen(false);
        }
      });
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [active, footer, footerDialogOpen, footerDraft, handleSave]);

  const saveFooter = async () => {
    if (await handleSave({ footerToSave: footerDraft })) {
      setFooterDialogOpen(false);
    }
  };

  const handlePreview = async () => {
    if (!active) return;
    if (await handleSave()) window.open(marketReportDraftPreviewUrl(active), '_blank', 'noopener,noreferrer');
  };

  const handleViewPublished = () => {
    if (!active || active.status !== 'published') return;
    window.open(marketReportAdminPublicUrl(active), '_blank', 'noopener,noreferrer');
  };

  const handleRegenerate = async () => {
    if (!active || !window.confirm('Regenerate the Analytics snapshot? This replaces the report’s current draft charts and metrics.')) return;
    if (!(await handleSave())) return;
    setWorking(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/market-reports/${active.id}/regenerate`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Failed to regenerate Analytics data.');
      const currentContent = getContentRef.current?.() ?? content;
      setContent(ensureMarketReportTitleIcon(
        refreshMarketReportGeneratedBlocks(currentContent, data.snapshot, active.language),
      ));
      setEditorRevision((revision) => revision + 1);
      markDraftChanged();
      setActive({
        ...active,
        data_snapshot: data.snapshot,
        has_unpublished_changes: data.has_unpublished_changes,
        updated_at: data.updated_at || active.updated_at,
      });
      setNotice('Analytics snapshot regenerated. Preview the report before publishing the update.');
      await loadList();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to regenerate Analytics data.');
    } finally {
      setWorking(false);
    }
  };

  const handlePublish = async () => {
    if (!active || !(await handleSave())) return;
    setWorking(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/market-reports/${active.id}/publish`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Failed to publish report.');
      setNotice('Report published. The published version is now ready for the public Market Reports page.');
      await loadList();
      await loadReport(active.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to publish report.');
    } finally {
      setWorking(false);
    }
  };

  const handleWithdraw = async () => {
    if (!active || !window.confirm('Withdraw this report from public display? It will remain saved and can be published again.')) return;
    setWorking(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/market-reports/${active.id}/withdraw`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Failed to withdraw report.');
      setNotice('Report withdrawn. The saved report can be published again at any time.');
      await loadList();
      await loadReport(active.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to withdraw report.');
    } finally {
      setWorking(false);
    }
  };

  const handleDelete = async (report: MarketReportSummary) => {
    if (!window.confirm(`Permanently delete "${report.title}"? This cannot be undone.`)) return;
    setDeletingReportId(report.id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/market-reports/${report.id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Failed to delete report.');
      setReports((current) => current.filter((item) => item.id !== report.id));
      if (active?.id === report.id) {
        router.push('/admin/market');
        setActive(null);
        setTitle('');
        setSummary('');
        setFooter('');
        setContent([{ type: 'paragraph' }]);
      }
      setNotice('Report deleted.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to delete report.');
    } finally {
      setDeletingReportId(null);
    }
  };

  const statusLabel = active?.status === 'published' && active.has_unpublished_changes
    ? 'Published · draft changes'
    : active?.status || '';
  const activePageViews = active && pageViews?.reports.find((report) => report.id === active.id);

  return (
    <div className="flex h-full min-h-0 overflow-hidden bg-white">
      {sidebarCollapsed ? (
        <button
          type="button"
          onClick={() => setSidebarCollapsed(false)}
          title="Expand sidebar"
          aria-label="Expand Market Reports sidebar"
          className="flex w-6 shrink-0 items-center justify-center border-r border-[#e8e7e4] bg-[#f7f6f3] text-xs text-slate-500 hover:bg-[#e8e7e4]"
        >
          ▶
        </button>
      ) : (
        <aside className="flex w-64 shrink-0 flex-col overflow-hidden border-r border-[#e8e7e4] bg-[#f7f6f3] sm:w-72">
          <div className="flex items-center justify-between border-b border-[#e8e7e4] px-4 py-3">
            <button
              type="button"
              onClick={() => { router.push('/admin/market'); setActive(null); setShowCreate(false); }}
              className="text-base font-bold text-slate-800 hover:text-blue-700"
            >
              Market Reports
            </button>
            <button
              type="button"
              onClick={() => setSidebarCollapsed(true)}
              title="Collapse sidebar"
              aria-label="Collapse Market Reports sidebar"
              className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-[#e8e7e4] hover:text-slate-800"
            >
              ◀
            </button>
          </div>

          <button
            type="button"
            onClick={() => { router.push('/admin/market'); setActive(null); setShowCreate(false); }}
            className={`flex items-center gap-2 border-b border-[#e8e7e4] px-4 py-3 text-left text-sm font-semibold ${
              !active && !showCreate ? 'bg-blue-50 text-blue-800' : 'text-slate-700 hover:bg-white/70'
            }`}
          >
            <span aria-hidden="true">📍</span>
            <span>North Shore</span>
            <span className="ml-auto text-xs font-normal text-slate-500">{reports.length}</span>
          </button>

          <div className="flex items-center justify-between px-4 pb-2 pt-4">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Reports</span>
            <button
              type="button"
              onClick={() => { setShowCreate(true); setError(null); }}
              disabled={!latestAvailableMonth}
              title="Create a report"
              aria-label="Create a report"
              className="rounded px-2 py-1 text-lg leading-none text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              +
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
            {loadingList ? (
              <p className="px-3 py-4 text-xs text-slate-500">Loading reports…</p>
            ) : sortedReports.length === 0 ? (
              <p className="px-3 py-4 text-xs leading-5 text-slate-500">No reports yet. Use + to create the first report.</p>
            ) : (
              <div className="space-y-1">
                {sortedReports.map((report) => {
                  const isSelected = active?.id === report.id;
                  return (
                    <div
                      key={report.id}
                      className={`group flex items-center rounded-md transition-colors ${
                        isSelected ? 'bg-blue-100 text-blue-900' : 'text-slate-700 hover:bg-white/80'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => { setShowCreate(false); setError(null); router.push(marketReportDraftUrl(report)); }}
                        aria-current={isSelected ? 'page' : undefined}
                        className="min-w-0 flex-1 px-3 py-2.5 text-left"
                      >
                        <span className="block truncate text-sm font-medium">{periodLabel(report)}</span>
                        <span className="mt-1 flex items-center justify-between gap-2">
                          <span className="truncate text-[11px] text-slate-500">{report.period_type}</span>
                          <span
                            aria-label={report.language === 'zh' ? 'Chinese report' : 'English report'}
                            className="shrink-0 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-800"
                          >
                            {report.language === 'zh' ? '中' : 'En'}
                          </span>
                          <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] capitalize ${
                            report.status === 'published' ? 'bg-emerald-100 text-emerald-800'
                              : report.status === 'withdrawn' ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-200 text-slate-700'
                          }`}>
                            {report.status}{report.has_unpublished_changes ? ' · edited' : ''}
                          </span>
                        </span>
                        <span className="mt-1 block text-[10px] text-slate-500">
                          {pageViewsLoading && !pageViews
                            ? 'Loading views…'
                            : `Views: ${formatViewCount(pageViews?.reports.find((item) => item.id === report.id)?.views.total ?? 0)}`}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(report)}
                        disabled={working || loadingReport || deletingReportId !== null}
                        title={`Delete ${periodLabel(report)} report`}
                        aria-label={`Delete ${periodLabel(report)} report`}
                        className="mr-2 rounded p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Trash2 size={15} aria-hidden="true" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>
      )}

      <main className="min-w-0 flex-1 overflow-y-auto bg-slate-50 p-4 sm:p-6">
        <div className="mx-auto max-w-6xl space-y-5">
          {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          {notice && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>}

          {!active ? (
            <>
              <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
                <div className="max-w-2xl">
                  <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">North Shore</p>
                  <h1 className="mt-2 text-3xl font-bold text-slate-900">Market Reports</h1>
                  <p className="mt-3 text-slate-600">
                    Review previous reports or create a monthly or quarterly report using North Shore sales data from Analytics.
                  </p>
                  <button
                    type="button"
                    onClick={() => { setShowCreate(true); setError(null); }}
                    disabled={!latestAvailableMonth}
                    className={`${buttonClass} mt-6 bg-blue-600 text-white hover:bg-blue-700`}
                  >
                    + New report
                  </button>
                </div>
              </section>

              <section aria-labelledby="market-home-reports-heading" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
                  <div>
                    <h2 id="market-home-reports-heading" className="text-lg font-semibold text-slate-900">Previous reports</h2>
                    <p className="mt-1 text-sm text-slate-500">Open a report to continue editing or view its published version.</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">{reports.length}</span>
                </div>
                {loadingList ? (
                  <p className="px-5 py-8 text-sm text-slate-500">Loading reports…</p>
                ) : sortedReports.length === 0 ? (
                  <p className="px-5 py-8 text-sm text-slate-500">No reports yet. Create your first report to get started.</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {sortedReports.map((report) => {
                      const label = periodLabel(report);
                      const language = report.language === 'zh' ? 'Chinese' : 'English';
                      const reportViews = pageViews?.reports.find((item) => item.id === report.id)?.views.total ?? 0;
                      return (
                        <article key={report.id} className="flex flex-col justify-between gap-4 px-5 py-4 sm:flex-row sm:items-center">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="truncate text-base font-semibold text-slate-900">{report.title || label}</h3>
                              <span className={`rounded-full px-2.5 py-1 text-xs capitalize ${
                                report.status === 'published' ? 'bg-emerald-100 text-emerald-800'
                                  : report.status === 'withdrawn' ? 'bg-amber-100 text-amber-800'
                                    : 'bg-slate-100 text-slate-700'
                              }`}>
                                {report.status}{report.has_unpublished_changes ? ' · edited' : ''}
                              </span>
                            </div>
                            <p className="mt-1 text-sm text-slate-600">
                              {label} <span aria-hidden="true">·</span> {report.period_type === 'monthly' ? 'Monthly' : 'Quarterly'} <span aria-hidden="true">·</span> {language}
                            </p>
                            {report.summary && <p className="mt-1 line-clamp-2 text-sm text-slate-500">{report.summary}</p>}
                            <p className="mt-1 text-xs text-slate-500">
                              {pageViewsLoading && !pageViews ? 'Loading views…' : `Views: ${formatViewCount(reportViews)}`}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-wrap gap-2">
                            <Link
                              href={marketReportDraftUrl(report)}
                              aria-label={`Open ${label} ${language} report`}
                              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                            >
                              Open report
                            </Link>
                            {report.status === 'published' && (
                              <Link
                                href={marketReportAdminPublicUrl(report)}
                                aria-label={`View published ${label} ${language} report`}
                                className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-800 hover:bg-blue-100"
                              >
                                View published
                              </Link>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          ) : (
            <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-lg font-semibold text-slate-900">{periodLabel(active)}</h1>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs capitalize text-slate-700">{statusLabel}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span role="status" aria-live="polite" className="self-center px-2 text-xs text-slate-500">
                    {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'unsaved' ? 'Unsaved changes' : 'Saved'}
                  </span>
                  <button type="button" onClick={() => void handlePreview()} disabled={working || loadingReport} className={`${buttonClass} border border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100`}>Preview</button>
                  {active.status === 'published' && (
                    <button
                      type="button"
                      onClick={handleViewPublished}
                      disabled={working || loadingReport}
                      className={`${buttonClass} border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100`}
                    >
                      View published
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => { setShowCreate(true); setError(null); }}
                    disabled={!latestAvailableMonth || working}
                    className={`${buttonClass} border border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-50`}
                  >
                    + New Report
                  </button>
                  {active.status === 'published' && (
                    <button type="button" onClick={() => void handleWithdraw()} disabled={working} className={`${buttonClass} border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100`}>Withdraw</button>
                  )}
                  <button
                    type="button"
                    onClick={() => { setFooterDraft(footer); setFooterDialogOpen(true); }}
                    disabled={working || loadingReport}
                    className={`${buttonClass} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`}
                  >
                    Edit
                  </button>
                  <button type="button" onClick={() => void handlePublish()} disabled={working || loadingReport} className={`${buttonClass} bg-blue-600 text-white hover:bg-blue-700`}>
                    {working ? 'Working…' : active.status === 'published' ? 'Publish update' : 'Publish'}
                  </button>
                </div>
              </div>

              {loadingReport ? (
                <p className="py-12 text-center text-sm text-slate-500">Loading report…</p>
              ) : (
                <>
                  <section aria-label="Report views" className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h2 className="font-semibold text-slate-900">Report Views</h2>
                        <p className="text-xs text-slate-600">
                          {pageViewPeriodLabel(active)} · {active.language === 'zh' ? 'Chinese' : 'English'}
                        </p>
                      </div>
                      {activePageViews && (
                        <p className="text-sm font-semibold text-blue-900">
                          Total: {formatViewCount(activePageViews.views.total)}
                        </p>
                      )}
                    </div>
                    {pageViewsError ? (
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-red-700">
                        <span role="alert">Views unavailable: {pageViewsError}</span>
                        <button
                          type="button"
                          onClick={() => setPageViewsReloadKey((key) => key + 1)}
                          className="font-medium underline"
                        >
                          Retry
                        </button>
                      </div>
                    ) : pageViewsLoading && !pageViews ? (
                      <p role="status" className="mt-3 text-sm text-slate-500">Loading views…</p>
                    ) : (
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        {([
                          ['This week', 'week'],
                          ['This month', 'month'],
                          ['This year', 'year'],
                        ] as const).map(([label, key]) => (
                          <ViewMetric key={key} label={label} value={activePageViews?.views[key] ?? 0} />
                        ))}
                      </div>
                    )}
                  </section>
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-4">
                    <div>
                      <h2 className="font-semibold text-slate-900">REINZ Analytics data</h2>
                      <p className="text-xs text-slate-500">{active.data_snapshot.source} · {active.data_snapshot.propertyType} · generated {new Date(active.data_snapshot.generatedAt).toLocaleString('en-NZ')}</p>
                    </div>
                    <button type="button" onClick={() => void handleRegenerate()} disabled={working} className={`${buttonClass} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`}>Regenerate data</button>
                  </div>
                  <MarketReportEditor
                    key={`${active.id}:${editorRevision}`}
                    reportId={active.id}
                    content={content}
                    getContentRef={getContentRef}
                    onContentChange={markDraftChanged}
                  />
                </>
              )}
            </section>
          )}
        </div>
      </main>
      {footerDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="market-report-footer-title"
            className="w-full max-w-xl rounded-xl bg-white p-6 shadow-xl"
          >
            <h2 id="market-report-footer-title" className="text-lg font-semibold text-slate-900">Edit Footer</h2>
            <p className="mt-1 text-sm text-slate-600">Update the page footer. Use a new line for each paragraph.</p>
            <label htmlFor="market-report-footer" className="mb-1 mt-4 block text-sm font-medium text-slate-700">
              Page footer
            </label>
            <textarea
              id="market-report-footer"
              value={footerDraft}
              onChange={(event) => setFooterDraft(event.target.value)}
              maxLength={4000}
              rows={7}
              className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setFooterDialogOpen(false)}
                disabled={working}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveFooter()}
                disabled={working}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {working ? 'Saving…' : 'Save'}
              </button>
            </div>
          </section>
        </div>
      )}
      <MarketGenerateReportModal
        open={showCreate}
        latestAvailableMonth={latestAvailableMonth}
        existingReports={reports}
        onClose={() => setShowCreate(false)}
        onGenerated={handleGenerated}
      />
    </div>
  );
}

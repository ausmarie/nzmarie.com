'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import ReportEditor from '@/app/admin/reports/components/ReportEditor';
import ConfirmModal from '@/app/admin/reports/components/ConfirmModal';
import { useReportStore } from '@/app/admin/reports/stores/report-store';
import type { ReportDocument, ReportEditorContent } from '@/types/report';

interface LeadOption {
  id: string;
  property_address: string;
  suburb?: string | null;
  status?: string;
  priority?: string;
}

interface LeadReportMeta {
  id: string;
  title: string;
  status: string;
  updated_at: string;
}

interface LeadReportsViewProps {
  onSwitchToLeads: () => void;
  onLeadChange?: (leadId: string | null) => void;
  initialLeadId?: string | null;
}

const SIDEBAR_KEY = 'leadReportsSidebarCollapsed';

export default function LeadReportsView({ onSwitchToLeads, onLeadChange, initialLeadId }: LeadReportsViewProps) {
  const { isSaving, lastSaved } = useReportStore();

  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(true);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const [reports, setReports] = useState<LeadReportMeta[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [activeDoc, setActiveDoc] = useState<ReportDocument | null>(null);
  const [docLoading, setDocLoading] = useState(false);

  const [title, setTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const getContentRef = useRef<(() => ReportEditorContent | null) | null>(null);
  const autoSelectedLeadRef = useRef(false);

  const selectedLead = leads.find((l) => l.id === selectedLeadId) || null;

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(SIDEBAR_KEY) === '1');
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadLeads = async () => {
      try {
        const res = await fetch('/api/admin/leads/list', { cache: 'no-store' });
        const data = await res.json();
        if (cancelled) return;
        if (data.success) {
          const rows: LeadOption[] = data.leads || [];
          setLeads(rows);
          if (!autoSelectedLeadRef.current && rows.length > 0) {
            autoSelectedLeadRef.current = true;
            const match = initialLeadId ? rows.find((l) => l.id === initialLeadId) : null;
            setSelectedLeadId(match ? match.id : rows[0].id);
          }
        }
      } catch { /* ignore */ } finally {
        if (!cancelled) setLeadsLoading(false);
      }
    };
    loadLeads();
    return () => { cancelled = true; };
  }, [initialLeadId]);

  useEffect(() => {
    onLeadChange?.(selectedLeadId);
    if (!selectedLeadId) {
      setReports([]);
      setActiveDocId(null);
      setActiveDoc(null);
      setTitle('');
      return;
    }
    let cancelled = false;
    setReportsLoading(true);
    setActiveDocId(null);
    setActiveDoc(null);
    setTitle('');
    const loadReports = async () => {
      try {
        const res = await fetch(`/api/admin/reports/documents?lead_id=${encodeURIComponent(selectedLeadId)}`, { cache: 'no-store' });
        const data = await res.json();
        if (cancelled) return;
        if (data.success) {
          const rows: LeadReportMeta[] = (data.documents || []).map((d: ReportDocument) => ({
            id: d.id,
            title: d.title,
            status: d.status,
            updated_at: d.updated_at,
          }));
          setReports(rows);
          if (rows.length > 0) setActiveDocId(rows[0].id);
        }
      } catch { /* ignore */ } finally {
        if (!cancelled) setReportsLoading(false);
      }
    };
    loadReports();
    return () => { cancelled = true; };
  }, [selectedLeadId, onLeadChange]);

  useEffect(() => {
    if (!activeDocId) {
      setActiveDoc(null);
      setTitle('');
      return;
    }
    let cancelled = false;
    setDocLoading(true);
    const loadDoc = async () => {
      try {
        const res = await fetch(`/api/admin/reports/documents/${activeDocId}`, { cache: 'no-store' });
        const data = await res.json();
        if (cancelled) return;
        if (data.success) {
          setActiveDoc(data.document);
          setTitle(data.document.title || '');
        }
      } catch { /* ignore */ } finally {
        if (!cancelled) setDocLoading(false);
      }
    };
    loadDoc();
    return () => { cancelled = true; };
  }, [activeDocId]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem(SIDEBAR_KEY, next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const handleCreateReport = useCallback(async () => {
    if (!selectedLead || creating) return;
    setCreating(true);
    try {
      const address = selectedLead.property_address;
      const content = [
        {
          type: 'heading',
          props: { level: 1 },
          content: [{ type: 'text', text: `Property Report — ${address}`, styles: {} }],
        },
        { type: 'paragraph', content: [{ type: 'text', text: '', styles: {} }] },
      ];
      const res = await fetch('/api/admin/reports/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doc_type: 'general',
          title: `Property Report — ${address}`,
          content,
          lead_id: selectedLead.id,
        }),
      });
      const data = await res.json();
      if (data.success && data.id) {
        setReports((prev) => [
          { id: data.id, title: `Property Report — ${address}`, status: 'draft', updated_at: new Date().toISOString() },
          ...prev,
        ]);
        setActiveDocId(data.id);
        setToast('Report created.');
      } else {
        setToast('Failed to create report.');
      }
    } catch {
      setToast('Failed to create report.');
    } finally {
      setCreating(false);
    }
  }, [selectedLead, creating]);

  const handleSaveNow = useCallback(async () => {
    if (!activeDocId) return;
    try {
      const waitForAutosave = async () => {
        const start = Date.now();
        while (useReportStore.getState()?.isSaving && Date.now() - start < 5000) {
          await new Promise((r) => setTimeout(r, 120));
        }
      };
      await waitForAutosave();
      const contentToSave = getContentRef.current?.() ?? activeDoc?.content ?? null;
      const res = await fetch('/api/admin/reports/documents', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: activeDocId, title, content: contentToSave }),
      });
      if (!res.ok) {
        setToast('Failed to save.');
        return;
      }
      setReports((prev) => prev.map((r) => (r.id === activeDocId ? { ...r, title } : r)));
      setToast('Saved.');
    } catch {
      setToast('Failed to save.');
    }
  }, [activeDocId, title, activeDoc]);

  const handleDelete = useCallback(async () => {
    if (!activeDocId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/reports/documents/${activeDocId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        const remaining = reports.filter((r) => r.id !== activeDocId);
        setReports(remaining);
        setActiveDocId(remaining.length > 0 ? remaining[0].id : null);
        setToast('Report deleted.');
      } else {
        setToast('Failed to delete report.');
      }
    } catch {
      setToast('Failed to delete report.');
    } finally {
      setDeleting(false);
      setShowDelete(false);
    }
  }, [activeDocId, reports]);

  const metaLine = selectedLead
    ? [selectedLead.suburb, activeDoc?.updated_at ? new Date(activeDoc.updated_at).toLocaleDateString('en-NZ') : null]
        .filter(Boolean)
        .join(' · ')
    : '';

  return (
    <div
      className="lead-reports-root flex rounded-xl border border-slate-200 bg-white overflow-hidden"
      style={{ height: 'calc(100vh - 200px)', minHeight: 560 }}
      data-testid="lead-reports-view"
    >
      <style>{`
        .lead-reports-print-hide { display: none !important; }
        @media print {
          nav { display: none !important; }
          .lead-reports-sidebar, .lead-reports-toolbar, .reports-editor-status { display: none !important; }
          .lead-reports-root {
            display: block !important;
            height: auto !important;
            min-height: 0 !important;
            border: none !important;
            border-radius: 0 !important;
            overflow: visible !important;
          }
          .lead-reports-editor-pane {
            overflow: visible !important;
            padding: 0 !important;
            background: white !important;
          }
          .lead-reports-paper {
            border: none !important;
            box-shadow: none !important;
            max-width: 100% !important;
          }
          .report-editor-container {
            max-width: 100% !important;
            width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .bn-editor { padding: 0 !important; }
          .lead-reports-root .bn-container .bn-editor {
            font-size: 13px !important;
            line-height: 1.45 !important;
          }
          .lead-reports-root [data-content-type="heading"][data-level="1"] { font-size: 1.5rem !important; }
          .lead-reports-root [data-content-type="heading"][data-level="2"] { font-size: 1.25rem !important; }
          .lead-reports-root [data-content-type="heading"][data-level="3"] { font-size: 1.1rem !important; }
          .max-w-7xl, main {
            padding: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
            background: transparent !important;
          }
          @page { margin: 0; size: A4 portrait; }
          body {
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      {/* Sidebar */}
      {!collapsed ? (
        <aside
          className="lead-reports-sidebar flex flex-col w-64 shrink-0 border-r border-slate-200 bg-slate-50"
          data-testid="lead-reports-sidebar"
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 bg-white">
            <div className="flex items-center gap-0.5 text-xs font-semibold">
              <button
                onClick={onSwitchToLeads}
                className="px-2 py-1 rounded text-slate-500 hover:text-slate-900 transition-colors"
                data-testid="sidebar-leads-toggle"
              >
                Leads
              </button>
              <span className="text-slate-300">|</span>
              <span className="px-2 py-1 rounded bg-blue-600 text-white">Reports</span>
            </div>
            <button
              onClick={toggleCollapsed}
              title="Collapse sidebar"
              className="flex items-center justify-center w-6 h-6 rounded bg-blue-500 text-white text-xs font-bold hover:bg-blue-600 transition-colors"
              data-testid="sidebar-collapse"
            >
              ◀
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {leadsLoading ? (
              <div className="space-y-2 p-1">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-12 rounded-lg bg-slate-200 animate-pulse" />
                ))}
              </div>
            ) : leads.length === 0 ? (
              <p className="text-xs text-slate-400 p-2">No leads yet.</p>
            ) : (
              leads.map((lead) => {
                const isSelected = lead.id === selectedLeadId;
                return (
                  <button
                    key={lead.id}
                    onClick={() => setSelectedLeadId(lead.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                      isSelected ? 'bg-blue-100 text-blue-900' : 'hover:bg-slate-100 text-slate-700'
                    }`}
                    data-testid="lead-list-item"
                  >
                    <div className="flex items-start gap-1.5">
                      <span className="text-xs mt-0.5 shrink-0" aria-hidden="true">📍</span>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{lead.property_address}</div>
                        {lead.suburb && <div className="text-[11px] text-slate-500 truncate">{lead.suburb}</div>}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="p-2 border-t border-slate-200 bg-white">
            <button
              onClick={handleCreateReport}
              disabled={!selectedLeadId || creating}
              className="w-full px-3 py-2 rounded-lg text-xs font-semibold border border-emerald-500 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              data-testid="new-report-btn"
            >
              {creating ? 'Creating…' : '+ New Report'}
            </button>
          </div>
        </aside>
      ) : (
        <div className="lead-reports-sidebar flex flex-col items-center w-10 shrink-0 border-r border-slate-200 bg-slate-50 py-2">
          <button
            onClick={toggleCollapsed}
            title="Expand sidebar"
            className="flex items-center justify-center w-6 h-6 rounded bg-blue-500 text-white text-xs font-bold hover:bg-blue-600 transition-colors"
            data-testid="sidebar-expand"
          >
            ▶
          </button>
        </div>
      )}

      {/* Right pane */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="lead-reports-toolbar flex items-center gap-2 px-4 py-2 border-b border-slate-200 bg-white" style={{ overflowX: 'auto' }}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Untitled report"
            disabled={!activeDocId}
            className="min-w-0 flex-1 max-w-[280px] border-0 outline-none text-sm font-semibold text-slate-800 placeholder:text-slate-300 bg-transparent"
            data-testid="report-title-input"
          />
          {metaLine && (
            <span className="text-xs text-slate-400 whitespace-nowrap hidden md:inline" data-testid="report-meta">
              {metaLine}
            </span>
          )}
          <span className="text-[11px] text-slate-500 whitespace-nowrap">
            {activeDoc ? (activeDoc.status === 'draft' ? 'Draft' : 'Finalised') : ''}
          </span>
          <span className="text-[11px] text-slate-500 whitespace-nowrap" data-testid="save-status">
            {isSaving ? 'Saving…' : lastSaved ? `● Saved at ${lastSaved}` : ''}
          </span>
          <div className="ml-auto flex items-center gap-2 shrink-0">
            <button
              onClick={handleSaveNow}
              disabled={!activeDocId}
              className="px-3 py-1.5 rounded-md text-xs border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-40"
              data-testid="save-btn"
            >
              Save
            </button>
            <button
              onClick={handleCreateReport}
              disabled={!selectedLeadId || creating}
              className="px-3 py-1.5 rounded-md text-xs font-medium border border-emerald-500 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors disabled:opacity-40"
            >
              + New Report
            </button>
            <button
              onClick={() => window.print()}
              disabled={!activeDocId}
              className="px-3 py-1.5 rounded-md text-xs font-medium border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-40"
              data-testid="print-btn"
            >
              Print
            </button>
            <button
              onClick={() => window.print()}
              disabled={!activeDocId}
              className="px-3 py-1.5 rounded-md text-xs font-medium border border-blue-600 bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-40"
              data-testid="export-pdf-btn"
            >
              Export PDF
            </button>
            <button
              onClick={() => setShowDelete(true)}
              disabled={!activeDocId}
              className="px-3 py-1.5 rounded-md text-xs font-medium border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-40"
              data-testid="delete-btn"
            >
              Delete
            </button>
          </div>
        </div>

        <div className="lead-reports-editor-pane flex-1 overflow-y-auto bg-slate-100 p-6">
          {!selectedLeadId ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 text-sm">
              <span className="text-3xl mb-3" aria-hidden="true">📄</span>
              Select an address on the left to open its reports.
            </div>
          ) : reportsLoading && !activeDocId ? (
            <div className="mx-auto max-w-[900px] space-y-4">
              <div className="h-8 w-2/3 bg-slate-200 rounded animate-pulse" />
              <div className="h-4 w-1/2 bg-slate-200 rounded animate-pulse" />
              <div className="h-64 bg-slate-200 rounded animate-pulse" />
            </div>
          ) : !activeDocId ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 text-sm">
              <span className="text-3xl mb-3" aria-hidden="true">📝</span>
              <p className="mb-4">No reports for this address yet.</p>
              <button
                onClick={handleCreateReport}
                disabled={creating}
                className="px-4 py-2 rounded-lg text-xs font-semibold border border-emerald-500 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors disabled:opacity-40"
              >
                {creating ? 'Creating…' : '+ Create first report'}
              </button>
            </div>
          ) : docLoading && !activeDoc ? (
            <div className="mx-auto max-w-[900px] space-y-4">
              <div className="h-8 w-2/3 bg-slate-200 rounded animate-pulse" />
              <div className="h-4 w-1/2 bg-slate-200 rounded animate-pulse" />
              <div className="h-64 bg-slate-200 rounded animate-pulse" />
            </div>
          ) : activeDoc ? (
            <div className="lead-reports-paper mx-auto bg-white shadow-sm border border-slate-200" style={{ maxWidth: 900 }}>
              <ReportEditor
                key={activeDocId}
                docId={activeDocId!}
                initialContent={activeDoc.content ?? null}
                getContentRef={getContentRef}
              />
            </div>
          ) : null}
        </div>
      </div>

      <ConfirmModal
        open={showDelete}
        title={`Delete "${title || 'this report'}"?`}
        message="Are you sure you want to delete this report? This action is permanent and cannot be undone."
        onCancel={() => setShowDelete(false)}
        onConfirm={handleDelete}
        loading={deleting}
        confirmLabel="Confirm Delete"
      />

      {toast && (
        <div
          style={{
            position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
            zIndex: 99999, background: '#065f46', color: 'white',
            padding: '10px 24px', borderRadius: 10, fontSize: '0.9rem',
            fontWeight: 500, boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
          }}
          role="status"
        >
          {toast}
        </div>
      )}
    </div>
  );
}

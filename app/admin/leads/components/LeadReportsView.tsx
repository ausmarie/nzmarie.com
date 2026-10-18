'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import ReportEditor from '@/app/admin/reports/components/ReportEditor';
import ConfirmModal from '@/app/admin/reports/components/ConfirmModal';
import GenerateReportModal from '@/app/admin/reports/components/GenerateReportModal';
import { useReportStore } from '@/app/admin/reports/stores/report-store';
import type { ReportDocument, ReportEditorContent } from '@/types/report';

interface LeadOption {
  id: string;
  property_address: string;
  suburb?: string | null;
  status?: string;
  priority?: string;
  owner_name?: string | null;
  owner_email?: string | null;
  owner_phone?: string | null;
  created_at?: string | null;
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

const sidebarBg = '#f7f6f3';
const sidebarBorder = '#e8e7e4';

export default function LeadReportsView({ onSwitchToLeads, onLeadChange, initialLeadId }: LeadReportsViewProps) {
  const { isSaving, lastSaved } = useReportStore();

  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(true);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [reportsByLead, setReportsByLead] = useState<Record<string, LeadReportMeta[]>>({});
  const [collapsed, setCollapsed] = useState(false);

  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [activeDoc, setActiveDoc] = useState<ReportDocument | null>(null);
  const [docLoading, setDocLoading] = useState(false);

  const [title, setTitle] = useState('');
  const [showGenerate, setShowGenerate] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const getContentRef = useRef<(() => ReportEditorContent | null) | null>(null);
  const autoSelectedRef = useRef(false);

  const selectedLead = leads.find((l) => l.id === selectedLeadId) || null;

  const loadReportsForLead = useCallback(async (leadId: string): Promise<LeadReportMeta[]> => {
    try {
      const res = await fetch(`/api/admin/reports/documents?lead_id=${encodeURIComponent(leadId)}`, { cache: 'no-store' });
      const data = await res.json();
      if (data.success) {
        const rows: LeadReportMeta[] = (data.documents || []).map((d: ReportDocument) => ({
          id: d.id,
          title: d.title,
          status: d.status,
          updated_at: d.updated_at,
        }));
        setReportsByLead((prev) => ({ ...prev, [leadId]: rows }));
        return rows;
      }
    } catch { /* ignore */ }
    return [];
  }, []);

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
          const rows: LeadOption[] = (data.leads || []).slice().sort(
            (a: LeadOption, b: LeadOption) =>
              new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
          );
          setLeads(rows);
          if (!autoSelectedRef.current && initialLeadId) {
            const match = rows.find((l) => l.id === initialLeadId);
            if (match) {
              autoSelectedRef.current = true;
              setSelectedLeadId(match.id);
              setExpanded((prev) => ({ ...prev, [match.id]: true }));
              const reportRows = await loadReportsForLead(match.id);
              if (!cancelled && reportRows.length > 0) setActiveDocId(reportRows[0].id);
            }
          }
        }
      } catch { /* ignore */ } finally {
        if (!cancelled) setLeadsLoading(false);
      }
    };
    loadLeads();
    return () => { cancelled = true; };
  }, [initialLeadId, loadReportsForLead]);

  useEffect(() => {
    onLeadChange?.(selectedLeadId);
  }, [selectedLeadId, onLeadChange]);

  useEffect(() => {
    if (!activeDocId) {
      setActiveDoc(null);
      setTitle('');
      return;
    }
    let cancelled = false;
    setDocLoading(true);
    setActiveDoc(null);
    setTitle('');
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

  const handleLeadClick = useCallback(async (leadId: string) => {
    const isExpanded = !!expanded[leadId];
    setSelectedLeadId(leadId);
    if (isExpanded) {
      setExpanded((prev) => ({ ...prev, [leadId]: false }));
      return;
    }
    setExpanded((prev) => ({ ...prev, [leadId]: true }));
    const belongsToLead = activeDocId && (reportsByLead[leadId] || []).some((r) => r.id === activeDocId);
    if (!belongsToLead) {
      let rows = reportsByLead[leadId];
      if (!rows) rows = await loadReportsForLead(leadId);
      if (rows.length > 0) {
        setActiveDocId(rows[0].id);
      } else {
        setActiveDocId(null);
      }
    }
  }, [expanded, activeDocId, reportsByLead, loadReportsForLead]);

  const handleReportClick = useCallback((leadId: string, docId: string) => {
    setSelectedLeadId(leadId);
    setExpanded((prev) => ({ ...prev, [leadId]: true }));
    setActiveDocId(docId);
  }, []);

  const handleCreateReport = useCallback(() => {
    if (!selectedLeadId) return;
    setShowGenerate(true);
  }, [selectedLeadId]);

  const handleGenerated = useCallback(async (docId: string) => {
    setShowGenerate(false);
    if (!selectedLeadId) return;
    setExpanded((prev) => ({ ...prev, [selectedLeadId]: true }));
    await loadReportsForLead(selectedLeadId);
    setActiveDocId(docId);
    setToast('Report generated.');
  }, [selectedLeadId, loadReportsForLead]);

  const handleSaveNow = useCallback(async () => {
    if (!activeDocId || docLoading || !activeDoc) return;
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
      if (selectedLeadId) {
        setReportsByLead((prev) => ({
          ...prev,
          [selectedLeadId]: (prev[selectedLeadId] || []).map((r) => (r.id === activeDocId ? { ...r, title } : r)),
        }));
      }
      setToast('Saved.');
    } catch {
      setToast('Failed to save.');
    }
  }, [activeDocId, docLoading, title, activeDoc, selectedLeadId]);

  const handleDelete = useCallback(async () => {
    const target = pendingDelete;
    if (!target) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/reports/documents/${target.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        if (selectedLeadId) {
          const remaining = (reportsByLead[selectedLeadId] || []).filter((r) => r.id !== target.id);
          setReportsByLead((prev) => ({ ...prev, [selectedLeadId]: remaining }));
          if (activeDocId === target.id) {
            setActiveDocId(remaining.length > 0 ? remaining[0].id : null);
          }
        } else if (activeDocId === target.id) {
          setActiveDocId(null);
        }
        setToast('Report deleted.');
      } else {
        setToast('Failed to delete report.');
      }
    } catch {
      setToast('Failed to delete report.');
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
  }, [pendingDelete, activeDocId, selectedLeadId, reportsByLead]);

  const metaLine = selectedLead
    ? [selectedLead.suburb, activeDoc?.updated_at ? new Date(activeDoc.updated_at).toLocaleDateString('en-NZ') : null]
        .filter(Boolean)
        .join(' · ')
    : '';

  return (
    <>
      <style>{`
        @media print {
          nav { display: none !important; }
          .leads-mode-chrome { display: none !important; }
          .lead-reports-sidebar, .lead-reports-toolbar, .reports-editor-status, .lead-reports-home { display: none !important; }
          .lead-generate-modal { display: none !important; }
          .lead-reports-root {
            position: static !important;
            display: block !important;
            height: auto !important;
            overflow: visible !important;
          }
          .lead-reports-main {
            overflow: visible !important;
            background: white !important;
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
        .lead-report-row { position: relative; }
        .lead-report-row-del { opacity: 0; transition: opacity 0.12s ease; }
        .lead-report-row:hover .lead-report-row-del { opacity: 1; }
        .lead-report-row.is-active .lead-report-row-del { opacity: 1; }
        @media print {
          .lead-report-row-del { display: none !important; }
        }
      `}</style>

      <div
        className="lead-reports-root"
        style={{
          position: 'fixed', top: '64px', left: 0, right: 0, bottom: 0,
          display: 'flex', overflow: 'hidden', background: 'white',
        }}
        data-testid="lead-reports-view"
      >
        {collapsed ? (
          <div
            onClick={toggleCollapsed}
            title="Expand sidebar"
            style={{
              width: 20, minWidth: 20, height: '100%', cursor: 'pointer',
              background: sidebarBg, borderRight: `1px solid ${sidebarBorder}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#999', fontSize: '0.75rem', flexShrink: 0, userSelect: 'none',
            }}
            data-testid="sidebar-expand"
          >
            ▶
          </div>
        ) : (
          <aside
            className="lead-reports-sidebar"
            style={{
              width: 240, minWidth: 240, height: '100%', overflow: 'hidden',
              background: sidebarBg, borderRight: `1px solid ${sidebarBorder}`,
              display: 'flex', flexDirection: 'column',
            }}
            data-testid="lead-reports-sidebar"
          >
            <div style={{ padding: '12px 12px 8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <button
                    onClick={onSwitchToLeads}
                    style={{
                      cursor: 'pointer', fontSize: '0.7rem', fontWeight: 600, padding: '3px 8px',
                      borderRadius: 6, border: 'none', color: '#666', background: 'transparent',
                      transition: 'color 0.1s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#1a73e8'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = '#666'; }}
                    data-testid="sidebar-leads-toggle"
                  >
                    Leads
                  </button>
                  <span style={{
                    fontSize: '0.7rem', fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                    background: '#1a73e8', color: 'white',
                  }}>
                    Reports
                  </span>
                </div>
                <span
                  onClick={toggleCollapsed}
                  title="Collapse sidebar"
                  style={{
                    cursor: 'pointer', fontSize: '0.75rem', color: '#999', padding: '2px 6px',
                    borderRadius: 4, lineHeight: 1, userSelect: 'none',
                    transition: 'color 0.1s, background 0.1s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#333'; e.currentTarget.style.background = '#e8e7e4'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = '#999'; e.currentTarget.style.background = 'transparent'; }}
                  data-testid="sidebar-collapse"
                >
                  ◀
                </span>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {leadsLoading ? (
                <div style={{ padding: 12 }}>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} style={{ height: 32, borderRadius: 6, background: '#e8e7e4', marginBottom: 8, animation: 'sk-pulse 1.5s infinite' }} />
                  ))}
                  <style>{`@keyframes sk-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
                </div>
              ) : leads.length === 0 ? (
                <p style={{ padding: 12, fontSize: '0.75rem', color: '#999' }}>No leads yet.</p>
              ) : (
                leads.map((lead) => {
                  const isExpanded = !!expanded[lead.id];
                  const isSelectedLead = lead.id === selectedLeadId;
                  const children = reportsByLead[lead.id] || [];
                  return (
                    <div key={lead.id}>
                      <div
                        onClick={() => handleLeadClick(lead.id)}
                        style={{
                          padding: '6px 12px', cursor: 'pointer', fontSize: '0.8rem',
                          fontWeight: 600, color: '#555',
                          display: 'flex', alignItems: 'center', gap: 6,
                          background: isSelectedLead && !isExpanded ? '#dbeafe' : 'transparent',
                          userSelect: 'none',
                        }}
                        onMouseEnter={(e) => { if (!isSelectedLead) e.currentTarget.style.background = '#e8e7e4'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = isSelectedLead && !isExpanded ? '#dbeafe' : 'transparent'; }}
                        data-testid="lead-list-item"
                      >
                        <span style={{
                          transform: isExpanded ? 'rotate(90deg)' : 'none',
                          transition: 'transform 0.15s', fontSize: '0.65rem', color: '#1a73e8',
                          flexShrink: 0,
                        }}>
                          ▶
                        </span>
                        <span style={{ fontSize: '0.9rem', flexShrink: 0 }} aria-hidden="true">📍</span>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {lead.property_address}
                          </div>
                          {lead.suburb && (
                            <div style={{ fontSize: '0.65rem', fontWeight: 400, color: '#999', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {lead.suburb}
                            </div>
                          )}
                        </div>
                      </div>

                      {isExpanded && (
                        <div>
                          {children.length === 0 ? (
                            <div style={{ padding: '4px 12px 6px 36px', fontSize: '0.7rem', color: '#aaa' }}>
                              No reports
                            </div>
                          ) : (
                            children.map((report) => {
                              const isActiveDoc = report.id === activeDocId;
                              return (
                                <div
                                  key={report.id}
                                  className={`lead-report-row${isActiveDoc ? ' is-active' : ''}`}
                                  onClick={() => handleReportClick(lead.id, report.id)}
                                  style={{
                                    padding: '5px 12px 5px 36px', cursor: 'pointer',
                                    fontSize: '0.75rem', fontWeight: isActiveDoc ? 600 : 400,
                                    color: isActiveDoc ? '#1a73e8' : '#666',
                                    display: 'flex', alignItems: 'center', gap: 6,
                                    background: isActiveDoc ? '#dbeafe' : 'transparent',
                                    userSelect: 'none',
                                  }}
                                  onMouseEnter={(e) => { if (!isActiveDoc) e.currentTarget.style.background = '#e8e7e4'; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.background = isActiveDoc ? '#dbeafe' : 'transparent'; }}
                                  data-testid="report-list-item"
                                >
                                  <span aria-hidden="true">📄</span>
                                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, minWidth: 0 }}>
                                    {report.title}
                                  </span>
                                  {report.status === 'draft' && (
                                    <span style={{ fontSize: '0.6rem', color: '#aaa', flexShrink: 0 }}>Draft</span>
                                  )}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setPendingDelete({ id: report.id, title: report.title });
                                    }}
                                    title="Delete report"
                                    aria-label="Delete report"
                                    className="lead-report-row-del"
                                    style={{
                                      border: 'none', background: 'transparent', cursor: 'pointer',
                                      padding: '0 2px', fontSize: '0.8rem', color: '#9ca3af',
                                      flexShrink: 0, lineHeight: 1,
                                    }}
                                    data-testid="report-delete-btn"
                                  >
                                    🗑️
                                  </button>
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div style={{ padding: 10, borderTop: `1px solid ${sidebarBorder}`, background: 'white' }}>
              <button
                onClick={handleCreateReport}
                disabled={!selectedLeadId}
                style={{
                  width: '100%', padding: '7px 0', borderRadius: 8, cursor: 'pointer',
                  border: '1px solid #059669', background: '#ecfdf5', color: '#059669',
                  fontSize: '0.75rem', fontWeight: 600,
                  opacity: !selectedLeadId ? 0.4 : 1,
                }}
                data-testid="new-report-btn"
              >
                + New Report
              </button>
            </div>
          </aside>
        )}

        <div className="lead-reports-main" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
          {activeDocId && (
          <div
            className="lead-reports-toolbar"
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '8px 24px', borderBottom: `1px solid ${sidebarBorder}`,
              background: 'white', flexShrink: 0, overflowX: 'auto',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Untitled report"
                style={{
                  border: 'none', outline: 'none', fontSize: '1.1rem', fontWeight: 600,
                  color: '#333', background: 'transparent', width: '100%', maxWidth: 360, minWidth: 120,
                }}
                data-testid="report-title-input"
              />
              {metaLine && (
                <span style={{ fontSize: '0.8rem', color: '#999', whiteSpace: 'nowrap' }} data-testid="report-meta">
                  {metaLine}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <span style={{ fontSize: '0.75rem', color: '#999', whiteSpace: 'nowrap' }}>
                {activeDoc?.status === 'draft' ? 'Draft' : 'Finalised'}
              </span>
              <span style={{ fontSize: '0.75rem', color: '#999', whiteSpace: 'nowrap' }} data-testid="save-status">
                {isSaving ? 'Saving…' : lastSaved ? `● Saved at ${lastSaved}` : ''}
              </span>

              <button
                onClick={handleSaveNow}
                style={{
                  padding: '4px 12px', fontSize: '0.8rem', borderRadius: 6,
                  border: '1px solid #ddd', background: 'white', cursor: 'pointer', color: '#555',
                }}
                data-testid="save-btn"
              >
                Save
              </button>
              <button
                onClick={handleCreateReport}
                style={{
                  padding: '4px 12px', fontSize: '0.8rem', borderRadius: 6,
                  border: '1px solid #059669', background: '#ecfdf5', cursor: 'pointer',
                  color: '#059669', fontWeight: 500,
                }}
                data-testid="toolbar-new-report-btn"
              >
                + New Report
              </button>
              <button
                onClick={() => window.print()}
                style={{
                  padding: '4px 12px', fontSize: '0.8rem', borderRadius: 6,
                  border: '1px solid #ddd', background: 'white', cursor: 'pointer', color: '#555',
                }}
                data-testid="print-btn"
              >
                Print
              </button>
              <button
                onClick={() => window.print()}
                style={{
                  padding: '4px 12px', fontSize: '0.8rem', borderRadius: 6,
                  border: '1px solid #1a73e8', background: '#1a73e8', cursor: 'pointer',
                  color: 'white', fontWeight: 500,
                }}
                data-testid="export-pdf-btn"
              >
                Export PDF
              </button>
              <button
                onClick={() => activeDocId && setPendingDelete({ id: activeDocId, title })}
                style={{
                  padding: '4px 12px', fontSize: '0.8rem', borderRadius: 6,
                  border: '1px solid #fecaca', background: '#fef2f2', cursor: 'pointer',
                  color: '#dc2626', fontWeight: 500,
                }}
                data-testid="delete-btn"
              >
                Delete
              </button>
            </div>
          </div>
          )}

          <div style={{ flex: 1, overflowY: 'auto', background: '#f7f6f3' }}>
            {!selectedLeadId ? (
              <div className="lead-reports-home" style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px' }} data-testid="lead-reports-home">
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#222', margin: '0 0 4px' }}>
                  Lead Reports
                </h2>
                <p style={{ fontSize: '0.85rem', color: '#999', margin: '0 0 20px' }} data-testid="lead-reports-count">
                  {leads.length} Lead{leads.length !== 1 ? 's' : ''}
                </p>
                {leadsLoading ? (
                  <div>
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} style={{ height: 110, borderRadius: 10, background: '#e8e7e4', marginBottom: 12, animation: 'sk-pulse 1.5s infinite' }} />
                    ))}
                    <style>{`@keyframes sk-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
                  </div>
                ) : leads.length === 0 ? (
                  <div style={{
                    padding: '60px 32px', background: 'white', borderRadius: 12,
                    border: '2px dashed #eee', textAlign: 'center', color: '#999', fontSize: '0.9rem',
                  }}>
                    No leads yet.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {leads.map((lead) => (
                    <div
                      key={lead.id}
                      onClick={() => handleLeadClick(lead.id)}
                      style={{
                        padding: '18px 22px', background: 'white', borderRadius: 10,
                        border: `1px solid ${sidebarBorder}`, cursor: 'pointer',
                        transition: 'box-shadow 0.15s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
                      data-testid="home-lead-item"
                    >
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '1.1rem', fontWeight: 600, color: '#333' }}>
                          {lead.property_address}
                        </span>
                        {lead.suburb && (
                          <span style={{ fontSize: '0.85rem', color: '#999' }}>{lead.suburb}</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 20px', marginTop: 10, fontSize: '0.85rem', color: '#666' }}>
                        {lead.owner_name && (
                          <span><span style={{ color: '#aaa' }}>Owner:</span> {lead.owner_name}</span>
                        )}
                        {lead.owner_phone && (
                          <span><span style={{ color: '#aaa' }}>Phone:</span> {lead.owner_phone}</span>
                        )}
                        {lead.owner_email && (
                          <span><span style={{ color: '#aaa' }}>Email:</span> {lead.owner_email}</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, fontSize: '0.75rem' }}>
                        {lead.status && (
                          <span style={{
                            padding: '3px 10px', borderRadius: 8,
                            background: lead.status === 'new' ? '#dbeafe' : lead.status === 'contacted' ? '#fef3c7' : '#d1fae5',
                            color: lead.status === 'new' ? '#1e40af' : lead.status === 'contacted' ? '#92400e' : '#065f46',
                            fontWeight: 500,
                          }}>
                            {lead.status}
                          </span>
                        )}
                        {lead.created_at && (
                          <span style={{ color: '#aaa' }}>
                            Added {new Date(lead.created_at).toLocaleDateString('en-NZ')}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  </div>
                )}
              </div>
            ) : !activeDocId ? (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: '0.9rem' }}>
                <span style={{ fontSize: '2rem', marginBottom: 12 }} aria-hidden="true">📝</span>
                <p style={{ marginBottom: 16 }}>No reports for this address yet.</p>
                <button
                  onClick={handleCreateReport}
                  style={{
                    padding: '8px 18px', borderRadius: 8, cursor: 'pointer',
                    border: '1px solid #059669', background: '#ecfdf5', color: '#059669',
                    fontSize: '0.8rem', fontWeight: 600,
                  }}
                >
                  + Create first report
                </button>
              </div>
            ) : docLoading && !activeDoc ? (
              <div style={{ padding: '32px 40px', maxWidth: 900, margin: '0 auto' }}>
                <div style={{ height: 28, width: '60%', background: '#eee', borderRadius: 8, animation: 'sk-pulse 1.5s infinite 0.1s', marginBottom: 16 }} />
                <div style={{ height: 16, width: '80%', background: '#eee', borderRadius: 6, animation: 'sk-pulse 1.5s infinite 0.2s', marginBottom: 8 }} />
                <div style={{ height: 16, width: '65%', background: '#eee', borderRadius: 6, animation: 'sk-pulse 1.5s infinite 0.3s' }} />
                <style>{`@keyframes sk-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
              </div>
            ) : activeDoc ? (
              <ReportEditor
                key={activeDocId}
                docId={activeDocId!}
                initialContent={activeDoc.content ?? null}
                getContentRef={getContentRef}
              />
            ) : null}
          </div>
        </div>

        <GenerateReportModal
          open={showGenerate}
          leadId={selectedLeadId || undefined}
          defaultSuburbName={selectedLead?.suburb || ''}
          defaultAddressName={selectedLead?.property_address || ''}
          onClose={() => setShowGenerate(false)}
          onGenerated={handleGenerated}
        />

        <ConfirmModal
          open={!!pendingDelete}
          title={`Delete "${pendingDelete?.title || 'this report'}"?`}
          message="Are you sure you want to delete this report? This action is permanent and cannot be undone."
          onCancel={() => setPendingDelete(null)}
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
    </>
  );
}

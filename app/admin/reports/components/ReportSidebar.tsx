'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ConfirmModal from './ConfirmModal';
import { useReportStore, OverviewSuburb } from '../stores/report-store';
import { SUBURB_PRIORITY_ORDER } from '@/lib/suburb-order';

const SUBURB_ORDER = ['North Shore', ...SUBURB_PRIORITY_ORDER];

export default function ReportSidebar() {
  const router = useRouter();
  const setSelectedDocId = useReportStore(s => s.setSelectedDocId);
  const [expanded, setExpanded] = useState(true);
  const [isSuburbsOpen, setIsSuburbsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedSuburb, setSelectedSuburb] = useState<string | null>(null);
  const [expandedSuburbs, setExpandedSuburbs] = useState<Set<string>>(new Set());
  const [aboutMarieDoc, setAboutMarieDoc] = useState<{ id: string } | null>(null);
  const [aboutMarieLoading, setAboutMarieLoading] = useState(true);

  const selectedDocId = useReportStore(s => s.selectedDocId);
  const setSidebarCollapsed = useReportStore(s => s.setSidebarCollapsed);
  const bumpRefreshKey = useReportStore(s => s.bumpRefreshKey);
  const slugMap = useReportStore(s => s.slugMap);
  const suburbs = useReportStore(s => s.overviewSuburbs);

  useEffect(() => {
    if (slugMap['about-marie']) {
      setAboutMarieDoc({ id: slugMap['about-marie'] });
      setAboutMarieLoading(false);
    } else {
      const check = setInterval(() => {
        const id = useReportStore.getState().slugMap['about-marie'];
        if (id) {
          setAboutMarieDoc({ id });
          setAboutMarieLoading(false);
          clearInterval(check);
        }
      }, 500);
      return () => clearInterval(check);
    }
  }, [slugMap]);

  const handleClick = (docId: string) => {
    router.replace(`/admin/reports/${docId}`, { scroll: false });
  };

  const handleSuburbClick = (name: string, suburbs: OverviewSuburb[]) => {
    const suburb = suburbs.find((s) => s.name === name);
    let docId: string | null = null;
    if (suburb?.introDoc) {
      docId = suburb.introDoc.id;
    } else if (suburb?.letterDoc) {
      docId = suburb.letterDoc.id;
    } else if (suburb?.reports[0]) {
      docId = suburb.reports[0].id;
    } else {
      setSelectedSuburb(selectedSuburb === name ? null : name);
    }
    if (docId) {
      router.replace(`/admin/reports/${docId}`, { scroll: false });
    }
    setTimeout(() => {
      const el = document.getElementById(`sidebar-${name.replace(/\s+/g, '-')}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
  };

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);

  const handleAboutMarieClick = () => {
    if (aboutMarieDoc?.id) {
      router.replace(`/admin/reports/${aboutMarieDoc.id}`, { scroll: false });
    }
  };

  const handleDocDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/admin/reports/documents/${deleteTarget.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        bumpRefreshKey();
        if (selectedDocId === deleteTarget.id) {
          setSelectedDocId(null);
          const suburb = suburbs.find((s) =>
            s.introDoc?.id === deleteTarget.id ||
            s.letterDoc?.id === deleteTarget.id ||
            s.reports.some((report) => report.id === deleteTarget.id)
          );
          if (suburb) {
            const nextDoc = suburb.introDoc || suburb.letterDoc || suburb.reports?.[0];
            if (nextDoc) {
              router.push(`/admin/reports/${nextDoc.id}`);
            } else {
              router.push('/admin/reports');
            }
          } else {
            router.push('/admin/reports');
          }
        }
      }
    } catch {} finally {
      setDeleteTarget(null);
    }
  };

  const visibleSuburbs = suburbs.filter((s) =>
    !search || s.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <aside className="reports-sidebar" style={{
      width: 240, minWidth: 240, height: '100%', overflow: 'hidden',
      background: '#f7f6f3', borderRight: '1px solid #e8e7e4',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ padding: '12px 12px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span
            onClick={() => router.push('/admin/reports')}
            style={{ cursor: 'pointer', fontSize: '1rem', fontWeight: 700, color: '#333', margin: 0, transition: 'opacity 0.1s' }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.7'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
          >
            Reports
          </span>
          <span
            onClick={() => setSidebarCollapsed(true)}
            title="Collapse sidebar"
            style={{
              cursor: 'pointer', fontSize: '0.75rem', color: '#999', padding: '2px 6px',
              borderRadius: 4, lineHeight: 1, userSelect: 'none',
              transition: 'color 0.1s, background 0.1s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#333'; e.currentTarget.style.background = '#e8e7e4'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#999'; e.currentTarget.style.background = 'transparent'; }}
          >
            ◀
          </span>
        </div>
      </div>

      <div
        onClick={() => setIsSuburbsOpen(!isSuburbsOpen)}
        style={{
          padding: '8px 12px', cursor: 'pointer', fontSize: '0.8rem',
          fontWeight: 600, color: '#555', display: 'flex', alignItems: 'center', gap: 6,
          borderTop: '1px solid #e8e7e4', borderBottom: '1px solid #e8e7e4',
          userSelect: 'none', flexShrink: 0,
        }}
      >
        <span style={{ transform: isSuburbsOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', fontSize: '0.65rem' }}>▶</span>
        <span style={{ fontSize: '1rem' }}>🏘️</span>
        <span>Suburbs</span>
      </div>

      {isSuburbsOpen && (
        <div style={{ padding: '8px 12px', borderBottom: '1px solid #e8e7e4' }}>
          <input
            type="text"
            placeholder="Search suburbs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%', padding: '6px 10px', fontSize: '0.8rem',
              border: '1px solid #ddd', borderRadius: 6,
              outline: 'none', boxSizing: 'border-box',
              background: search ? 'white' : '#f0efed',
            }}
            onFocus={(e) => e.target.style.background = 'white'}
            onBlur={(e) => e.target.style.background = search ? 'white' : '#f0efed'}
          />
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8,
            maxHeight: 120, overflowY: 'auto',
          }}>
            {[...SUBURB_ORDER, ...suburbs.filter((s) => !SUBURB_ORDER.includes(s.name)).map((s) => s.name)].map((name) => {
              const hasData = suburbs.some((s) => s.name === name);
              if (!hasData) return null;
              const isSelected = selectedSuburb === name;
              return (
                <button
                  key={name}
                  onClick={() => handleSuburbClick(name, suburbs)}
                  style={{
                    padding: '3px 8px', fontSize: '0.7rem', fontWeight: isSelected ? 600 : 500,
                    background: isSelected ? '#1a73e8' : 'white',
                    color: isSelected ? 'white' : '#4a5568',
                    border: isSelected ? '1px solid #1a73e8' : '1px solid #e2e8f0',
                    borderRadius: 8, cursor: 'pointer', transition: 'all 0.1s',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) { e.currentTarget.style.background = '#e8f0fe'; e.currentTarget.style.borderColor = '#1a73e8'; }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = '#e2e8f0'; }
                  }}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div
        onClick={handleAboutMarieClick}
        style={{
          padding: '8px 12px', cursor: aboutMarieLoading ? 'default' : 'pointer',
          fontSize: '0.8rem', fontWeight: 600, color: '#555',
          display: 'flex', alignItems: 'center', gap: 8,
          borderTop: '1px solid #e8e7e4', borderBottom: '1px solid #e8e7e4',
          userSelect: 'none', flexShrink: 0,
          background: selectedDocId === aboutMarieDoc?.id ? '#dbeafe' : 'transparent',
          opacity: aboutMarieLoading ? 0.4 : 1,
        }}
        onMouseEnter={(e) => { if (!aboutMarieLoading && selectedDocId !== aboutMarieDoc?.id) e.currentTarget.style.background = '#e8f0fe'; }}
        onMouseLeave={(e) => { if (selectedDocId !== aboutMarieDoc?.id) e.currentTarget.style.background = 'transparent'; }}
      >
        <span style={{ fontSize: '1rem' }}>👤</span>
        <span>About Marie</span>
      </div>

      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          padding: '6px 12px', cursor: 'pointer', fontSize: '0.8rem',
          fontWeight: 600, color: '#555', display: 'flex', alignItems: 'center', gap: 6,
          borderBottom: '1px solid #e8e7e4',
          userSelect: 'none', flexShrink: 0,
        }}
      >
        <span style={{ transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', fontSize: '0.65rem' }}>▶</span>
        <span>📍 North Shore</span>
        <span style={{ fontSize: '0.7rem', color: '#999', marginLeft: 'auto' }}>{visibleSuburbs.length}</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {expanded && visibleSuburbs.map((suburb) => {
          const allDocs: Array<{ id: string; title: string; icon: string; meta?: string }> = [];
          if (suburb.introDoc) allDocs.push({ id: suburb.introDoc.id, title: suburb.introDoc.title, icon: '📝' });
          if (suburb.letterDoc) allDocs.push({ id: suburb.letterDoc.id, title: suburb.letterDoc.title, icon: '📬' });
          for (const r of [...suburb.reports].sort((a, b) => b.quarter.localeCompare(a.quarter))) {
            allDocs.push({ id: r.id, title: r.title, icon: '📊', meta: r.quarter });
          }

          return (
              <div key={suburb.id} id={`sidebar-${suburb.name.replace(/\s+/g, '-')}`}>
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedSuburbs(prev => {
                        const next = new Set(prev);
                        if (next.has(suburb.name)) {
                          next.delete(suburb.name);
                        } else {
                          next.add(suburb.name);
                        }
                        return next;
                      });
                    }}
                  style={{
                    padding: '5px 12px 1px 16px', fontSize: '0.78rem', fontWeight: 600,
                    color: '#666', display: 'flex', alignItems: 'center', gap: 4,
                    cursor: 'pointer', userSelect: 'none',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#1a73e8'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = '#666'; }}
                >
                  <span style={{
                    fontSize: '0.6rem', transition: 'transform 0.15s',
                    transform: expandedSuburbs.has(suburb.name) ? 'rotate(90deg)' : 'none',
                  }}>▶</span>
                  {suburb.name}
                </div>
              {expandedSuburbs.has(suburb.name) && allDocs.map((doc) => (
                <div
                  key={doc.id}
                  className="sidebar-doc-row"
                  onClick={() => handleClick(doc.id)}
                  style={{
                    padding: '2px 12px 2px 28px', cursor: 'pointer', fontSize: '0.78rem',
                    color: selectedDocId === doc.id ? '#1a73e8' : '#444',
                    background: selectedDocId === doc.id ? '#e8f0fe' : 'transparent',
                    borderRadius: 4, margin: '0 6px',
                    display: 'flex', alignItems: 'center', gap: 4,
                    transition: 'all 0.1s', position: 'relative',
                  }}
                  onMouseEnter={(e) => { if (selectedDocId !== doc.id) e.currentTarget.style.background = '#eee'; }}
                  onMouseLeave={(e) => { if (selectedDocId !== doc.id) e.currentTarget.style.background = 'transparent'; }}
                >
                  <span style={{ fontSize: '0.8rem' }}>{doc.icon}</span>
                  <span style={{
                    flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    fontWeight: selectedDocId === doc.id ? 600 : 400,
                  }}>
                    {doc.title}
                  </span>
                  {doc.meta && (
                    <span style={{ fontSize: '0.6rem', color: '#999' }}>{doc.meta}</span>
                  )}
                  <span
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget({ id: doc.id, title: doc.title }); }}
                    style={{
                      fontSize: '0.75rem', cursor: 'pointer', opacity: 0, padding: '2px 4px',
                      borderRadius: 4, color: '#9ca3af',
                    }}
                    className="sidebar-delete-icon"
                    onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                    onMouseLeave={(e) => e.currentTarget.style.opacity = '0'}
                  >
                    🗑️
                  </span>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      <style>{`
        .sidebar-doc-row:hover .sidebar-delete-icon {
          opacity: 1 !important;
        }
      `}</style>

      <ConfirmModal
        open={deleteTarget !== null}
        title={`Delete "${deleteTarget?.title ?? ''}"?`}
        message="Are you sure you want to delete this document? This action is permanent and cannot be undone."
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDocDelete}
        confirmLabel="Confirm Delete"
      />
    </aside>
  );
}

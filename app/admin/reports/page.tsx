'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import TemplateSelector from './components/TemplateSelector';
import { useTemplate } from './hooks/useTemplate';
import { useReportStore } from './stores/report-store';

interface SuburbDoc {
  id: string;
  title: string;
  quarter: string;
  status: string;
  createdAt: string;
}

interface SuburbEntry {
  id: string;
  name: string;
  introDoc: { id: string; title: string; status: string } | null;
  letterDoc: { id: string; title: string; status: string } | null;
  reports: SuburbDoc[];
}

function getCurrentQuarter(): string {
  const now = new Date();
  const q = Math.ceil((now.getMonth() + 1) / 3);
  return `${now.getFullYear()}-Q${q}`;
}

export default function ReportsPage() {
  const router = useRouter();
  const [suburbs, setSuburbs] = useState<SuburbEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTemplate, setShowTemplate] = useState(false);
  const [selectedSuburbId, setSelectedSuburbId] = useState<string | null>(null);
  const { generateReport } = useTemplate();
  const bumpRefreshKey = useReportStore(s => s.bumpRefreshKey);
  const idToSlug = useReportStore(s => s.idToSlug);
  const suburbRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    const hash = window.location.hash.replace('#', '').replace(/-/g, ' ');
    if (hash) {
      setTimeout(() => {
        const el = suburbRefs.current.get(hash);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    }
    const onHashChange = () => {
      const h = window.location.hash.replace('#', '').replace(/-/g, ' ');
      const el = suburbRefs.current.get(h);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [suburbs]);

  useEffect(() => {
    fetch('/api/admin/reports/overview')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setSuburbs(data.suburbs);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleGenerateReport = (suburbId: string) => {
    setSelectedSuburbId(suburbId);
    setShowTemplate(true);
  };

  const handleOpenDoc = (docId: string) => {
    const slug = idToSlug[docId];
    router.push(`/admin/reports/${slug || docId}`);
  };

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{ padding: 32, maxWidth: 960, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: '0 0 4px', fontSize: '1.5rem', fontWeight: 700, color: '#222' }}>
          Reports
        </h1>
        <p style={{ margin: 0, fontSize: '0.85rem', color: '#999' }}>
          {suburbs.length} suburbs
        </p>
      </div>



      {suburbs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#999', border: '2px dashed #eee', borderRadius: 12 }}>
          No suburbs found.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {suburbs.map((suburb) => {
            const sortedReports = [...suburb.reports].sort((a, b) => b.quarter.localeCompare(a.quarter));
            const allDocs: Array<{ id: string; title: string; icon: string; badge?: string; status?: string; type: string }> = [];

            if (suburb.introDoc) allDocs.push({ ...suburb.introDoc, icon: '📝', type: 'intro', badge: 'intro' });
            if (suburb.letterDoc) allDocs.push({ ...suburb.letterDoc, icon: '📬', type: 'letter', badge: 'letter' });
            for (const r of sortedReports) {
              allDocs.push({ id: r.id, title: r.title, icon: '📊', badge: r.quarter, status: r.status, type: 'report' });
            }

            return (
              <div key={suburb.id} ref={(el) => { if (el) suburbRefs.current.set(suburb.name, el); }}>
                <div style={{
                  border: '1px solid #e8e7e4', borderRadius: 10,
                  overflow: 'hidden', background: 'white',
                  transition: 'box-shadow 0.15s',
                }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 16px',
                    borderBottom: allDocs.length > 0 ? '1px solid #f0efed' : 'none',
                  }}>
                    <div>
                      <div style={{ fontSize: '1rem', fontWeight: 600, color: '#333', display: 'flex', alignItems: 'center', gap: 8 }}>
                        {suburb.name}
                        <span style={{ fontSize: '0.7rem', color: '#999', fontWeight: 400 }}>
                          {allDocs.length} doc{allDocs.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleGenerateReport(suburb.id)}
                      style={{
                        padding: '6px 14px', borderRadius: 6, border: '1px solid #1a73e8',
                        background: 'white', cursor: 'pointer', color: '#1a73e8',
                        fontWeight: 500, fontSize: '0.8rem', whiteSpace: 'nowrap',
                      }}
                    >
                      + Generate Report
                    </button>
                  </div>

                  {allDocs.map((doc) => (
                    <div
                      key={doc.id}
                      onClick={() => handleOpenDoc(doc.id)}
                      style={{
                        padding: '8px 16px 8px 24px', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 8,
                        borderBottom: '1px solid #f5f4f2',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f7f6f3'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <span style={{ fontSize: '1rem' }}>{doc.icon}</span>
                      <span style={{
                        fontSize: '0.9rem',
                        color: doc.type === 'intro' || doc.type === 'letter' ? '#1a73e8' : '#333',
                        flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {doc.title}
                      </span>
                      {doc.badge && (
                        <span style={{
                          fontSize: '0.7rem', color: '#999',
                          background: '#f0efed', padding: '2px 8px', borderRadius: 4,
                        }}>
                          {doc.badge}
                        </span>
                      )}
                      {doc.status && (
                        <span style={{
                          fontSize: '0.7rem', color: doc.status === 'finalised' ? '#22c55e' : '#f59e0b',
                        }}>
                          {doc.status}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <TemplateSelector
        open={showTemplate}
        onClose={() => { setShowTemplate(false); setSelectedSuburbId(null); }}
        onGenerate={async (suburbId, reportQuarter, startQuarter, endQuarter, reportYear, reportMonth) => {
          const id = await generateReport(suburbId, reportQuarter, startQuarter, endQuarter, reportYear, reportMonth);
          if (id) {
            bumpRefreshKey();
            router.push(`/admin/reports/${id}`);
          }
          return id;
        }}
        preselectedSuburbId={selectedSuburbId}
        preselectedQuarter={getCurrentQuarter()}
      />
    </div>
  );
}

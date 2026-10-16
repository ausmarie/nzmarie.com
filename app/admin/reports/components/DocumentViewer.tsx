'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import ReportEditor from './ReportEditor';
import AboutMarieEditor from './AboutMarieEditor';
import ReportToolbar from './ReportToolbar';
import ConfirmModal from './ConfirmModal';
import EmptyState from './EmptyState';
import EditHeaderFooter from './EditHeaderFooter';
import { useReportStore } from '../stores/report-store';
import { useCtrlS } from '../hooks/useCtrlS';
import type { ReportDocument, ReportEditorContent } from '@/types/report';

export default function DocumentViewer({ docId, onNavigate }: { docId: string; onNavigate?: (id: string | null) => void }) {
  const router = useRouter();
  const { setSelectedDocId, isSaving, updateDocument, documents, bumpRefreshKey } = useReportStore();
  const storeDoc = documents.find(d => d.id === docId) || null;
  const [doc, setDoc] = useState<ReportDocument | null>(null);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [isAboutMarie, setIsAboutMarie] = useState(false);
  const [showHeaderFooter, setShowHeaderFooter] = useState(false);
  const [headerContent, setHeaderContent] = useState('');
  const [footerContent, setFooterContent] = useState('');
  const getContentRef = useRef<(() => ReportEditorContent | null) | null>(null);
  const pageNumber = 1;
  const totalPages = 2;

  useEffect(() => {
    setSelectedDocId(docId);
    setLoading(true);
    setDoc(null);
    setIsAboutMarie(false);
    const fetchDoc = async () => {
      try {
        const res = await fetch(`/api/admin/reports/documents/${docId}`, { cache: 'no-store' });
        const data = await res.json();
        if (data.success) {
          setDoc(data.document);
          setTitle(data.document.title || '');
          setIsAboutMarie(data.document.icon === 'about_marie' || data.document.title === 'About Marie');
        } else {
          bumpRefreshKey();
        }
      } catch {
        bumpRefreshKey();
      } finally {
        setLoading(false);
      }
    };
    const hf = localStorage.getItem('report-hf-global');
    if (hf) {
      try { const p = JSON.parse(hf); setHeaderContent(p.header || ''); setFooterContent(p.footer || ''); } catch {}
    }
    fetchDoc();
  }, [docId, setSelectedDocId, bumpRefreshKey]);

  const handleTitleChange = useCallback(async (newTitle: string) => {
    setTitle(newTitle);
    try {
      await fetch('/api/admin/reports/documents', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: docId, title: newTitle }),
      });
      updateDocument(docId, { title: newTitle });
    } catch {
      // silent
    }
  }, [docId, updateDocument]);

  const handleContentChange = useCallback((content: ReportEditorContent) => {
    updateDocument(docId, { content });
  }, [docId, updateDocument]);

  const handleSaveNow = useCallback(async () => {
    if (!doc) return;
    try {
      const contentToSave = getContentRef.current?.() ?? storeDoc?.content ?? doc.content ?? null;
      console.log('[Save] Manual start — docId:', docId, 'title:', title, 'content:', contentToSave ? 'present' : 'null');

      const waitForAutosave = async () => {
        const start = Date.now();
        while ((useReportStore.getState()?.isSaving) && Date.now() - start < 5000) {
          await new Promise((r) => setTimeout(r, 120));
        }
      };
      await waitForAutosave();

      const res = await fetch('/api/admin/reports/documents', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: docId, title, content: contentToSave }),
      });
      console.log('[Save] Manual response — docId:', docId, 'status:', res.status);
      if (!res.ok) {
        console.log('[Save] Manual failed — docId:', docId, 'status:', res.status);
        return;
      }
      const result = await res.json();
      if (result.success) {
        console.log('[Save] Manual success — docId:', docId);
        updateDocument(docId, { title, content: contentToSave });
      }
    } catch (err) {
      console.error('Failed to save document', err);
    }
  }, [docId, title, doc, storeDoc, updateDocument]);

  useCtrlS(handleSaveNow);

  const handleHeaderFooterSave = useCallback((h: string, f: string) => {
    setHeaderContent(h);
    setFooterContent(f);
    localStorage.setItem('report-hf-global', JSON.stringify({ header: h, footer: f }));
    setShowHeaderFooter(false);
  }, []);

  const handleExport = useCallback(() => {
    window.print();
  }, []);

  const toSlug = (name: string) => name.toLowerCase().replace(/\s+/g, '-');

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/reports/documents/${docId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setToast('Document deleted successfully.');
        setTimeout(() => {
          if (doc?.suburb_name) {
            const introSlug = `${toSlug(doc.suburb_name)}-introduction`;
            router.replace(`/admin/reports/${introSlug}`, { scroll: false });
          } else {
            router.replace('/admin/reports', { scroll: false });
          }
        }, 800);
      }
    } catch {
      setToast('Failed to delete document.');
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  }, [docId, router, doc?.suburb_name]);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ padding: '10px 24px', borderBottom: '1px solid #eee', display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ height: 14, width: 200, background: '#eee', borderRadius: 6, animation: 'sk-pulse 1.5s infinite' }} />
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <div style={{ height: 28, width: 56, background: '#eee', borderRadius: 6, animation: 'sk-pulse 1.5s infinite 0.1s' }} />
            <div style={{ height: 28, width: 120, background: '#eee', borderRadius: 6, animation: 'sk-pulse 1.5s infinite 0.2s' }} />
            <div style={{ height: 28, width: 80, background: '#eee', borderRadius: 6, animation: 'sk-pulse 1.5s infinite 0.3s' }} />
            <div style={{ height: 28, width: 56, background: '#eee', borderRadius: 6, animation: 'sk-pulse 1.5s infinite 0.4s' }} />
          </div>
        </div>
        <div style={{ padding: '32px 40px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ height: 28, width: '60%', background: '#eee', borderRadius: 8, animation: 'sk-pulse 1.5s infinite 0.1s' }} />
          <div style={{ height: 20, width: '40%', background: '#eee', borderRadius: 6, animation: 'sk-pulse 1.5s infinite 0.15s' }} />
          <div style={{ height: 16, width: '30%', background: '#eee', borderRadius: 6, animation: 'sk-pulse 1.5s infinite 0.2s' }} />
          <div style={{ height: 1, width: '100%', background: '#eee', borderRadius: 0, margin: '8px 0' }} />
          <div style={{ height: 22, width: '35%', background: '#eee', borderRadius: 6, animation: 'sk-pulse 1.5s infinite 0.25s' }} />
          <div style={{ height: 14, width: '80%', background: '#eee', borderRadius: 6, animation: 'sk-pulse 1.5s infinite 0.3s' }} />
          <div style={{ height: 14, width: '65%', background: '#eee', borderRadius: 6, animation: 'sk-pulse 1.5s infinite 0.35s' }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginTop: 16 }}>
            <div style={{ height: 80, background: '#eee', borderRadius: 8, animation: 'sk-pulse 1.5s infinite 0.4s' }} />
            <div style={{ height: 80, background: '#eee', borderRadius: 8, animation: 'sk-pulse 1.5s infinite 0.45s' }} />
            <div style={{ height: 80, background: '#eee', borderRadius: 8, animation: 'sk-pulse 1.5s infinite 0.5s' }} />
          </div>
          <div style={{ height: 22, width: '30%', background: '#eee', borderRadius: 6, animation: 'sk-pulse 1.5s infinite 0.5s', marginTop: 8 }} />
          <div style={{ height: 14, width: '90%', background: '#eee', borderRadius: 6, animation: 'sk-pulse 1.5s infinite 0.55s' }} />
          <div style={{ height: 14, width: '75%', background: '#eee', borderRadius: 6, animation: 'sk-pulse 1.5s infinite 0.6s' }} />
        </div>
        <style>{`@keyframes sk-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
      </div>
    );
  }

  if (!doc) {
    return (
      <EmptyState
        onCreatePage={async () => {
          const res = await fetch('/api/admin/reports/documents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ doc_type: 'general', title: 'Untitled' }),
          });
          const data = await res.json();
          if (data.success) { bumpRefreshKey(); onNavigate?.(data.id); }
        }}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: isAboutMarie ? '#f8fafc' : 'white' }}>
      <div style={{ flexShrink: 0, position: 'sticky', top: 0, zIndex: 10, background: 'white' }}>
          <ReportToolbar
            title={title}
            onTitleChange={handleTitleChange}
            status={doc.status}
            docType={doc.doc_type}
            saving={isSaving}
            onSaveNow={handleSaveNow}
            onExport={handleExport}
            onDelete={() => setShowDeleteModal(true)}
            onEditHeaderFooter={() => setShowHeaderFooter(true)}
            suburbName={doc.suburb_name}
          quarter={doc.quarter || undefined}
          suburbId={doc.suburb_id || undefined}
          hideExtraButtons={isAboutMarie}
        />
      </div>
      <ConfirmModal
        open={showDeleteModal}
        title={`Delete "${title}"?`}
        message="Are you sure you want to delete this document? This action is permanent and cannot be undone."
        onCancel={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        loading={deleting}
        confirmLabel="Confirm Delete"
      />
      <EditHeaderFooter
        open={showHeaderFooter}
        header={headerContent}
        footer={footerContent}
        onSave={handleHeaderFooterSave}
        onCancel={() => setShowHeaderFooter(false)}
      />
      <div style={{ flex: 1, position: 'relative' }}>
        {isAboutMarie ? (
          <AboutMarieEditor
            key={docId}
            docId={docId}
            initialContent={doc.content}
            onContentChange={handleContentChange}
          />
        ) : (
          <ReportEditor
            key={docId}
            docId={docId}
            initialContent={doc.content}
            onContentChange={handleContentChange}
            className={doc.doc_type === 'report' ? 'is-quarterly-report' : ''}
            getContentRef={getContentRef}
          />
        )}
        {doc.doc_type === 'report' && (
          <div className="print-page-header">{headerContent || 'nzmarie.com | Market Report'}</div>
        )}
        {doc.doc_type === 'report' && (
          <div className="print-page-footer">
            <div className="print-page-footer-text">{footerContent || 'Data sourced from official REINZ metrics. Prepared independently for property context.'}</div>
            <span className="print-page-footer-page">Page {pageNumber} of {totalPages}</span>
          </div>
        )}
      </div>

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          zIndex: 99999, background: '#065f46', color: 'white',
          padding: '10px 24px', borderRadius: 10, fontSize: '0.9rem',
          fontWeight: 500, boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useReportStore } from '../stores/report-store';
import GenerateReportModal from './GenerateReportModal';

interface ReportToolbarProps {
  title: string;
  onTitleChange: (title: string) => void;
  status: string;
  docType: string;
  saving: boolean;
  onSaveNow: () => void;
  onExport: () => void;
  onDelete: () => void;
  onEditHeaderFooter?: () => void;
  suburbName?: string;
  quarter?: string;
  suburbId?: string;
  hideExtraButtons?: boolean;
}

export default function ReportToolbar({
  title, onTitleChange, status, docType, saving, onSaveNow, onExport, onDelete, onEditHeaderFooter, suburbName, quarter, hideExtraButtons,
}: ReportToolbarProps) {
  const router = useRouter();
  const bumpRefreshKey = useReportStore(s => s.bumpRefreshKey);
  const [showGenerate, setShowGenerate] = useState(false);

  const handleGenerated = (docId: string) => {
    bumpRefreshKey();
    setShowGenerate(false);
    router.push(`/admin/reports/${docId}`);
  };

  return (
    <div className="reports-toolbar" style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '8px 24px', borderBottom: '1px solid #eee', background: 'white',
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
        <input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          style={{
            border: 'none', outline: 'none', fontSize: '1.1rem', fontWeight: 600,
            color: '#333', background: 'transparent', width: '100%', maxWidth: 400,
          }}
          placeholder="Untitled"
        />
        {suburbName && quarter && (
          <span style={{ fontSize: '0.8rem', color: '#999', whiteSpace: 'nowrap' }}>
            {suburbName} · {quarter}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: '0.75rem', color: '#999' }}>
          {saving ? 'Saving...' : status === 'draft' ? 'Draft' : 'Finalised'}
        </span>

        <button onClick={onSaveNow} style={{
          padding: '4px 12px', fontSize: '0.8rem', borderRadius: 6,
          border: '1px solid #ddd', background: 'white', cursor: 'pointer', color: '#555',
        }}>
          Save
        </button>

        {!hideExtraButtons && (
          <button onClick={() => setShowGenerate(true)} style={{
            padding: '4px 12px', fontSize: '0.8rem', borderRadius: 6,
            border: '1px solid #059669', background: '#ecfdf5', cursor: 'pointer',
            color: '#059669', fontWeight: 500,
          }}>
            + Generate Report
          </button>
        )}

        {docType === 'report' && (
          <button onClick={onEditHeaderFooter} style={{
            padding: '4px 12px', fontSize: '0.8rem', borderRadius: 6,
            border: '1px solid #d1d5db', background: 'white', cursor: 'pointer',
            color: '#555', fontWeight: 500,
          }}>
            Edit Header/Footer
          </button>
        )}

        <button onClick={onExport} style={{
          padding: '4px 12px', fontSize: '0.8rem', borderRadius: 6,
          border: '1px solid #1a73e8', background: '#1a73e8', cursor: 'pointer',
          color: 'white', fontWeight: 500,
        }}>
          Export PDF
        </button>

        {!hideExtraButtons && (
          <button onClick={onDelete} style={{
            padding: '4px 12px', fontSize: '0.8rem', borderRadius: 6,
            border: '1px solid #fecaca', background: '#fef2f2', cursor: 'pointer',
            color: '#dc2626', fontWeight: 500,
          }}>
            Delete
          </button>
        )}

        <div style={{ fontSize: '0.75rem', color: '#999' }}>
          {docType === 'report' ? '📊' : docType === 'letter' ? '📬' : docType === 'suburb_intro' ? '📝' : '📄'}
        </div>
      </div>

      <GenerateReportModal
        open={showGenerate}
        defaultSuburbName={suburbName}
        onClose={() => setShowGenerate(false)}
        onGenerated={handleGenerated}
      />
    </div>
  );
}

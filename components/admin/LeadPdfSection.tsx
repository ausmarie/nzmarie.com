'use client';

import React, { useRef, useState } from 'react';
import { FaExternalLinkAlt, FaFilePdf, FaSpinner, FaTrash, FaUpload } from 'react-icons/fa';

export interface LeadPdfDocument {
  id: string;
  lead_id: string;
  doc_type: string;
  file_name: string;
  file_url: string;
  file_size: number;
  mime_type: string;
  uploaded_by?: string | null;
  created_at: string;
}

interface Props {
  documents: LeadPdfDocument[];
  uploading?: boolean;
  onUpload: (files: File[]) => void | Promise<void>;
  onDelete: (document: LeadPdfDocument) => void | Promise<void>;
}

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return date.toLocaleDateString('en-NZ', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function LeadPdfSection({ documents, uploading = false, onUpload, onDelete }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const submitFiles = (fileList: FileList | null) => {
    const files = Array.from(fileList || []).filter(
      (file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    );
    if (files.length > 0) {
      void onUpload(files);
    }
  };

  return (
    <div className="space-y-4">
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload appraisal PDF"
        data-testid="lead-pdf-dropzone"
        onClick={() => {
          if (!uploading) inputRef.current?.click();
        }}
        onKeyDown={(event) => {
          if (!uploading && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          if (!uploading) setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragActive(false);
          if (!uploading) submitFiles(event.dataTransfer.files);
        }}
        className={`rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
          uploading
            ? 'cursor-wait border-slate-200 bg-slate-50'
            : dragActive
              ? 'cursor-pointer border-blue-400 bg-blue-50'
              : 'cursor-pointer border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="hidden"
          onChange={(event) => {
            submitFiles(event.target.files);
            event.target.value = '';
          }}
        />
        <div className="flex flex-col items-center gap-2 text-slate-600">
          {uploading ? (
            <FaSpinner className="animate-spin text-blue-600" size={22} />
          ) : (
            <FaUpload className="text-blue-600" size={22} />
          )}
          <p className="text-sm font-medium">
            {uploading ? 'Uploading PDF...' : 'Drop appraisal PDF here or browse'}
          </p>
          <p className="text-xs text-slate-400">PDF only, up to 25MB per file. Previous files are kept.</p>
        </div>
      </div>

      {documents.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-400">
          No appraisal PDF uploaded yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white" data-testid="lead-pdf-list">
          {documents.map((document, index) => (
            <div
              key={document.id}
              className={`flex flex-wrap items-center gap-3 px-4 py-3 ${
                index > 0 ? 'border-t border-slate-100' : ''
              }`}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600">
                <FaFilePdf size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-medium text-slate-800">{document.file_name}</p>
                  {index === 0 && (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-green-700">
                      Latest
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-slate-400">
                  {formatFileSize(document.file_size)} · {formatDate(document.created_at)}
                  {document.uploaded_by ? ` · ${document.uploaded_by}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={document.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                >
                  <FaExternalLinkAlt size={11} />
                  View
                </a>
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => void onDelete(document)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <FaTrash size={11} />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

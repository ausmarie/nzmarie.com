'use client';

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { SkeletonPDFManager } from '@/components/admin/Skeleton';
import { isAdmin } from '@/lib/permissions';
import { SUBURB_PRIORITY_ORDER } from '@/lib/suburb-order';
import { FaUpload, FaDownload, FaTimes, FaCloudUploadAlt, FaFolderOpen, FaQrcode, FaTrash, FaExternalLinkAlt } from 'react-icons/fa';

interface SuburbReport {
  id: string;
  suburb: string;
  quarter: string;
  year: number;
  doc_label?: string | null;
  file_url: string;
  file_name: string;
  file_size: number;
  download_count: number;
  view_count: number;
  status: string;
  uploaded_by: string;
  uploaded_at: string;
}

interface QrCodeRecord {
  id: string;
  suburb: string;
  target_url: string;
  file_url: string;
  file_name: string;
  file_size: number;
  uploaded_by: string;
  created_at: string;
}

const DEFAULT_SUBURBS = ['North Shore', ...SUBURB_PRIORITY_ORDER];

const SUBURB_URLS: Record<string, string> = {
  'North Shore': 'https://nzmarie.com',
  'Northcross': 'https://nzmarie.com/northcross',
  'Oteha': 'https://nzmarie.com/oteha',
  'Torbay': 'https://nzmarie.com/torbay',
  'Fairview Heights': 'https://nzmarie.com/fairview-heights',
  'Waiake': 'https://nzmarie.com/waiake',
  'Browns Bay': 'https://nzmarie.com/browns-bay',
  'Pinehill': 'https://nzmarie.com/pinehill',
  'Rothesay Bay': 'https://nzmarie.com/rothesay-bay',
  'Murrays Bay': 'https://nzmarie.com/murrays-bay',
  'Albany': 'https://nzmarie.com/albany',
  'Long Bay': 'https://nzmarie.com/long-bay',
  'Rosedale': 'https://nzmarie.com/rosedale',
  'Forrest Hill': 'https://nzmarie.com/forrest-hill',
  'Schnapper Rock': 'https://nzmarie.com/schnapper-rock',
  'Unsworth Heights': 'https://nzmarie.com/unsworth-heights',
  'Sunnynook': 'https://nzmarie.com/sunnynook',
  'Greenhithe': 'https://nzmarie.com/greenhithe',
  'Chatswood': 'https://nzmarie.com/chatswood',
  'Mairangi Bay': 'https://nzmarie.com/mairangi-bay',
  'Campbells Bay': 'https://nzmarie.com/campbells-bay',
  'Castor Bay': 'https://nzmarie.com/castor-bay',
  'Milford': 'https://nzmarie.com/milford',
  'Wairau Valley': 'https://nzmarie.com/wairau-valley',
  'Glenfield': 'https://nzmarie.com/glenfield',
  'Hillcrest': 'https://nzmarie.com/hillcrest',
  'Birkenhead': 'https://nzmarie.com/birkenhead',
  'Hauraki': 'https://nzmarie.com/hauraki',
  'Bayswater': 'https://nzmarie.com/bayswater',
  'Bayview': 'https://nzmarie.com/bayview',
  'Beach Haven': 'https://nzmarie.com/beach-haven',
  'Belmont': 'https://nzmarie.com/belmont',
  'Birkdale': 'https://nzmarie.com/birkdale',
  'Narrow Neck': 'https://nzmarie.com/narrow-neck',
  'Devonport': 'https://nzmarie.com/devonport',
  'Northcote': 'https://nzmarie.com/northcote',
  'Northcote Point': 'https://nzmarie.com/northcote-point',
  'Stanley Point': 'https://nzmarie.com/stanley-point',
  'Takapuna': 'https://nzmarie.com/takapuna',
  'Totara Vale': 'https://nzmarie.com/totara-vale',
};

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR + 3, CURRENT_YEAR + 2, CURRENT_YEAR + 1, CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2];

const DOC_LABEL_OPTIONS = ['Main Report', 'Letter', 'About Marie'] as const;

// Label display order within a suburb (Main Report → Letter → About Marie).
const LABEL_ORDER: Record<string, number> = { 'Main Report': 0, Letter: 1, 'About Marie': 2 };

export default function PDFManagerPageClient() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [reports, setReports] = useState<SuburbReport[]>([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [suburb, setSuburb] = useState('Oteha');
  const [year, setYear] = useState(CURRENT_YEAR.toString());
  const [quarter, setQuarter] = useState('Q2');
  const [selectedFiles, setSelectedFiles] = useState<Array<{ file: File; label: string }>>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [qrSuburb, setQrSuburb] = useState('Oteha');
  const [qrLogo, setQrLogo] = useState<File | null>(null);
  const [qrPreview, setQrPreview] = useState<string | null>(null);
  const [qrGeneratedBlob, setQrGeneratedBlob] = useState<Blob | null>(null);
  const [qrGenerating, setQrGenerating] = useState(false);
  const [qrUploading, setQrUploading] = useState(false);
  const [qrRecords, setQrRecords] = useState<QrCodeRecord[]>([]);
  const [qrDotColor, setQrDotColor] = useState('#000000');
  const qrBgColor = '#FFFFFF';
  const [qrCornerColor, setQrCornerColor] = useState('#000000');
  const [activeTab, setActiveTab] = useState<'qr' | 'pdf'>('pdf');

  const userEmail = session?.user?.email ?? '';
  const isUserAdmin = isAdmin(userEmail);

  useEffect(() => {
    if (status === 'authenticated' && !isUserAdmin) {
      router.push('/admin/dashboard');
    }
  }, [status, isUserAdmin, router]);

  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/pdf/reports');
      const data = await res.json();
      if (res.ok && data.reports) {
        setReports(data.reports);
      }
    } catch {
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchQrCodes = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/qrcode/list');
      const data = await res.json();
      if (res.ok && data.qrcodes) {
        setQrRecords(data.qrcodes);
      }
    } catch {
      setQrRecords([]);
    }
  }, []);

  useEffect(() => {
    if (status === 'authenticated' && isUserAdmin) {
      fetchReports();
      fetchQrCodes();
    }
  }, [status, isUserAdmin, fetchReports, fetchQrCodes]);

  const showNotify = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleDeleteReport = async (item: SuburbReport) => {
    const label = item.doc_label || 'Main Report';
    if (!confirm(`Delete "${item.file_name}" (${label}) for ${item.suburb} ${item.year}-${item.quarter}?\n\nThis will remove the document and its storage. This cannot be undone.`)) {
      return;
    }
    try {
      const res = await fetch('/api/admin/pdf/reports', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id }),
      });
      const data = await res.json();
      if (res.ok) {
        showNotify('success', 'Document deleted');
        fetchReports();
      } else {
        showNotify('error', data.error || 'Failed to delete document');
      }
    } catch {
      showNotify('error', 'Failed to delete document');
    }
  };

  const handleOpenUploadModal = (initialFiles?: File[]) => {
    if (initialFiles && initialFiles.length > 0) {
      setSelectedFiles(initialFiles.map(f => ({ file: f, label: 'Main Report' })));
    }
    setIsModalOpen(true);
  };

  const updateFileLabel = (index: number, label: string) => {
    setSelectedFiles(prev => prev.map((item, i) => (i === index ? { ...item, label } : item)));
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files || []);
    const pdfs = droppedFiles.filter(f => f.type === 'application/pdf');
    if (pdfs.length > 0) {
      handleOpenUploadModal(pdfs);
    } else if (droppedFiles.length > 0) {
      showNotify('error', 'Please upload PDF files only');
    }
  };

  const handleUploadSubmit = async () => {
    if (!selectedFiles.length) {
      showNotify('error', 'Please select at least one PDF file');
      return;
    }

    setIsUploading(true);
    try {
      const uploadResults = [] as Array<{ suburb: string; quarter: string; year: string; label: string; fileName: string; fileSize: number; fileUrl: string }>;
      for (const { file, label } of selectedFiles) {
        const presignRes = await fetch('/api/admin/pdf/upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ suburb, quarter, year: Number(year), fileName: file.name, label }),
        });
        const signedData = await presignRes.json();
        if (!presignRes.ok || !signedData.url) {
          throw new Error(signedData.error || 'Failed to prepare upload');
        }

        const uploadRes = await fetch(signedData.url, {
          method: 'PUT',
          headers: { 'Content-Type': file.type || 'application/pdf' },
          body: file,
        });

        if (!uploadRes.ok) {
          const errorText = await uploadRes.text();
          throw new Error(`Failed to upload file to R2: ${uploadRes.status} ${uploadRes.statusText} - ${errorText}`);
        }

        uploadResults.push({
          suburb,
          quarter,
          year,
          label,
          fileName: file.name,
          fileSize: file.size,
          fileUrl: signedData.fileUrl,
        });
      }

      const res = await fetch('/api/admin/pdf/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploads: uploadResults }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showNotify('success', `${data.count || selectedFiles.length} document(s) for ${suburb} ${year}-${quarter} uploaded successfully`);
        setIsModalOpen(false);
        setSelectedFiles([]);
        fetchReports();
      } else {
        showNotify('error', data.error || 'Failed to upload report');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Network error while uploading report';
      console.error('[Upload] Error:', err);
      showNotify('error', errorMsg);
    } finally {
      setIsUploading(false);
    }
  };

  const handleQrGenerate = async () => {
    if (!qrLogo) {
      showNotify('error', 'Please select a logo image first');
      return;
    }

    setQrGenerating(true);
    setQrPreview(null);
    setQrGeneratedBlob(null);

    if (!SUBURB_URLS[qrSuburb]) {
      showNotify('error', `No target URL configured for ${qrSuburb}`);
      setQrGenerating(false);
      return;
    }

    try {
      const QrCodeWithLogo = (await import('qrcode-with-logos')).default;
      const canvas = document.createElement('canvas');

      const logoUrl = URL.createObjectURL(qrLogo);

      const qrcode = new QrCodeWithLogo({
        canvas,
        content: SUBURB_URLS[qrSuburb],
        width: 3500,
        logo: {
          src: logoUrl,
        },
        dotsOptions: {
          color: qrDotColor,
        },
        cornersOptions: {
          color: qrCornerColor,
        },
        nodeQrCodeOptions: {
          color: {
            dark: qrDotColor,
            light: qrBgColor,
          },
        },
      });

      const resultCanvas = await qrcode.getCanvas();
      const blob = await new Promise<Blob | null>((resolve) =>
        resultCanvas.toBlob((b) => resolve(b), 'image/png')
      );

      URL.revokeObjectURL(logoUrl);

      if (!blob) {
        showNotify('error', 'Failed to generate QR code image');
        setQrGenerating(false);
        return;
      }

      const previewUrl = URL.createObjectURL(blob);
      setQrPreview(previewUrl);
      setQrGeneratedBlob(blob);
    } catch (err) {
      console.error('QR generation error:', err);
      showNotify('error', 'Failed to generate QR code');
    } finally {
      setQrGenerating(false);
    }
  };

  const handleQrUpload = async () => {
    if (!qrGeneratedBlob || !qrPreview) {
      showNotify('error', 'Please generate a QR code first');
      return;
    }

    setQrUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', new File([qrGeneratedBlob], `qrcode-${qrSuburb.toLowerCase().replace(/\s+/g, '-')}.png`, { type: 'image/png' }));
      formData.append('suburb', qrSuburb);
      formData.append('target_url', SUBURB_URLS[qrSuburb]);

      const res = await fetch('/api/admin/qrcode/upload', { method: 'POST', body: formData });
      const data = await res.json();

      if (res.ok) {
        showNotify('success', `QR code for ${qrSuburb} uploaded successfully`);
        fetchQrCodes();
      } else {
        showNotify('error', data.error || 'Failed to upload QR code');
      }
    } catch {
      showNotify('error', 'Failed to upload QR code');
    } finally {
      setQrUploading(false);
    }
  };

  const handleQrDelete = async (record: QrCodeRecord) => {
    if (!confirm(`Delete QR code for ${record.suburb}?`)) {
      return;
    }

    try {
      const res = await fetch('/api/admin/qrcode/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: record.id }),
      });
      const data = await res.json();
      if (res.ok) {
        showNotify('success', 'QR code deleted');
        fetchQrCodes();
      } else {
        showNotify('error', data.error || 'Failed to delete QR code');
      }
    } catch {
      showNotify('error', 'Failed to delete QR code');
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
  };

  // Group by suburb. Suburbs are ordered by their Main Report's upload date
// (newest first; suburbs without a Main Report sort last), and within a suburb
// reports follow the Main Report → Letter → About Marie label order, newest
// upload first within the same label.
const filteredReports = useMemo(() => {
  const labelRank = (label: string) => LABEL_ORDER[label] ?? 3;
  const mainTsBySuburb = new Map<string, number>();
  for (const r of reports) {
    if (labelRank(r.doc_label || 'Main Report') === 0) {
      const ts = new Date(r.uploaded_at).getTime();
      const cur = mainTsBySuburb.get(r.suburb);
      if (cur === undefined || ts > cur) mainTsBySuburb.set(r.suburb, ts);
    }
  }
  return [...reports].sort((a, b) => {
    const am = mainTsBySuburb.get(a.suburb) ?? -Infinity;
    const bm = mainTsBySuburb.get(b.suburb) ?? -Infinity;
    if (am !== bm) return bm - am;
    if (a.suburb !== b.suburb) return a.suburb.localeCompare(b.suburb);
    const la = labelRank(a.doc_label || 'Main Report');
    const lb = labelRank(b.doc_label || 'Main Report');
    if (la !== lb) return la - lb;
    return new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime();
  });
}, [reports]);

  return (
    <div className="min-h-screen bg-slate-100">
      {notification && (
        <div className={`fixed top-4 right-4 z-50 rounded-lg border px-4 py-3 shadow-lg ${notification.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
          {notification.message}
        </div>
      )}

      <div className="mx-auto max-w-7xl p-6">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-sky-600">Admin tools</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">Assets & reports</h1>
          </div>
        </div>

        <div className="mb-6 flex gap-3 rounded-2xl bg-white p-1 shadow-sm ring-1 ring-slate-200">
          {(['pdf', 'qr'] as const).map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition ${activeTab === tab ? 'bg-sky-600 text-white shadow' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              {tab === 'pdf' ? 'PDF Reports' : 'QR Codes'}
            </button>
          ))}
        </div>

        {activeTab === 'pdf' ? (
          <div className="space-y-6">
            <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">Upload suburb reports</h2>
                  <p className="text-sm text-slate-600">Store PDFs for each suburb and quarter.</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleOpenUploadModal()}
                  className="inline-flex items-center justify-center rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-sky-700"
                >
                  <FaUpload className="mr-2" />
                  Upload PDF
                </button>
              </div>
            </div>

            {loading ? (
              <SkeletonPDFManager />
            ) : (
              <div className="rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
                {filteredReports.length === 0 ? (
                  <div className="border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">No PDF reports uploaded yet.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50">
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Suburb</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Quarter / Year</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">File</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Label</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-600">Downloads</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Date</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-600">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredReports.map((report, index) => (
                          <tr key={report.id} className={`border-b border-slate-200 hover:bg-slate-50 ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                            <td className="px-4 py-3 text-sm font-medium text-slate-900">{report.suburb}</td>
                            <td className="px-4 py-3 text-sm text-slate-600">{report.quarter} {report.year}</td>
                            <td className="px-4 py-3 text-sm text-slate-600 truncate max-w-xs">{report.file_name}</td>
                            <td className="px-4 py-3 text-sm">
                              <span className="inline-flex rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700">
                                {report.doc_label || 'Main Report'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center text-sm text-slate-600">{report.download_count}</td>
                            <td className="px-4 py-3 text-sm text-slate-600">
                              {new Date(report.uploaded_at).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <a
                                  href={report.file_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                                  title="Review file"
                                >
                                  <FaExternalLinkAlt className="text-xs" />
                                </a>
                                <a
                                  href={report.file_url}
                                  download={report.file_name}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center rounded-lg bg-sky-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-sky-700"
                                  title="Download file"
                                >
                                  <FaDownload className="text-xs" />
                                </a>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteReport(report)}
                                  className="inline-flex items-center rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100"
                                  aria-label={`Delete ${report.file_name}`}
                                  title="Delete file"
                                >
                                  <FaTrash className="text-xs" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <label className="space-y-2 text-sm font-medium text-slate-700">
                  <span>Suburb</span>
                  <select value={qrSuburb} onChange={e => setQrSuburb(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-sky-500 focus:outline-none">
                    {DEFAULT_SUBURBS.map(item => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2 text-sm font-medium text-slate-700">
                  <span>Logo image</span>
                  <input type="file" accept="image/*" onChange={e => setQrLogo(e.target.files?.[0] ?? null)} className="block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-sky-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-sky-700" />
                </label>

                <label className="space-y-2 text-sm font-medium text-slate-700">
                  <span>Dot color</span>
                  <input type="color" value={qrDotColor} onChange={e => setQrDotColor(e.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white p-1" />
                </label>

                <label className="space-y-2 text-sm font-medium text-slate-700">
                  <span>Corner color</span>
                  <input type="color" value={qrCornerColor} onChange={e => setQrCornerColor(e.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white p-1" />
                </label>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button type="button" onClick={handleQrGenerate} disabled={qrGenerating || !qrLogo} className="inline-flex items-center rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300">
                  <FaQrcode className="mr-2" />
                  {qrGenerating ? 'Generating...' : 'Generate QR Code'}
                </button>
                <button type="button" onClick={handleQrUpload} disabled={!qrGeneratedBlob || qrUploading} className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:text-slate-400">
                  <FaCloudUploadAlt className="mr-2" />
                  {qrUploading ? 'Uploading...' : 'Upload QR'}
                </button>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
              <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                <h3 className="text-lg font-semibold text-slate-900">Preview</h3>
                <div className="mt-4 flex min-h-[360px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6">
                  {qrPreview ? (
                    <Image src={qrPreview} alt={`QR preview for ${qrSuburb}`} width={300} height={300} unoptimized className="max-h-[300px] max-w-full rounded-xl bg-white p-3 shadow-sm" />
                  ) : (
                    <div className="text-center text-slate-500">
                      <FaQrcode className="mx-auto mb-3 text-5xl opacity-30" />
                      <p className="text-sm">Generate a QR code to preview it here.</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                <h3 className="text-lg font-semibold text-slate-900">Uploaded QR codes</h3>
                {qrRecords.length === 0 ? (
                  <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">No QR codes uploaded yet.</div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {qrRecords.map(record => (
                      <div key={record.id} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <div className="flex items-center gap-3">
                          <Image src={record.file_url} alt={record.suburb} width={64} height={64} unoptimized className="h-16 w-16 rounded-xl border border-slate-200 bg-white p-1" />
                          <div>
                            <div className="font-medium text-slate-800">{record.suburb}</div>
                            <div className="text-xs text-slate-500">{record.file_name}</div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <a href={record.file_url} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">View</a>
                          <a href={record.file_url} download={record.file_name} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700">Download</a>
                          <button type="button" onClick={() => handleQrDelete(record)} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-100">Delete</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Upload report files</h2>
                <p className="text-sm text-slate-500">Select the suburb, quarter, and document labels.</p>
              </div>
              <button type="button" onClick={() => setIsModalOpen(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                <FaTimes className="text-lg" />
              </button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <label className="space-y-2 text-sm font-medium text-slate-700">
                <span>Suburb</span>
                <select value={suburb} onChange={e => setSuburb(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-sky-500 focus:outline-none">
                  {DEFAULT_SUBURBS.map(item => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </label>

              <label className="space-y-2 text-sm font-medium text-slate-700">
                <span>Year</span>
                <select value={year} onChange={e => setYear(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-sky-500 focus:outline-none">
                  {YEARS.map(item => (
                    <option key={item} value={String(item)}>{item}</option>
                  ))}
                </select>
              </label>

              <label className="space-y-2 text-sm font-medium text-slate-700">
                <span>Quarter</span>
                <select value={quarter} onChange={e => setQuarter(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-sky-500 focus:outline-none">
                  {QUARTERS.map(item => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5">
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`rounded-2xl border-2 border-dashed p-6 text-center transition ${isDragging ? 'border-sky-400 bg-sky-50' : 'border-slate-300 bg-white'}`}
              >
                <FaFolderOpen className="mx-auto mb-3 text-3xl text-slate-400" />
                <p className="text-sm text-slate-600">Drag and drop PDFs here, or</p>
                <button type="button" onClick={() => fileInputRef.current?.click()} className="mt-3 inline-flex items-center rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white">
                  <FaUpload className="mr-2" />
                  Choose files
                </button>
                <input ref={fileInputRef} type="file" multiple accept="application/pdf" className="hidden" onChange={e => {
                  const files = Array.from(e.target.files || []);
                  if (files.length) handleOpenUploadModal(files);
                }} />
              </div>
            </div>

            {selectedFiles.length > 0 && (
              <div className="mt-5 space-y-3">
                {selectedFiles.map((item, index) => (
                  <div key={`${item.file.name}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-slate-800">{item.file.name}</div>
                        <div className="text-xs text-slate-500">{formatBytes(item.file.size)}</div>
                      </div>
                      <button type="button" onClick={() => removeFile(index)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-700">
                        <FaTimes />
                      </button>
                    </div>
                    <label className="mt-3 block text-xs font-medium uppercase tracking-wide text-slate-500">Document label</label>
                    <select value={item.label} onChange={e => updateFileLabel(index, e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none">
                      {DOC_LABEL_OPTIONS.map(label => (
                        <option key={label} value={label}>{label}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 flex items-center justify-end gap-3">
              <button type="button" onClick={() => setIsModalOpen(false)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">Cancel</button>
              <button type="button" onClick={handleUploadSubmit} disabled={isUploading || !selectedFiles.length} className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300">
                {isUploading ? 'Uploading...' : 'Upload selected files'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

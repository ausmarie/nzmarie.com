'use client';

import React, { useState, useEffect } from 'react';
import { FaTimes, FaHistory, FaFilePdf, FaQrcode, FaCalendarAlt, FaUser } from 'react-icons/fa';

interface HistoryLog {
  log_id: string;
  outreach_property_id: string;
  suburb_report_id?: string;
  report_title: string;
  campaign_key: string;
  suburb: string;
  sent_at: string;
  sent_by: string;
  notes?: string;
  pdf_file_url?: string;
  pdf_file_name?: string;
  scan_count: number;
}

interface DispatchHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  propertyId: string | null;
  propertyAddress: string;
}

export default function DispatchHistoryDrawer({
  isOpen,
  onClose,
  propertyId,
  propertyAddress,
}: DispatchHistoryDrawerProps) {
  const [history, setHistory] = useState<HistoryLog[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!isOpen || !propertyId) return;

    const fetchHistory = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/admin/outreach/${propertyId}/history`);
        if (!res.ok) {
          throw new Error('Failed to load dispatch history');
        }
        const data = await res.json();
        setHistory(data.history || []);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [isOpen, propertyId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-sm">
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl border-l border-slate-100 flex flex-col animate-in slide-in-from-right duration-300">
          <div className="px-6 py-5 bg-slate-900 text-white flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400">
                <FaHistory className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-semibold">Dispatch History</h3>
                <p className="text-xs text-slate-400 truncate max-w-[220px]">{propertyAddress}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
            >
              <FaTimes className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-24 bg-slate-100 rounded-2xl animate-pulse" />
                ))}
              </div>
            ) : error ? (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-600 font-medium">
                {error}
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-3">
                  <FaHistory className="w-5 h-5" />
                </div>
                <p className="text-sm font-medium text-slate-700">No dispatch history yet</p>
                <p className="text-xs text-slate-400 mt-1">This property has not been marked for report dispatches.</p>
              </div>
            ) : (
              <div className="relative pl-6 border-l-2 border-slate-100 space-y-6">
                {history.map((log) => (
                  <div key={log.log_id} className="relative group">
                    <div className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full bg-blue-600 ring-4 ring-white border-2 border-blue-600" />
                    
                    <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 transition-all hover:shadow-md hover:border-slate-300">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="inline-block px-2.5 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-semibold tracking-wider rounded-md uppercase mb-1.5">
                            {log.campaign_key}
                          </span>
                          <h4 className="text-sm font-bold text-slate-900">{log.report_title}</h4>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-500">
                        <div className="flex items-center space-x-1.5">
                          <FaCalendarAlt className="w-3 h-3 text-slate-400" />
                          <span>{new Date(log.sent_at).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center space-x-1.5 truncate">
                          <FaUser className="w-3 h-3 text-slate-400" />
                          <span className="truncate">{log.sent_by}</span>
                        </div>
                      </div>

                      {log.pdf_file_url && (
                        <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between">
                          <div className="flex items-center space-x-1.5 text-xs text-slate-600 truncate">
                            <FaFilePdf className="text-rose-500 flex-shrink-0" />
                            <span className="truncate">{log.pdf_file_name || 'Report PDF'}</span>
                          </div>
                          <a
                            href={log.pdf_file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 transition-colors underline"
                          >
                            View PDF
                          </a>
                        </div>
                      )}

                      {log.scan_count > 0 && (
                        <div className="mt-2 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1 flex items-center space-x-1.5">
                          <FaQrcode className="w-3 h-3 text-emerald-600" />
                          <span>Scanned {log.scan_count} times</span>
                        </div>
                      )}

                      {log.notes && (
                        <p className="mt-2 text-xs text-slate-600 italic bg-white p-2 rounded-lg border border-slate-100">
                          &ldquo;{log.notes}&rdquo;
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

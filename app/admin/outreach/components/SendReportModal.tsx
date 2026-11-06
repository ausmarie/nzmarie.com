'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { DateTime } from 'luxon';
import { periodLabel, periodSortValue } from '@/lib/report-period';
import { FaFilePdf, FaPaperPlane, FaTimes, FaCheckCircle } from 'react-icons/fa';

interface PdfReport {
  id: string;
  suburb: string;
  quarter: string;
  year: number;
  doc_label?: string | null;
  file_url: string;
  file_name: string;
  title?: string;
  label?: string;
}

interface ReportSet {
  key: string;
  suburb: string;
  quarter: string;
  year: number;
  label: string;
  mainReportId: string;
  docCount: number;
}

interface SendReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedIds: string[];
  suburb: string;
  streetName?: string;
  streetAddresses?: Array<{ id: string; address: string }>;
  onSuccess: () => void;
  onOptimisticSend?: (ids: string[]) => () => void;
  onConfirmed?: (ids: string[]) => void;
  onFailure?: (message: string, ids: string[]) => void;
}

// Groups individual PDF documents into a single quarterly report set
// (suburb + year + quarter). Each set appears once, e.g. "Torbay 2026 Q2".
function buildReportSets(reports: PdfReport[]): ReportSet[] {
  const grouped = new Map<string, PdfReport[]>();
  for (const r of reports) {
    const key = `${r.suburb}|${r.year}|${r.quarter}`;
    const arr = grouped.get(key) || [];
    arr.push(r);
    grouped.set(key, arr);
  }

  return Array.from(grouped.entries()).map(([key, docs]) => {
    const first = docs[0];
    const main =
      docs.find((d) => (d.doc_label || '').toLowerCase() === 'main report') || first;
    return {
      key,
      suburb: first.suburb,
      quarter: first.quarter,
      year: first.year,
      label: first.label || periodLabel(Number(first.year), first.quarter),
      mainReportId: main.id,
      docCount: docs.length,
    };
  }).sort((a, b) => periodSortValue(b.label) - periodSortValue(a.label) || a.suburb.localeCompare(b.suburb));
}

export default function SendReportModal({
  isOpen,
  onClose,
  selectedIds,
  suburb,
  streetName,
  streetAddresses = [],
  onSuccess,
  onOptimisticSend,
  onConfirmed,
  onFailure,
}: SendReportModalProps) {
  const [reports, setReports] = useState<PdfReport[]>([]);
  const [selectedSetKey, setSelectedSetKey] = useState<string>('');
  const [selectedReportId, setSelectedReportId] = useState<string>('');
  const [customTitle, setCustomTitle] = useState<string>('');
  const [campaignKey, setCampaignKey] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [fetchingReports, setFetchingReports] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [selectedAddressIds, setSelectedAddressIds] = useState<string[]>(selectedIds);
  const submissionSequenceRef = useRef(0);
  const canSelectStreetAddresses = Boolean(streetName);
  const targetIds = canSelectStreetAddresses ? selectedAddressIds : selectedIds;

  const reportSets = useMemo(() => buildReportSets(reports), [reports]);

  useEffect(() => {
    if (!isOpen) return;
    submissionSequenceRef.current += 1;
    setLoading(false);
    setError('');
    setSelectedAddressIds(selectedIds);
  }, [isOpen, selectedIds]);

  useEffect(() => {
    if (!isOpen) return;

    const fetchReports = async () => {
      setFetchingReports(true);
      setError('');
      setReports([]);
      setSelectedSetKey('');
      setSelectedReportId('');
      setCustomTitle('');
      setCampaignKey('');
      try {
        const querySuburb = suburb && suburb !== 'all-suburbs' ? suburb : '';
        const url = `/api/admin/pdf/reports?status=active${querySuburb ? `&suburb=${encodeURIComponent(querySuburb)}` : ''}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setReports(data.reports || []);
          if ((data.reports || []).length === 0) {
            const now = DateTime.now().setZone('Pacific/Auckland');
            const year = now.year;
            const quarter = `Q${Math.ceil(now.month / 3)}`;
            setCustomTitle(`${suburb || 'Suburbs'} ${year} ${quarter} Market Report`);
            setCampaignKey(`${year}_${quarter}_${suburb || 'General'}`);
          }
        }
      } catch (err) {
        console.error('Error fetching PDF reports:', err);
      } finally {
        setFetchingReports(false);
      }
    };

    fetchReports();
  }, [isOpen, suburb]);

  // Auto-select the first (or previously selected) report set and fill the
  // dispatch details from it. Idempotent: identical state values are no-ops.
  useEffect(() => {
    if (reportSets.length === 0) return;
    const target = reportSets.find((s) => s.key === selectedSetKey) || reportSets[0];
    if (target.key !== selectedSetKey) {
      setSelectedSetKey(target.key);
    }
    setSelectedReportId(target.mainReportId);
    setCustomTitle(`${target.suburb} ${target.label} Market Report`);
    setCampaignKey(`${target.year}_${target.quarter}_${target.suburb}`);
  }, [reportSets, selectedSetKey]);

  if (!isOpen) return null;

  const handleSetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedSetKey(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (targetIds.length === 0) return;

    const submissionId = ++submissionSequenceRef.current;
    setLoading(true);
    setError('');

    const rollback = onOptimisticSend?.(targetIds);
    onSuccess();
    onClose();

    try {
      const res = await fetch('/api/admin/outreach/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_ids: targetIds,
          suburb_report_id: selectedReportId || undefined,
          report_title: customTitle,
          campaign_key: campaignKey,
          notes,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to record send log');
      }
      onConfirmed?.(targetIds);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      rollback?.();
      onFailure?.(message, targetIds);
      if (submissionSequenceRef.current === submissionId) setError(message);
    } finally {
      if (submissionSequenceRef.current === submissionId) setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center overflow-y-auto bg-slate-900/60 backdrop-blur-sm p-4">
      <div
        data-testid="send-report-modal"
        className="flex max-h-[calc(100dvh-2rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200"
      >
        <div className="flex flex-shrink-0 items-center justify-between bg-slate-900 px-6 py-5 text-white">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/30 flex items-center justify-center text-blue-400">
              <FaPaperPlane className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold">
                {streetName ? 'Send Market Report for this Street' : 'Send Market Report'}
              </h3>
              <p className="text-xs text-slate-400">Selected {targetIds.length} target addresses</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
          >
            <FaTimes className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div data-testid="send-report-modal-scroll" className="min-h-0 flex-1 overflow-y-auto px-6 pt-6 pb-4">
            <div className="space-y-4">
            {streetName && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 tracking-wider mb-1.5">
                Street
              </label>
              <input
                type="text"
                value={streetName}
                readOnly
                aria-label="Street"
                className="w-full h-10 px-3 text-sm bg-slate-100 border border-slate-200 rounded-xl text-slate-700"
              />
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 tracking-wider">Addresses to Send</span>
                <button
                  type="button"
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                  onClick={() => setSelectedAddressIds(
                    selectedAddressIds.length === streetAddresses.length
                      ? []
                      : streetAddresses.map((item) => item.id)
                  )}
                >
                  {selectedAddressIds.length === streetAddresses.length ? 'Clear all' : 'Select all'}
                </button>
              </div>
              <div className="mt-2 max-h-36 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
                {streetAddresses.map((item) => (
                  <label key={item.id} className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedAddressIds.includes(item.id)}
                      onChange={(event) => setSelectedAddressIds((current) =>
                        event.target.checked
                          ? [...current, item.id]
                          : current.filter((id) => id !== item.id)
                      )}
                    />
                    <span>{item.address}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-600 font-medium">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 tracking-wider mb-1.5">
              Select Report Set (from PDF Manager)
            </label>
            {fetchingReports ? (
              <div className="h-10 bg-slate-100 rounded-xl animate-pulse" />
            ) : reportSets.length > 0 ? (
              <>
                <select
                  value={selectedSetKey}
                  onChange={handleSetChange}
                  className="w-full h-10 px-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800"
                >
                  {reportSets.map((set) => (
                    <option key={set.key} value={set.key}>
                      {set.suburb} {set.label}
                      {set.docCount > 1 ? ` (${set.docCount} documents)` : ''}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-xs text-slate-400">
                  One report set per suburb — documents are grouped into a single set.
                </p>
              </>
            ) : (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center space-x-2">
                <FaFilePdf className="text-amber-600 flex-shrink-0" />
                <span>No PDF report found for {suburb || 'this suburb'} in PDF Manager. Enter custom details below.</span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 tracking-wider mb-1.5">
              Report Title
            </label>
            <input
              type="text"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              required
              className="w-full h-10 px-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 tracking-wider mb-1.5">
              Campaign Identifier
            </label>
            <input
              type="text"
              value={campaignKey}
              onChange={(e) => setCampaignKey(e.target.value)}
              required
              className="w-full h-10 px-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 tracking-wider mb-1.5">
              Dispatch Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="e.g. Printed 50 flyers for street distribution"
              className="w-full p-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 resize-none"
            />
          </div>
            </div>
          </div>
          <div className="flex flex-shrink-0 items-center justify-end space-x-3 border-t border-slate-100 bg-white px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || targetIds.length === 0}
              className="px-5 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl shadow-lg shadow-blue-600/20 transition-all flex items-center space-x-2 disabled:opacity-50"
            >
              {loading ? (
                <span>Recording...</span>
              ) : (
                <>
                  <FaCheckCircle className="w-3.5 h-3.5" />
                  <span>Confirm Dispatch Log</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

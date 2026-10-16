'use client';

import { useState, useEffect } from 'react';
import type { ReportSuburb } from '@/types/report';

interface TemplateSelectorProps {
  onGenerate: (suburbId: string, reportQuarter: string, startQuarter: string, endQuarter: string, reportYear: number, reportMonth: number) => Promise<string | undefined>;
  open: boolean;
  onClose: () => void;
  preselectedSuburbId?: string | null;
  preselectedQuarter?: string;
}

const REPORT_QUARTERS = ['2025-Q1', '2025-Q2', '2025-Q3', '2025-Q4', '2026-Q1', '2026-Q2', '2026-Q3', '2026-Q4', '2027-Q1', '2027-Q2', '2027-Q3', '2027-Q4'];

const CURRENT_YEAR = new Date().getFullYear();
const CURRENT_MONTH = new Date().getMonth() + 1;

function monthToQuarter(year: number, month: number): string {
  return `${year}-Q${Math.ceil(month / 3)}`;
}
const REPORT_YEARS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1];
const REPORT_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function buildDataQuarters(): string[] {
  const result: string[] = [];
  for (let y = 2023; y <= 2027; y++) {
    for (let q = 1; q <= 4; q++) {
      result.push(`${y}-Q${q}`);
    }
  }
  return result;
}

const DATA_QUARTERS = buildDataQuarters();

const fieldStyles = 'w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm';

export default function TemplateSelector({ onGenerate, open, onClose, preselectedSuburbId }: TemplateSelectorProps) {
  const [suburbs, setSuburbs] = useState<ReportSuburb[]>([]);
  const [selectedSuburb, setSelectedSuburb] = useState(preselectedSuburbId || '');
  const [reportQuarter, setReportQuarter] = useState(monthToQuarter(CURRENT_YEAR, CURRENT_MONTH));
  const [startQuarter, setStartQuarter] = useState('2025-Q1');
  const [endQuarter, setEndQuarter] = useState(monthToQuarter(CURRENT_YEAR, CURRENT_MONTH));
  const [reportYear, setReportYear] = useState(CURRENT_YEAR);
  const [reportMonth, setReportMonth] = useState(CURRENT_MONTH);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (open) {
      setSelectedSuburb(preselectedSuburbId || '');
      const q = monthToQuarter(CURRENT_YEAR, CURRENT_MONTH);
      setReportQuarter(q);
      setStartQuarter('2025-Q1');
      setEndQuarter(q);
      setReportYear(CURRENT_YEAR);
      setReportMonth(CURRENT_MONTH);
      fetch('/api/admin/reports/suburbs')
        .then((r) => r.json())
        .then((data) => { if (data.success) setSuburbs(data.suburbs); })
        .catch(() => {});
    }
  }, [open, preselectedSuburbId]);

  const handleGenerate = async () => {
    if (!selectedSuburb || !reportQuarter || !startQuarter || !endQuarter) return;
    if (startQuarter > endQuarter) return;
    setGenerating(true);
    try {
      const id = await onGenerate(selectedSuburb, reportQuarter, startQuarter, endQuarter, reportYear, reportMonth);
      if (id) onClose();
    } finally {
      setGenerating(false);
    }
  };

  if (!open) return null;

  const btnDisabled = !selectedSuburb || !reportQuarter || !startQuarter || !endQuarter || startQuarter > endQuarter || generating;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl p-6 w-[400px] shadow-xl">
        <h2 className="text-lg font-semibold text-slate-800 mb-5">
          Generate Market Report
        </h2>

        <div className="flex flex-col space-y-4">
          <div>
            <label className="block text-sm text-slate-500 mb-1">Suburb</label>
            <select
              value={selectedSuburb}
              onChange={(e) => setSelectedSuburb(e.target.value)}
              className={fieldStyles}
            >
              <option value="">Select suburb...</option>
              {suburbs.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label htmlFor="report-year" className="block text-sm text-slate-500 mb-1">Report Year</label>
              <select
                id="report-year"
                value={reportYear}
                onChange={(e) => {
                  const y = Number(e.target.value);
                  setReportYear(y);
                  const q = monthToQuarter(y, reportMonth);
                  setReportQuarter(q);
                  setEndQuarter(q);
                }}
                className={fieldStyles}
              >
                {REPORT_YEARS.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label htmlFor="report-month" className="block text-sm text-slate-500 mb-1">Report Month</label>
              <select
                id="report-month"
                value={reportMonth}
                onChange={(e) => {
                  const m = Number(e.target.value);
                  setReportMonth(m);
                  const q = monthToQuarter(reportYear, m);
                  setReportQuarter(q);
                  setEndQuarter(q);
                }}
                className={fieldStyles}
              >
                {REPORT_MONTHS.map((name, i) => (
                  <option key={name} value={i + 1}>{name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="report-quarter" className="block text-sm text-slate-500 mb-1">Report Quarter</label>
            <select
              id="report-quarter"
              value={reportQuarter}
              onChange={(e) => {
                const q = e.target.value;
                setReportQuarter(q);
                setEndQuarter(q);
              }}
              className={fieldStyles}
            >
              {REPORT_QUARTERS.map((q) => (
                <option key={q} value={q}>{q}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="data-start-quarter" className="block text-sm text-slate-500 mb-1">Data Start Quarter</label>
            <select
              id="data-start-quarter"
              value={startQuarter}
              onChange={(e) => setStartQuarter(e.target.value)}
              className={fieldStyles}
            >
              {DATA_QUARTERS.map((q) => (
                <option key={q} value={q}>{q}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="data-end-quarter" className="block text-sm text-slate-500 mb-1">Data End Quarter</label>
            <select
              id="data-end-quarter"
              value={endQuarter}
              onChange={(e) => setEndQuarter(e.target.value)}
              className={fieldStyles}
            >
              {DATA_QUARTERS.map((q) => (
                <option key={q} value={q}>{q}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={btnDisabled}
            className={`px-4 py-2 text-sm font-semibold text-white rounded-lg transition-colors ${
              btnDisabled ? 'bg-slate-300 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            {generating ? 'Generating...' : 'Generate'}
          </button>
        </div>
      </div>
    </div>
  );
}

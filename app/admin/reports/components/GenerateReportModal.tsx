'use client';

import { useEffect, useState } from 'react';
import { SUBURB_PRIORITY_ORDER } from '@/lib/suburb-order';

interface SuburbOption {
  id: string;
  name: string;
}

export interface GeneratedReportInfo {
  suburbName: string;
  quarter: string;
  periodType: PeriodType;
  reportYear: number;
  reportMonth: number;
}

interface GenerateReportModalProps {
  open: boolean;
  leadId?: string;
  defaultSuburbName?: string;
  defaultAddressName?: string;
  onClose: () => void;
  onGenerated: (docId: string, info: GeneratedReportInfo) => void;
}

type PeriodType = 'quarter' | 'month';

const CURRENT_YEAR = new Date().getFullYear();
const CURRENT_MONTH = new Date().getMonth() + 1;
const REPORT_YEARS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1];
const REPORT_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const SUBURB_ORDER = ['North Shore', ...SUBURB_PRIORITY_ORDER];

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function monthToQuarter(year: number, month: number): string {
  return `${year}-Q${Math.ceil(month / 3)}`;
}

function buildDataQuarters(): string[] {
  const result: string[] = [];
  for (let y = 2023; y <= 2027; y++) {
    for (let q = 1; q <= 4; q++) {
      result.push(`${y}-Q${q}`);
    }
  }
  return result;
}

function buildDataMonths(): string[] {
  const result: string[] = [];
  for (let y = 2023; y <= 2027; y++) {
    for (let m = 1; m <= 12; m++) {
      result.push(`${y}-${pad2(m)}`);
    }
  }
  return result;
}

function monthOptionLabel(ym: string): string {
  const [y, m] = ym.split('-');
  return `${MONTH_ABBR[Number(m) - 1]} ${y}`;
}

const DATA_QUARTERS = buildDataQuarters();
const DATA_MONTHS = buildDataMonths();

function buildReportQuarters(): string[] {
  const result: string[] = [];
  for (const y of REPORT_YEARS) {
    for (let q = 1; q <= 4; q++) {
      result.push(`${y}-Q${q}`);
    }
  }
  return result;
}

const REPORT_QUARTERS = buildReportQuarters();

function buildDefaultReportName(address: string, mode: PeriodType, quarter: string, year: number, month: number): string {
  if (!address) return '';
  if (mode === 'quarter') {
    const [qYear, qNum] = quarter.split('-Q');
    return `Q${qNum} ${qYear} ${address}`;
  }
  return `${pad2(month)} ${year} ${address}`;
}

const fieldStyles = 'w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm';

export default function GenerateReportModal({ open, leadId, defaultSuburbName, defaultAddressName, onClose, onGenerated }: GenerateReportModalProps) {
  const [suburbList, setSuburbList] = useState<SuburbOption[]>([]);
  const [genSuburbId, setGenSuburbId] = useState('');
  const [genSuburbName, setGenSuburbName] = useState('');
  const [genSearch, setGenSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [genYear, setGenYear] = useState(CURRENT_YEAR);
  const [genMonth, setGenMonth] = useState(CURRENT_MONTH);
  const [periodType, setPeriodType] = useState<PeriodType>('quarter');
  const [reportQuarter, setReportQuarter] = useState(monthToQuarter(CURRENT_YEAR, CURRENT_MONTH));
  const [nameInput, setNameInput] = useState('');
  const [nameDirty, setNameDirty] = useState(false);
  const [startQuarter, setStartQuarter] = useState('2025-Q1');
  const [endQuarter, setEndQuarter] = useState(monthToQuarter(CURRENT_YEAR, CURRENT_MONTH));
  const [startMonth, setStartMonth] = useState('2025-01');
  const [endMonth, setEndMonth] = useState(`${CURRENT_YEAR}-${pad2(CURRENT_MONTH)}`);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setGenYear(CURRENT_YEAR);
    setGenMonth(CURRENT_MONTH);
    setPeriodType('quarter');
    setReportQuarter(monthToQuarter(CURRENT_YEAR, CURRENT_MONTH));
    setNameInput('');
    setNameDirty(false);
    setStartQuarter('2025-Q1');
    setEndQuarter(monthToQuarter(CURRENT_YEAR, CURRENT_MONTH));
    setStartMonth('2025-01');
    setEndMonth(`${CURRENT_YEAR}-${pad2(CURRENT_MONTH)}`);
    setGenSuburbName(defaultSuburbName || '');
    setGenSearch('');
    setShowDropdown(false);
    setError(null);
    setLoading(false);
    setGenSuburbId('');
  }, [open, defaultSuburbName]);

  useEffect(() => {
    if (!open) return;
    if (!defaultSuburbName) {
      setGenSuburbId('');
      return;
    }
    const match = suburbList.find((s) => s.name.toLowerCase() === defaultSuburbName.toLowerCase());
    setGenSuburbId(match ? match.id : '');
  }, [open, defaultSuburbName, suburbList]);

  useEffect(() => {
    if (!open || suburbList.length > 0) return;
    fetch('/api/admin/reports/suburbs')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setSuburbList(data.suburbs || []);
      })
      .catch(() => {});
  }, [open, suburbList.length]);

  const selectedSuburb = suburbList.find((s) => s.id === genSuburbId) || null;
  const nameSource = defaultAddressName || selectedSuburb?.name || genSuburbName || '';
  const derivedReportName = buildDefaultReportName(nameSource, periodType, reportQuarter, genYear, genMonth);
  const reportName = nameDirty ? nameInput : derivedReportName;
  const rangeInvalid = periodType === 'quarter' ? startQuarter > endQuarter : startMonth > endMonth;
  const canGenerate = !!genSuburbId && !rangeInvalid && !loading && reportName.trim().length > 0;

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/reports/templates/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suburb_id: genSuburbId,
          report_name: reportName.trim(),
          period_type: periodType,
          ...(periodType === 'quarter'
            ? { quarter: reportQuarter, start_quarter: startQuarter, end_quarter: endQuarter }
            : {
                quarter: monthToQuarter(genYear, genMonth),
                report_year: genYear,
                report_month: genMonth,
                start_month: startMonth,
                end_month: endMonth,
              }),
          ...(leadId ? { lead_id: leadId } : {}),
        }),
      });
      const data = await res.json();
      if (data.success && data.id) {
        onGenerated(data.id, {
          suburbName: selectedSuburb?.name || genSuburbName,
          quarter: periodType === 'quarter' ? reportQuarter : monthToQuarter(genYear, genMonth),
          periodType,
          reportYear: genYear,
          reportMonth: genMonth,
        });
      } else {
        setError(data.error || 'Failed to generate report.');
      }
    } catch {
      setError('Failed to generate report.');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const periodButtonClass = (value: PeriodType) =>
    `flex-1 px-3 py-2 text-sm font-medium transition-colors ${
      periodType === value ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
    }`;

  return (
    <div
      onClick={onClose}
      className="lead-generate-modal fixed inset-0 z-[9999] flex items-center justify-center bg-black/40"
      data-testid="generate-report-modal"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-xl w-[380px] max-w-[90vw] max-h-[90vh] overflow-y-auto shadow-2xl overflow-hidden"
      >
        <div className="p-6 pb-0">
          <h2 className="text-lg font-bold text-slate-900 mb-1">
            Generate Report
          </h2>
          <p className="text-sm text-slate-500 mb-4">
            Select suburb and period to generate a new market report.
          </p>

          <div className="flex flex-col space-y-4">
            <div>
              <label htmlFor="gen-report-name" className="block text-sm text-slate-500 mb-1">Report Name</label>
              <input
                id="gen-report-name"
                data-testid="gen-name-input"
                value={reportName}
                onChange={(e) => { setNameDirty(true); setNameInput(e.target.value); }}
                placeholder="Q4 2026 2/65 Target Road"
                className={fieldStyles}
              />
            </div>

            <div>
              <label className="block text-sm text-slate-500 mb-1">Suburb</label>
              <div className="relative">
                <input
                  data-testid="gen-suburb-input"
                  value={showDropdown ? genSearch : (selectedSuburb?.name || genSuburbName || '')}
                  onChange={(e) => { setGenSearch(e.target.value); setShowDropdown(true); }}
                  onFocus={() => { setGenSearch(''); setShowDropdown(true); }}
                  onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                  placeholder="Search suburb..."
                  className={fieldStyles}
                />
                {showDropdown && (
                  <div className="absolute top-full left-0 right-0 max-h-[200px] overflow-y-auto bg-white border border-slate-200 rounded-lg z-10 shadow-md">
                    {(genSearch
                      ? suburbList.filter((s) => s.name.toLowerCase().includes(genSearch.toLowerCase()))
                      : [
                          ...SUBURB_ORDER.map((name) => suburbList.find((s) => s.name === name)).filter(Boolean) as SuburbOption[],
                          ...suburbList.filter((s) => !SUBURB_ORDER.includes(s.name)),
                        ]
                    ).map((s) => (
                      <div
                        key={s.id}
                        data-testid="gen-suburb-option"
                        onClick={() => {
                          setGenSuburbId(s.id);
                          setGenSuburbName(s.name);
                          setGenSearch('');
                          setShowDropdown(false);
                        }}
                        className={`px-3 py-2 text-sm cursor-pointer ${
                          s.id === genSuburbId ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {s.name}
                      </div>
                    ))}
                    {genSearch && suburbList.filter((s) => s.name.toLowerCase().includes(genSearch.toLowerCase())).length === 0 && (
                      <div className="px-3 py-2 text-sm text-slate-400">
                        No suburbs found
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-500 mb-1">Period</label>
              <div className="flex rounded-lg border border-slate-300 overflow-hidden">
                <button
                  type="button"
                  data-testid="gen-period-quarter"
                  onClick={() => setPeriodType('quarter')}
                  className={periodButtonClass('quarter')}
                >
                  Quarter
                </button>
                <button
                  type="button"
                  data-testid="gen-period-month"
                  onClick={() => setPeriodType('month')}
                  className={periodButtonClass('month')}
                >
                  Month
                </button>
              </div>
            </div>

            {periodType === 'quarter' ? (
              <div>
                <label htmlFor="gen-report-quarter" className="block text-sm text-slate-500 mb-1">Report Quarter</label>
                <select
                  id="gen-report-quarter"
                  data-testid="gen-report-quarter"
                  value={reportQuarter}
                  onChange={(e) => {
                    setReportQuarter(e.target.value);
                    setEndQuarter(e.target.value);
                  }}
                  className={fieldStyles}
                >
                  {REPORT_QUARTERS.map((q) => (
                    <option key={q} value={q}>{q}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="flex gap-3">
                <div className="flex-1">
                  <label htmlFor="gen-report-year" className="block text-sm text-slate-500 mb-1">Report Year</label>
                  <select
                    id="gen-report-year"
                    data-testid="gen-year"
                    value={genYear}
                    onChange={(e) => {
                      const y = Number(e.target.value);
                      setGenYear(y);
                      setEndMonth(`${y}-${pad2(genMonth)}`);
                    }}
                    className={fieldStyles}
                  >
                    {REPORT_YEARS.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label htmlFor="gen-report-month" className="block text-sm text-slate-500 mb-1">Report Month</label>
                  <select
                    id="gen-report-month"
                    data-testid="gen-month"
                    value={genMonth}
                    onChange={(e) => {
                      const m = Number(e.target.value);
                      setGenMonth(m);
                      setEndMonth(`${genYear}-${pad2(m)}`);
                    }}
                    className={fieldStyles}
                  >
                    {REPORT_MONTHS.map((name, i) => (
                      <option key={name} value={i + 1}>{name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {periodType === 'quarter' ? (
              <>
                <div>
                  <label htmlFor="gen-data-start-quarter" className="block text-sm text-slate-500 mb-1">Data Start Quarter</label>
                  <select
                    id="gen-data-start-quarter"
                    data-testid="gen-start-quarter"
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
                  <label htmlFor="gen-data-end-quarter" className="block text-sm text-slate-500 mb-1">Data End Quarter</label>
                  <select
                    id="gen-data-end-quarter"
                    data-testid="gen-end-quarter"
                    value={endQuarter}
                    onChange={(e) => setEndQuarter(e.target.value)}
                    className={fieldStyles}
                  >
                    {DATA_QUARTERS.map((q) => (
                      <option key={q} value={q}>{q}</option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label htmlFor="gen-data-start-month" className="block text-sm text-slate-500 mb-1">Data Start Month</label>
                  <select
                    id="gen-data-start-month"
                    data-testid="gen-start-month"
                    value={startMonth}
                    onChange={(e) => setStartMonth(e.target.value)}
                    className={fieldStyles}
                  >
                    {DATA_MONTHS.map((m) => (
                      <option key={m} value={m}>{monthOptionLabel(m)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="gen-data-end-month" className="block text-sm text-slate-500 mb-1">Data End Month</label>
                  <select
                    id="gen-data-end-month"
                    data-testid="gen-end-month"
                    value={endMonth}
                    onChange={(e) => setEndMonth(e.target.value)}
                    className={fieldStyles}
                  >
                    {DATA_MONTHS.map((m) => (
                      <option key={m} value={m}>{monthOptionLabel(m)}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {rangeInvalid && (
              <p className="text-sm text-red-600" data-testid="gen-range-error">
                Start must not be after end.
              </p>
            )}
            {error && (
              <p className="text-sm text-red-600" data-testid="gen-error">
                {error}
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 p-6">
          <button
            data-testid="gen-cancel-btn"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            data-testid="gen-generate-btn"
            onClick={handleGenerate}
            disabled={!canGenerate}
            className={`px-4 py-2 text-sm font-semibold text-white rounded-lg transition-colors ${
              canGenerate ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-emerald-300 cursor-not-allowed'
            }`}
          >
            {loading ? 'Generating...' : 'Generate'}
          </button>
        </div>
      </div>
    </div>
  );
}

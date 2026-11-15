'use client';

import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { isMarketReportLanguage, type MarketReportLanguage, type MarketReportPeriodType } from '@/lib/market-report-data';

interface MarketGenerateReportModalProps {
  open: boolean;
  latestAvailableMonth: string | null;
  existingReports: Array<{
    period_type: MarketReportPeriodType;
    period_key: string;
    language?: MarketReportLanguage;
  }>;
  onClose: () => void;
  onGenerated: (id: string, reused: boolean) => Promise<void>;
}

interface GenerateReportInput {
  title: string;
  language: MarketReportLanguage;
  periodType: MarketReportPeriodType;
  periodKey: string;
  chartPeriodType: MarketReportPeriodType;
  dataStartKey: string;
  dataEndKey: string;
}

const fieldClass = 'w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm transition-all focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20';
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const PERIOD_YEARS = ['2025', '2026', '2027', '2028', '2029'];

function indexForPeriod(type: MarketReportPeriodType, key: string): number {
  if (type === 'monthly') {
    const [year, month] = key.split('-').map(Number);
    return year * 12 + month - 1;
  }
  const [year, quarter] = key.split('-Q').map(Number);
  return year * 4 + quarter - 1;
}

function periodYear(key: string): string {
  return key.slice(0, 4);
}

function periodPart(type: MarketReportPeriodType, key: string): string {
  if (type === 'quarterly') return key.slice(-2);
  const month = key.slice(5, 7);
  return month ? String(Number(month)) : '';
}

function makePeriodKey(type: MarketReportPeriodType, year: string, part: string): string {
  return type === 'monthly'
    ? `${year}-${String(Number(part)).padStart(2, '0')}`
    : `${year}-${part}`;
}

function getLatestKey(type: MarketReportPeriodType, latestMonth: string): string {
  if (type === 'monthly') return latestMonth;
  const [year, month] = latestMonth.split('-').map(Number);
  return `${year}-Q${Math.ceil(month / 3)}`;
}

function getInitialPeriodKey(type: MarketReportPeriodType, latestMonth: string): string {
  const latestKey = getLatestKey(type, latestMonth);
  const earliestKey = type === 'monthly' ? '2025-01' : '2025-Q1';
  const latestSelectableKey = type === 'monthly' ? '2029-12' : '2029-Q4';
  const index = indexForPeriod(type, latestKey);
  if (index < indexForPeriod(type, earliestKey)) return earliestKey;
  if (index > indexForPeriod(type, latestSelectableKey)) return latestSelectableKey;
  return latestKey;
}

function getChartAnchorKey(
  reportType: MarketReportPeriodType,
  reportKey: string,
  chartType: MarketReportPeriodType,
): string {
  if (reportType === chartType) return reportKey;
  if (chartType === 'quarterly') {
    const [year, month] = reportKey.split('-').map(Number);
    return `${year}-Q${Math.ceil(month / 3)}`;
  }
  const [year, quarter] = reportKey.split('-Q').map(Number);
  return `${year}-${String(quarter * 3).padStart(2, '0')}`;
}

function getPeriodParts(type: MarketReportPeriodType): Array<{ value: string; label: string }> {
  if (type === 'quarterly') {
    return [1, 2, 3, 4].map((quarter) => ({ value: `Q${quarter}`, label: `Q${quarter}` }));
  }
  return MONTH_NAMES.map((month, index) => ({ value: String(index + 1), label: month }));
}

function formatPeriod(type: MarketReportPeriodType, key: string): string {
  if (type === 'quarterly') return key;
  const [year, month] = key.split('-').map(Number);
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

function defaultStart(type: MarketReportPeriodType, key: string): string {
  const earliestKey = type === 'monthly' ? '2025-01' : '2025-Q1';
  return indexForPeriod(type, key) < indexForPeriod(type, earliestKey) ? key : earliestKey;
}

function reportTitle(type: MarketReportPeriodType, key: string, language: MarketReportLanguage): string {
  if (language === 'zh') {
    const period = type === 'monthly'
      ? `${key.slice(0, 4)}年${Number(key.slice(5, 7))}月`
      : `${key.slice(0, 4)}年第${key.slice(-1)}季度`;
    return `北岸房地产市场报告 — ${period}`;
  }
  if (type === 'monthly') return `North Shore Property Market Report — ${formatPeriod(type, key)}`;
  const [year, quarter] = key.split('-Q');
  return `North Shore Property Market Report — Q${quarter} ${year}`;
}

function PeriodKeySelector({
  type,
  value,
  labelPrefix,
  testIdPrefix,
  onChange,
}: {
  type: MarketReportPeriodType;
  value: string;
  labelPrefix: string;
  testIdPrefix: string;
  onChange: (key: string) => void;
}) {
  const year = periodYear(value) || PERIOD_YEARS[0];
  const part = periodPart(type, value) || getPeriodParts(type)[0].value;
  const partLabel = type === 'quarterly' ? 'Quarter' : 'Month';
  return (
    <div className="flex gap-3">
      <div className="flex-1">
        <label htmlFor={`${testIdPrefix}-year`} className="mb-1 block text-sm text-slate-500">{labelPrefix} Year</label>
        <select
          id={`${testIdPrefix}-year`}
          data-testid={`${testIdPrefix}-year`}
          value={year}
          onChange={(event) => onChange(makePeriodKey(type, event.target.value, part))}
          className={fieldClass}
        >
          {PERIOD_YEARS.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </div>
      <div className="flex-1">
        <label htmlFor={`${testIdPrefix}-part`} className="mb-1 block text-sm text-slate-500">{labelPrefix} {partLabel}</label>
        <select
          id={`${testIdPrefix}-part`}
          data-testid={`${testIdPrefix}-part`}
          value={part}
          onChange={(event) => onChange(makePeriodKey(type, year, event.target.value))}
          className={fieldClass}
        >
          {getPeriodParts(type).map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

export default function MarketGenerateReportModal({
  open,
  latestAvailableMonth,
  existingReports,
  onClose,
  onGenerated,
}: MarketGenerateReportModalProps) {
  const [mounted, setMounted] = useState(false);
  const [periodType, setPeriodType] = useState<MarketReportPeriodType>('quarterly');
  const [language, setLanguage] = useState<MarketReportLanguage>('en');
  const [periodKey, setPeriodKey] = useState('');
  const [chartPeriodType, setChartPeriodType] = useState<MarketReportPeriodType>('quarterly');
  const [dataStartKey, setDataStartKey] = useState('');
  const [dataEndKey, setDataEndKey] = useState('');
  const [title, setTitle] = useState('');
  const [titleDirty, setTitleDirty] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rangeInvalid = Boolean(
    periodKey && dataStartKey && dataEndKey &&
    indexForPeriod(chartPeriodType, dataStartKey) > indexForPeriod(chartPeriodType, dataEndKey),
  );
  const existingReport = existingReports.some(
    (report) => report.period_type === periodType
      && report.period_key === periodKey
      && (report.language ?? 'en') === language,
  );

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open || !latestAvailableMonth) return;
    const nextType: MarketReportPeriodType = 'quarterly';
    const nextKey = getInitialPeriodKey(nextType, latestAvailableMonth);
    const nextChartType: MarketReportPeriodType = 'quarterly';
    const nextChartKey = getChartAnchorKey(nextType, nextKey, nextChartType);
    setPeriodType(nextType);
    setLanguage('en');
    setPeriodKey(nextKey);
    setChartPeriodType(nextChartType);
    setDataStartKey(defaultStart(nextChartType, nextChartKey));
    setDataEndKey(nextChartKey);
    setTitle(reportTitle(nextType, nextKey, 'en'));
    setTitleDirty(false);
    setError(null);
    setLoading(false);
  }, [open, latestAvailableMonth]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, loading, onClose]);

  if (!open || !mounted) return null;

  const updatePeriod = (type: MarketReportPeriodType, key: string) => {
    const chartKey = getChartAnchorKey(type, key, chartPeriodType);
    setPeriodType(type);
    setPeriodKey(key);
    setDataStartKey(defaultStart(chartPeriodType, chartKey));
    setDataEndKey(chartKey);
    if (!titleDirty) setTitle(reportTitle(type, key, language));
    setError(null);
  };

  const updateLanguage = (nextLanguage: MarketReportLanguage) => {
    setLanguage(nextLanguage);
    if (!titleDirty) setTitle(reportTitle(periodType, periodKey, nextLanguage));
    setError(null);
  };

  const updateChartPeriod = (type: MarketReportPeriodType) => {
    const chartKey = getChartAnchorKey(periodType, periodKey, type);
    setChartPeriodType(type);
    setDataStartKey(defaultStart(type, chartKey));
    setDataEndKey(chartKey);
    setError(null);
  };

  const handleGenerate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim() || !periodKey || rangeInvalid || !dataStartKey || !dataEndKey || loading) return;

    setLoading(true);
    setError(null);
    try {
      const input: GenerateReportInput = {
        title: title.trim(),
        language,
        periodType,
        periodKey,
        chartPeriodType,
        dataStartKey,
        dataEndKey,
      };
      const response = await fetch('/api/admin/market-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const data = await response.json();
      if (!response.ok || !data.success || !data.id) {
        throw new Error(data.error || 'Failed to generate report.');
      }
      await onGenerated(data.id, data.reused === true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to generate report.');
    } finally {
      setLoading(false);
    }
  };

  const periodButtonClass = (selected: MarketReportPeriodType, value: MarketReportPeriodType) =>
    `flex-1 px-3 py-2 text-sm font-medium transition-colors ${
      selected === value ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
    }`;

  return createPortal(
    <div
      role="presentation"
      onClick={onClose}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-2"
      data-testid="market-generate-report-modal"
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="market-generate-report-title"
        onSubmit={handleGenerate}
        onClick={(event) => event.stopPropagation()}
        className="max-h-[90vh] w-[480px] max-w-[96vw] overflow-y-auto rounded-xl bg-white shadow-2xl"
      >
        <div className="p-6 pb-0">
          <h2 id="market-generate-report-title" className="mb-1 text-lg font-bold text-slate-900">
            Generate Report
          </h2>
          <p className="mb-4 text-sm text-slate-500">
            Select a report period and data range for a new North Shore market report.
          </p>

          <div className="flex flex-col space-y-4">
            <div>
              <label htmlFor="market-report-language" className="mb-1 block text-sm text-slate-500">Language</label>
              <select
                id="market-report-language"
                data-testid="market-report-language"
                value={language}
                onChange={(event) => {
                  if (isMarketReportLanguage(event.target.value)) updateLanguage(event.target.value);
                }}
                className={fieldClass}
              >
                <option value="en">English</option>
                <option value="zh">中文</option>
              </select>
            </div>
            <div>
              <label htmlFor="market-report-name" className="mb-1 block text-sm text-slate-500">Report Name</label>
              <input
                id="market-report-name"
                data-testid="market-report-name"
                required
                maxLength={160}
                value={title}
                onChange={(event) => { setTitle(event.target.value); setTitleDirty(true); }}
                className={fieldClass}
              />
            </div>

            <div>
              <label htmlFor="market-report-suburb" className="mb-1 block text-sm text-slate-500">Suburb</label>
              <input
                id="market-report-suburb"
                value="North Shore"
                readOnly
                className={`${fieldClass} bg-slate-50 text-slate-600`}
              />
            </div>

            <div>
              <span className="mb-1 block text-sm text-slate-500">Period</span>
              <div className="flex overflow-hidden rounded-lg border border-slate-300">
                <button
                  type="button"
                  data-testid="market-period-quarter"
                  onClick={() => latestAvailableMonth && updatePeriod('quarterly', getLatestKey('quarterly', latestAvailableMonth))}
                  className={periodButtonClass(periodType, 'quarterly')}
                >
                  Quarter
                </button>
                <button
                  type="button"
                  data-testid="market-period-month"
                  onClick={() => latestAvailableMonth && updatePeriod('monthly', latestAvailableMonth)}
                  className={periodButtonClass(periodType, 'monthly')}
                >
                  Month
                </button>
              </div>
            </div>

            <PeriodKeySelector
              type={periodType}
              value={periodKey}
              labelPrefix="Report"
              testIdPrefix="market-report"
              onChange={(key) => updatePeriod(periodType, key)}
            />

            <div>
              <span className="mb-1 block text-sm text-slate-500">Line chart period</span>
              <div className="flex overflow-hidden rounded-lg border border-slate-300">
                <button
                  type="button"
                  data-testid="market-chart-period-quarter"
                  onClick={() => updateChartPeriod('quarterly')}
                  className={periodButtonClass(chartPeriodType, 'quarterly')}
                >
                  Quarter
                </button>
                <button
                  type="button"
                  data-testid="market-chart-period-month"
                  onClick={() => updateChartPeriod('monthly')}
                  className={periodButtonClass(chartPeriodType, 'monthly')}
                >
                  Month
                </button>
              </div>
            </div>

            <PeriodKeySelector
              type={chartPeriodType}
              value={dataStartKey}
              labelPrefix="Line chart data start"
              testIdPrefix="market-data-start"
              onChange={setDataStartKey}
            />

            <PeriodKeySelector
              type={chartPeriodType}
              value={dataEndKey}
              labelPrefix="Line chart data end"
              testIdPrefix="market-data-end"
              onChange={setDataEndKey}
            />

            {rangeInvalid && <p className="text-sm text-red-600" role="alert">Line chart data start must not be after its end.</p>}
            {existingReport && (
              <p className="text-sm text-blue-700" role="status">
                A report already exists for this period. Analytics will be refreshed while saved commentary is preserved.
              </p>
            )}
            {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
          </div>
        </div>

        <div className="flex justify-end gap-2 p-6">
          <button type="button" onClick={onClose} disabled={loading} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50">
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !title.trim() || !periodKey || !dataStartKey || !dataEndKey || rangeInvalid}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
          >
            {loading ? (existingReport ? 'Refreshing…' : 'Generating…') : existingReport ? 'Regenerate Report' : 'Generate'}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}

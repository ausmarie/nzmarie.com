'use client';

import React, { useState, useRef } from 'react';

interface UploadResult {
  success: boolean;
  suburb?: string;
  city?: string;
  period_start?: string;
  period_end?: string;
  inserted_count?: number;
  already_existed?: number;
  validation_skipped?: number;
  total_rows?: number;
  message?: string;
  error?: string;
}

interface Props {
  onSuccess?: (suburb: string) => void;
}

export default function ExcelUploadForm({ onSuccess }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const logRef = useRef<HTMLPreElement>(null);

  const addLog = (line: string) => {
    setLogs(prev => [...prev, line]);
    setTimeout(() => logRef.current?.scrollTo(0, logRef.current.scrollHeight), 50);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    setResult(null);
    setLogs([]);
    addLog(`Uploading ${file.name}...`);

    try {
      const formData = new FormData();
      formData.append('file', file);

      addLog('Sending to server...');
      const res = await fetch('/api/admin/analytics/upload-excel', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      addLog(data.success ? 'Upload complete.' : 'Upload failed.');
      setResult(data);
      if (data.success && onSuccess) {
        setTimeout(() => onSuccess(data.suburb || ''), 300);
      }
    } catch {
      setResult({ success: false, error: 'Network error' });
      addLog('Network error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Upload REINZ Market Data</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            REINZ Excel/CSV File
          </label>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            required
          />
        </div>

        <button
          type="submit"
          disabled={!file || uploading}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? 'Uploading...' : 'Upload & Parse'}
        </button>
      </form>

      {/* Live progress log */}
      {logs.length > 0 && (
        <pre
          ref={logRef}
          className="mt-4 p-3 bg-gray-900 text-green-400 text-xs rounded-lg max-h-32 overflow-y-auto font-mono"
        >
          {logs.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </pre>
      )}

      {result && (
        <div className={`mt-4 p-4 rounded-lg text-sm ${
          result.success ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {result.success ? (
            <div>
              <p className="font-semibold">{result.message}</p>
              <ul className="mt-2 space-y-1">
                <li>Newly inserted: {result.inserted_count}</li>
                <li>Already in DB: {result.already_existed ?? 0}</li>
                <li>Invalid rows skipped: {result.validation_skipped ?? 0}</li>
                <li>Total rows: {result.total_rows}</li>
                <li>Suburb: {result.suburb}</li>
                <li>Period: {result.period_start} to {result.period_end}</li>
              </ul>
            </div>
          ) : (
            <p>Error: {result.error}</p>
          )}
        </div>
      )}
    </div>
  );
}

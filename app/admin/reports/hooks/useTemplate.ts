'use client';

import { useState, useCallback } from 'react';
import type { ReportSuburb } from '@/types/report';

export function useTemplate() {
  const [generating, setGenerating] = useState(false);

  const generateReport = useCallback(async (suburbId: string, reportQuarter: string, startQuarter?: string, endQuarter?: string, reportYear?: number, reportMonth?: number) => {
    setGenerating(true);
    try {
      const body: Record<string, string> = { suburb_id: suburbId, quarter: reportQuarter };
      if (startQuarter) body.start_quarter = startQuarter;
      if (endQuarter) body.end_quarter = endQuarter;
      if (reportYear) body.report_year = String(reportYear);
      if (reportMonth) body.report_month = String(reportMonth);
      const res = await fetch('/api/admin/reports/templates/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      return result.id as string;
    } finally {
      setGenerating(false);
    }
  }, []);

  const fetchSuburbs = useCallback(async (): Promise<ReportSuburb[]> => {
    const res = await fetch('/api/admin/reports/suburbs');
    const result = await res.json();
    if (!result.success) throw new Error(result.error);
    return result.suburbs;
  }, []);

  return { generateReport, fetchSuburbs, generating };
}

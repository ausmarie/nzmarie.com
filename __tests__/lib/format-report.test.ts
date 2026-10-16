import { describe, it, expect } from 'vitest';
import { formatReportKey } from '@/lib/format-report';

describe('formatReportKey', () => {
  it('formats 2026_Q2_Torbay to Torbay-Q2-2026', () => {
    expect(formatReportKey('2026_Q2_Torbay', 'Torbay')).toBe('Torbay-Q2-2026');
  });

  it('formats 2026_Q3_Torbay to Torbay-Q3-2026', () => {
    expect(formatReportKey('2026_Q3_Torbay', 'Torbay')).toBe('Torbay-Q3-2026');
  });

  it('formats 2026_Q1_Oteha to Oteha-Q1-2026', () => {
    expect(formatReportKey('2026_Q1_Oteha', 'Oteha')).toBe('Oteha-Q1-2026');
  });

  it('formats multi-word suburb 2026_Q2_Fairview_Heights', () => {
    expect(formatReportKey('2026_Q2_Fairview_Heights', 'Fairview Heights')).toBe('Fairview Heights-Q2-2026');
  });

  it('handles campaign without suburb name when suburb is passed', () => {
    expect(formatReportKey('2026_Q2', 'Torbay')).toBe('Torbay-Q2-2026');
    expect(formatReportKey('2026_Q2_Report', 'Torbay')).toBe('Torbay-Q2-2026');
  });

  it('handles Torbay-Q2-2026 directly', () => {
    expect(formatReportKey('Torbay-Q2-2026', 'Torbay')).toBe('Torbay-Q2-2026');
  });
});

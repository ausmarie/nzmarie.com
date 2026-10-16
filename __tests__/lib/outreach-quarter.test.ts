import { describe, it, expect } from 'vitest';
import { parseReportQuarter } from '@/lib/outreach-quarter';

describe('parseReportQuarter', () => {
  it('parses a valid quarter into regex campaign pattern', () => {
    expect(parseReportQuarter('2026-Q3')).toEqual({
      quarter: 'Q3',
      year: 2026,
      key: '2026-Q3',
      campaignPattern: '^2026[_-]Q3',
    });
  });

  it('uppercases lowercase quarter input', () => {
    expect(parseReportQuarter('2025-q1')?.quarter).toBe('Q1');
    expect(parseReportQuarter('2025-q1')?.campaignPattern).toBe('^2025[_-]Q1');
  });

  it('returns null for empty, malformed, or invalid quarter values', () => {
    expect(parseReportQuarter(null)).toBeNull();
    expect(parseReportQuarter(undefined)).toBeNull();
    expect(parseReportQuarter('')).toBeNull();
    expect(parseReportQuarter('bad-quarter')).toBeNull();
    expect(parseReportQuarter('2026-Q5')).toBeNull();
    expect(parseReportQuarter('2026Q3')).toBeNull();
    expect(parseReportQuarter('26-Q3')).toBeNull();
  });

  it('matches real campaign key formats with the generated pattern', () => {
    const qi = parseReportQuarter('2026-Q2')!;
    const re = new RegExp(qi.campaignPattern);
    expect(re.test('2026_Q2_Oteha')).toBe(true);
    expect(re.test('2026-Q2')).toBe(true);
    expect(re.test('2026_Q3_Oteha')).toBe(false);
    expect(re.test('2025_Q2_Oteha')).toBe(false);
  });
});

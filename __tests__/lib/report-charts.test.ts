import { describe, it, expect } from 'vitest';
import { generateSVG } from '@/lib/report-charts';

const subData = [
  { quarter: '2025-Q1', median: 1200000 },
  { quarter: '2025-Q2', median: 1250000 },
  { quarter: '2025-Q3', median: 1220000 },
];

const distData = [
  { quarter: '2025-Q1', median: 1300000 },
  { quarter: '2025-Q2', median: 1320000 },
  { quarter: '2025-Q3', median: 1310000 },
];

describe('report-charts generateSVG labels', () => {
  it('labels the district benchmark as North Shore in a suburb report', () => {
    const svg = generateSVG('Torbay', subData, distData);

    expect(svg).toContain('Torbay vs North Shore — Median Price');
    expect(svg).toContain('>Torbay</text>');
    expect(svg).toContain('>North Shore</text>');
    expect(svg).not.toContain('North Shore City');
  });

  it('labels the North Shore district report title as North Shore', () => {
    const svg = generateSVG('North Shore City', subData, []);

    expect(svg).toContain('North Shore — Median Price');
    expect(svg).toContain('>North Shore</text>');
    expect(svg).not.toContain('North Shore City');
  });
});
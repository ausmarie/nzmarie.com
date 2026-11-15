import { describe, it, expect } from 'vitest';
import { generateSVG, updateLegacyMedianPriceChartTitle } from '@/lib/report-charts';

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

    expect(svg).toContain('Median Price - Torbay vs North Shore');
    expect(svg).toContain('>Torbay</text>');
    expect(svg).toContain('>North Shore</text>');
    expect(svg).not.toContain('North Shore City');
  });

  it('labels the North Shore district report title as North Shore', () => {
    const svg = generateSVG('North Shore City', subData, []);

    expect(svg).toContain('Median Price - North Shore');
    expect(svg).toContain('>North Shore</text>');
    expect(svg).not.toContain('North Shore City');
  });
});

describe('updateLegacyMedianPriceChartTitle', () => {
  it('updates only the saved chart title and keeps its chart data intact', () => {
    const svg = '<svg><path d="M1 2"/><text x="350" y="22" text-anchor="middle">Browns Bay vs North Shore - Median Price</text></svg>';

    const updated = updateLegacyMedianPriceChartTitle(svg, 'Browns Bay');

    expect(updated).toContain('Median Price - Browns Bay vs North Shore');
    expect(updated).toContain('<path d="M1 2"/>');
    expect(updateLegacyMedianPriceChartTitle(updated, 'Browns Bay')).toBe(updated);
  });

  it('escapes suburb names before inserting them into SVG text', () => {
    const svg = '<svg><text x="350" y="22">Old title</text></svg>';

    expect(updateLegacyMedianPriceChartTitle(svg, 'A&B')).toContain('Median Price - A&amp;B vs North Shore');
  });

  it('updates the title position used by saved metric charts', () => {
    const svg = '<svg><text x="350" y="26">Browns Bay vs North Shore - Median Price</text></svg>';

    expect(updateLegacyMedianPriceChartTitle(svg, 'Browns Bay')).toContain(
      'Median Price - Browns Bay vs North Shore',
    );
  });

  it('throws when the saved SVG does not have the expected title element', () => {
    expect(() => updateLegacyMedianPriceChartTitle('<svg></svg>', 'Browns Bay')).toThrow(
      'Could not locate the saved chart title.',
    );
  });
});
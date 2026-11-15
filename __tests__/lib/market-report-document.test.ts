import { describe, expect, it } from 'vitest';
import {
  ensureMarketReportRichTextContent,
  ensureMarketReportTitleIcon,
} from '@/lib/market-report-document';
import type { MarketReportSnapshot } from '@/lib/market-report-data';
import type { ReportEditorContent } from '@/types/report';

const snapshot: MarketReportSnapshot = {
  periodType: 'monthly',
  periodKey: '2026-10',
  periodLabel: 'October 2026',
  generatedAt: '2026-11-01T00:00:00.000Z',
  source: 'Test source',
  propertyType: 'House',
  metrics: { medianPrice: null, salesCount: 0, daysToSell: null },
  charts: { medianPrice: [], salesCount: [], daysToSell: [] },
  dataNotes: 'Test notes',
};

describe('market report document', () => {
  it('updates legacy comparison labels in saved content without changing other pulse values', () => {
    const content = [{
      type: 'marketPulse',
      props: {
        compareLabel: 'Compared to September',
        comparePrice: '-2.4%',
      },
    }] as unknown as ReportEditorContent;

    const updated = ensureMarketReportRichTextContent(content, snapshot);
    const pulse = updated[0] as unknown as { props: Record<string, string> };

    expect(pulse.props.compareLabel).toBe('Compared to Previous Month (September)');
    expect(pulse.props.comparePrice).toBe('-2.4%');
  });

  it('removes redundant captions from generated market charts, including saved charts', () => {
    const savedContent = [{
      type: 'marketPulse',
      props: {},
    }, {
      type: 'image',
      props: {
        name: 'north-shore-market-chart-medianPrice',
        caption: 'Median Price - North Shore vs Auckland Region',
      },
    }] as unknown as ReportEditorContent;

    const savedUpdated = ensureMarketReportRichTextContent(savedContent, snapshot) as unknown as Array<{
      type: string;
      props?: Record<string, unknown>;
    }>;
    const savedChart = savedUpdated.find((block) => block.type === 'image');
    expect(savedChart?.props).not.toHaveProperty('caption');

    const generated = ensureMarketReportRichTextContent([], snapshot) as unknown as Array<{
      type: string;
      props?: Record<string, unknown>;
    }>;
    const generatedCharts = generated.filter((block) => block.type === 'image');
    expect(generatedCharts).toHaveLength(3);
    expect(generatedCharts.every((chart) => !('caption' in (chart.props ?? {})))).toBe(true);
  });

  it('adds the Reports delta icon before the first rich-text level-one heading once', () => {
    const content = [{
      type: 'heading',
      props: { level: 1 },
      content: [{ type: 'text', text: 'North Shore Market Report', styles: { bold: true } }],
    }] as unknown as ReportEditorContent;

    const updated = ensureMarketReportTitleIcon(content);
    const heading = updated[0] as unknown as {
      content: Array<{ type: string; text?: string; props?: Record<string, string> }>;
    };

    expect(heading.content[0]).toEqual({
      type: 'delta',
      props: { height: '36px', strokeColor: '#1e40af' },
    });
    expect(heading.content[2].text).toBe('North Shore Market Report');
    expect(ensureMarketReportTitleIcon(updated)[0]).toEqual(updated[0]);
  });
});

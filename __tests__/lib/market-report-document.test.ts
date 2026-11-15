import { describe, expect, it } from 'vitest';
import { ensureMarketReportRichTextContent } from '@/lib/market-report-document';
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
});

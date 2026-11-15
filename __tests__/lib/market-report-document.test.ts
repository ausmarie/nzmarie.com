import { describe, expect, it } from 'vitest';
import {
  buildMarketReportRichTextContent,
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
  it('uses the selected quarter in the subtitle without a monthly season label', () => {
    const quarterlySnapshot: MarketReportSnapshot = {
      ...snapshot,
      periodType: 'quarterly',
      periodKey: '2026-Q3',
      periodLabel: 'Q3 2026',
    };
    const getSubtitle = (language: 'en' | 'zh') => {
      const headings = (buildMarketReportRichTextContent(quarterlySnapshot, language) as unknown as Array<{
        type: string;
        content?: Array<{ type?: string; text?: string }>;
      }>).filter((block) => block.type === 'heading');
      return headings[1].content?.filter((item) => item.type === 'text').map((item) => item.text).join('');
    };

    expect(getSubtitle('en')).toBe('Q3 2026 Housing Market Update');
    expect(getSubtitle('zh')).toBe('2026年第3季度房地产市场更新');
  });

  it('generates Chinese editorial labels and charts without changing the report data shape', () => {
    const dataPoint = {
      period: '2026-10',
      label: 'October 2026',
      medianPrice: 1130000,
      salesCount: 260,
      daysToSell: 43,
      districtMedianPrice: 1450000,
      districtSalesCount: 520,
      districtDaysToSell: 49,
    };
    const localizedSnapshot: MarketReportSnapshot = {
      ...snapshot,
      charts: {
        medianPrice: [dataPoint],
        salesCount: [dataPoint],
        daysToSell: [dataPoint],
      },
    };
    const generated = buildMarketReportRichTextContent(localizedSnapshot, 'zh') as unknown as Array<{
      type: string;
      props?: Record<string, unknown>;
      content?: Array<{ type?: string; text?: string; props?: Record<string, unknown>; styles?: Record<string, unknown> }>;
    }>;
    const headings = generated.filter((block) => block.type === 'heading');
    const pulse = generated.find((block) => block.type === 'marketPulse');
    const charts = generated.filter((block) => block.type === 'image');

    const headingText = (block: (typeof headings)[number]) =>
      block.content?.filter((item) => item.type === 'text').map((item) => item.text).join('').trim();
    expect(headings.map(headingText)).toEqual([
      '北岸房地产市场报告',
      '2026年10月房地产市场更新（春季版）',
      '北岸市场脉搏（2026年10月）',
      'REINZ 市场趋势',
    ]);
    expect(headings[0].props).toMatchObject({ level: 1, textAlignment: 'center' });
    expect(headings[0].content?.[0]).toMatchObject({
      type: 'delta',
      props: { height: '36px', strokeColor: '#1e40af' },
    });
    expect(headings[0].content?.[2]).toMatchObject({ text: '北岸房地产市场报告', styles: { bold: true } });
    expect(headings[1].props).toMatchObject({ level: 2, textAlignment: 'center' });
    expect(headings[1].content?.[0]?.styles).toEqual({ bold: true });
    expect(pulse?.props).toMatchObject({
      medianLabel: '房屋中位售价',
      salesLabel: '北岸房屋成交数量',
      daysLabel: '北岸平均售出天数',
      compareLabel: '较上月（9月）',
    });
    expect(charts).toHaveLength(3);
    const firstChart = decodeURIComponent(String(charts[0].props?.url).replace('data:image/svg+xml,', ''));
    expect(firstChart).toContain('房价中位数 - 北岸与奥克兰地区对比');
    expect(firstChart).toContain('奥克兰地区');
    expect(firstChart).toContain('2026年10月');
    const englishCharts = buildMarketReportRichTextContent(localizedSnapshot)
      .filter((block) => (block as { type?: string }).type === 'image') as unknown as Array<{
        props: { url: string };
      }>;
    const geometry = (svg: string) => svg.match(/<path[^>]*>|<circle[^>]*>/g);
    for (const [index, chineseChart] of charts.entries()) {
      const chineseSvg = decodeURIComponent(String(chineseChart.props?.url).replace('data:image/svg+xml,', ''));
      const englishSvg = decodeURIComponent(englishCharts[index].props.url.replace('data:image/svg+xml,', ''));
      expect(geometry(chineseSvg)).toEqual(geometry(englishSvg));
    }

    const englishHeadings = (buildMarketReportRichTextContent(localizedSnapshot) as unknown as Array<{
      type: string;
      content?: Array<{ type?: string; text?: string }>;
    }>).filter((block) => block.type === 'heading');
    expect(englishHeadings[0].content?.filter((item) => item.type === 'text').map((item) => item.text).join('').trim())
      .toBe('North Shore Market Report');
    expect(englishHeadings[1].content?.[0]?.text).toBe('October 2026 Housing Market Update (Spring Edition)');
  });

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

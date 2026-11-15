import { formatMillions } from '@/lib/market-pulse';
import type { ReportEditorContent } from '@/types/report';
import { getMarketReportComparisonLabel, type MarketReportPoint, type MarketReportSnapshot } from '@/lib/market-report-data';
import type { MarketPulseProps } from '@/lib/market-pulse';
import { monotonePath } from '@/lib/monotone-chart-path';

type TrendMetric = 'medianPrice' | 'salesCount' | 'daysToSell';

const CHARTS: Array<{ metric: TrendMetric; title: string; color: string }> = [
  { metric: 'medianPrice', title: 'Median Price', color: '#2348c5' },
  { metric: 'salesCount', title: 'Number of Sales', color: '#059669' },
  { metric: 'daysToSell', title: 'Days to Sell', color: '#d97706' },
];

interface MarketDocumentBlock {
  type?: string;
  props?: Record<string, unknown>;
  content?: string | Array<{ type?: string; text?: string; styles?: Record<string, unknown> }>;
}

export function marketReportChartName(metric: TrendMetric): string {
  return `north-shore-market-chart-${metric}`;
}

function formatValue(metric: TrendMetric, value: number): string {
  if (metric === 'medianPrice') return formatMillions(value);
  if (metric === 'daysToSell') return `${Math.round(value)} days`;
  return Math.round(value).toLocaleString('en-NZ');
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function chartValue(point: MarketReportPoint, metric: TrendMetric, district = false): number | null {
  const value = district
    ? metric === 'medianPrice'
      ? point.districtMedianPrice
      : metric === 'salesCount'
        ? point.districtSalesCount
        : point.districtDaysToSell
    : point[metric];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function createSeriesSvg(
  data: MarketReportPoint[],
  metric: TrendMetric,
  color: string,
  x: (index: number) => number,
  y: (value: number) => number,
  district = false,
): string {
  const paths: string[] = [];
  let segment: Array<{ x: number; y: number }> = [];
  const finishSegment = () => {
    const path = monotonePath(segment);
    if (path) paths.push(path);
    segment = [];
  };

  data.forEach((point, index) => {
    const value = chartValue(point, metric, district);
    if (value === null) {
      finishSegment();
      return;
    }
    segment.push({ x: x(index), y: y(value) });
  });
  finishSegment();

  const dash = district ? ' stroke-dasharray="8 7"' : '';
  const radius = district ? 5 : 6;
  const lines = paths.map((path) =>
    `<path d="${path}" fill="none" stroke="${color}" stroke-width="${district ? 4 : 5}"${dash} stroke-linecap="round" stroke-linejoin="round"/>`,
  ).join('');
  const dots = data.map((point, index) => {
    const value = chartValue(point, metric, district);
    if (value === null) return '';
    return `<circle cx="${x(index).toFixed(1)}" cy="${y(value).toFixed(1)}" r="${radius}" fill="${color}" stroke="#fff" stroke-width="2"/>`;
  }).join('');
  return `${lines}${dots}`;
}

function createChartSvg(
  title: string,
  metric: TrendMetric,
  data: MarketReportPoint[],
  color: string,
): string {
  const width = 1200;
  const height = 540;
  const left = 112;
  const right = 42;
  const top = 70;
  const bottom = 102;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const values = data.flatMap((point) => [chartValue(point, metric), chartValue(point, metric, true)])
    .filter((value): value is number => value !== null);
  const hasDistrictData = data.some((point) => chartValue(point, metric, true) !== null);
  const rawMin = values.length ? Math.min(...values) : 0;
  const rawMax = values.length ? Math.max(...values) : 1;
  const padding = rawMax === rawMin ? Math.max(Math.abs(rawMax) * 0.1, 1) : (rawMax - rawMin) * 0.12;
  const min = Math.max(0, rawMin - padding);
  const max = rawMax + padding || 1;
  const y = (value: number) => top + plotHeight - ((value - min) / (max - min)) * plotHeight;
  const x = (index: number) => left + (data.length <= 1 ? plotWidth / 2 : (index / (data.length - 1)) * plotWidth);
  const ticks = Array.from({ length: 5 }, (_, index) => min + ((max - min) * index) / 4);
  const northShoreSeries = createSeriesSvg(data, metric, color, x, y);
  const aucklandSeries = hasDistrictData
    ? createSeriesSvg(data, metric, '#94a3b8', x, y, true)
    : '';

  const stride = Math.max(1, Math.ceil(data.length / 10));
  const grid = ticks.map((value) => {
    const tickY = y(value).toFixed(1);
    return `<g><line x1="${left}" y1="${tickY}" x2="${width - right}" y2="${tickY}" stroke="#dfe5ef" stroke-dasharray="5 6"/><text x="${left - 14}" y="${Number(tickY) + 5}" text-anchor="end" fill="#64748b" font-size="17">${escapeXml(formatValue(metric, value))}</text></g>`;
  }).join('');
  const xLabels = data.map((point, index) => {
    if (index % stride !== 0 && index !== data.length - 1) return '';
    return `<text x="${x(index).toFixed(1)}" y="${height - bottom + 34}" text-anchor="middle" fill="#475569" font-size="16">${escapeXml(point.label)}</text>`;
  }).join('');
  const emptyLabel = values.length ? '' : '<text x="600" y="300" text-anchor="middle" fill="#64748b" font-size="20">No data available for this range</text>';
  const label = snapshotChartPeriodLabel(data);
  const legend = `<line x1="370" y1="${height - 24}" x2="397" y2="${height - 24}" stroke="${color}" stroke-width="5" stroke-linecap="round"/><circle cx="383.5" cy="${height - 24}" r="5" fill="${color}" stroke="#fff" stroke-width="2"/><text x="408" y="${height - 18}" fill="#334155" font-family="Arial, sans-serif" font-size="16">North Shore · ${escapeXml(label)}</text>${hasDistrictData ? `<line x1="735" y1="${height - 24}" x2="762" y2="${height - 24}" stroke="#94a3b8" stroke-width="4" stroke-dasharray="8 7" stroke-linecap="round"/><text x="773" y="${height - 18}" fill="#334155" font-family="Arial, sans-serif" font-size="16">Auckland Region</text>` : ''}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(title)} trend chart">
    <rect width="100%" height="100%" fill="#fff"/>
    <text x="${width / 2}" y="38" text-anchor="middle" fill="#0f172a" font-family="Arial, sans-serif" font-size="23" font-weight="700">${escapeXml(title)}</text>
    ${grid}
    <line x1="${left}" y1="${top + plotHeight}" x2="${width - right}" y2="${top + plotHeight}" stroke="#94a3b8"/>
    ${northShoreSeries}
    ${aucklandSeries}${xLabels}${emptyLabel}
    ${legend}
  </svg>`;
}

function snapshotChartPeriodLabel(data: MarketReportPoint[]): string {
  if (!data.length) return 'Market trend';
  return data.length === 1 ? data[0].label : `${data[0].label} – ${data[data.length - 1].label}`;
}

function createMarketPulseProps(snapshot: MarketReportSnapshot): MarketPulseProps {
  const comparison = snapshot.comparison;
  const districtMetrics = snapshot.districtMetrics;
  return {
    medianPrice: formatMillions(snapshot.metrics.medianPrice),
    salesCount: snapshot.metrics.salesCount.toLocaleString('en-NZ'),
    daysToSell: snapshot.metrics.daysToSell === null ? '—' : `${snapshot.metrics.daysToSell} Days`,
    medianLabel: 'Median Sale Price',
    salesLabel: 'North Shore Properties Sold',
    daysLabel: 'North Shore Avg Days to Sell',
    card2Note: `Auckland Region Sold: ${districtMetrics?.salesCount?.toLocaleString('en-NZ') ?? '—'}`,
    districtLine: `Auckland Region Avg: ${districtMetrics?.daysToSell == null ? '—' : `${districtMetrics.daysToSell} Days`}`,
    priceNote: `Auckland Region Price: ${formatMillions(districtMetrics?.medianPrice)}`,
    compareLabel: getMarketReportComparisonLabel(snapshot.periodType, snapshot.periodKey),
    comparePrice: comparison?.medianPriceChange ?? '—',
    compareSales: comparison?.salesCountChange ?? '—',
    compareDays: comparison?.daysToSellChange ?? '—',
    statPriceLabel: 'Median Price',
    statSalesLabel: 'Sales Count',
    statDaysLabel: 'Days to Sell',
  };
}

function textContent(text: string) {
  return [{ type: 'text', text, styles: {} }];
}

export function buildMarketReportRichTextContent(snapshot: MarketReportSnapshot): ReportEditorContent {
  const chartPeriod = snapshot.chartPeriodType ?? snapshot.periodType;
  const chartPeriodName = chartPeriod === 'quarterly' ? 'Quarterly' : 'Monthly';
  const blocks: unknown[] = [
    { type: 'heading', props: { level: 2 }, content: textContent(`North Shore Market Pulse (${snapshot.periodLabel})`) },
    { type: 'marketPulse', props: createMarketPulseProps(snapshot) },
    { type: 'paragraph', content: [] },
    { type: 'heading', props: { level: 2 }, content: textContent('REINZ Market Trends') },
    { type: 'paragraph', content: textContent(`${chartPeriodName} market data for North Shore, with Auckland Region shown for comparison where data is available.`) },
  ];

  for (const chart of CHARTS) {
    const svg = createChartSvg(
      `${chart.title} - North Shore vs Auckland Region`,
      chart.metric,
      snapshot.charts[chart.metric],
      chart.color,
    );
    blocks.push({
      type: 'image',
      props: {
        url: `data:image/svg+xml,${encodeURIComponent(svg)}`,
        caption: `${chart.title} - North Shore vs Auckland Region`,
        name: marketReportChartName(chart.metric),
        showPreview: true,
        previewWidth: 960,
        textAlignment: 'left',
        backgroundColor: 'default',
      },
    });
  }
  blocks.push({ type: 'paragraph', content: textContent(`Source: ${snapshot.source}. ${snapshot.dataNotes}`) });
  return blocks as unknown as ReportEditorContent;
}

export function ensureMarketReportRichTextContent(
  content: ReportEditorContent,
  snapshot: MarketReportSnapshot,
): ReportEditorContent {
  const blocks = content as unknown as MarketDocumentBlock[];
  if (blocks.some((block) => block.type === 'marketPulse')) {
    const compareLabel = getMarketReportComparisonLabel(snapshot.periodType, snapshot.periodKey);
    return blocks.map((block) => block.type === 'marketPulse'
      ? { ...block, props: { ...block.props, compareLabel } }
      : block) as unknown as ReportEditorContent;
  }
  const generated = buildMarketReportRichTextContent(snapshot);
  return [
    ...generated,
    ...blocks.filter((block) => block.type !== 'paragraph' || (Array.isArray(block.content) && block.content.length)),
  ] as unknown as ReportEditorContent;
}

export function refreshMarketReportGeneratedBlocks(
  content: ReportEditorContent,
  snapshot: MarketReportSnapshot,
): ReportEditorContent {
  const blocks = content as unknown as MarketDocumentBlock[];
  if (!blocks.some((block) => block.type === 'marketPulse')) {
    return ensureMarketReportRichTextContent(content, snapshot);
  }
  const generated = buildMarketReportRichTextContent(snapshot);
  const generatedBlocks = generated as unknown as MarketDocumentBlock[];
  const nextPulse = generatedBlocks.find((block) => block.type === 'marketPulse');
  const chartByName = new Map(
    generatedBlocks
      .filter((block) => block.type === 'image')
      .map((block) => [block.props?.name, block]),
  );
  const chartPeriodName = (snapshot.chartPeriodType ?? snapshot.periodType) === 'quarterly' ? 'Quarterly' : 'Monthly';
  return blocks.map((block) => {
    if (block.type === 'marketPulse' && nextPulse) return nextPulse;
    if (block.type === 'image' && typeof block.props?.name === 'string') {
      return chartByName.get(block.props.name) ?? block;
    }
    if (block.type === 'heading' && Array.isArray(block.content) && block.content.some((item) =>
      item.type === 'text' && item.text?.startsWith('North Shore Market Pulse'),
    )) {
      return { ...block, content: textContent(`North Shore Market Pulse (${snapshot.periodLabel})`) };
    }
    if (block.type === 'paragraph' && Array.isArray(block.content) && block.content.some((item) =>
      item.type === 'text' && /^(Quarterly|Monthly) market data for North Shore/.test(item.text ?? ''),
    )) {
      return { ...block, content: textContent(`${chartPeriodName} market data for North Shore, with Auckland Region shown for comparison where data is available.`) };
    }
    if (block.type === 'paragraph' && Array.isArray(block.content) && block.content.some((item) =>
      item.type === 'text' && item.text?.startsWith('Source:'),
    )) {
      return { ...block, content: textContent(`Source: ${snapshot.source}. ${snapshot.dataNotes}`) };
    }
    return block;
  }) as unknown as ReportEditorContent;
}

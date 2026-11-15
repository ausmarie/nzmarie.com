import type { ReactNode } from 'react';
import type { MarketReportLanguage, MarketReportSnapshot } from '@/lib/market-report-data';
import { buildMarketPulseHTML, type MarketPulseProps } from '@/lib/market-pulse';
import { marketReportChartName } from '@/lib/market-report-document';
import type { ReportEditorContent } from '@/types/report';
import '@blocknote/mantine/style.css';

interface RichTextInline {
  type?: string;
  text?: string;
  props?: Record<string, unknown>;
  styles?: Record<string, unknown>;
  content?: RichTextInline[] | string;
}

interface RichTextBlock {
  type?: string;
  props?: Record<string, unknown>;
  content?: RichTextInline[] | string | RichTextTable;
  children?: RichTextBlock[];
}

interface RichTextTableCell {
  content?: RichTextInline[];
  props?: { textAlignment?: string };
}

interface RichTextTable {
  rows?: Array<{ cells?: Array<RichTextInline[] | RichTextTableCell> }>;
  headerRows?: number;
}

const TEXT_STYLE_TAGS = [
  ['bold', 'strong'],
  ['italic', 'em'],
  ['underline', 'u'],
  ['strike', 's'],
  ['code', 'code'],
] as const;

function plainText(content: RichTextInline[] | string | undefined): string {
  if (typeof content === 'string') return content;
  return content?.map((item) => item.text ?? plainText(item.content)).join('') ?? '';
}

function inlineText(content: RichTextBlock['content']): string {
  return typeof content === 'string' || Array.isArray(content) ? plainText(content) : '';
}

function safeHref(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const href = value.trim();
  return /^(https?:|mailto:|tel:|\/|#|\?)/i.test(href) ? href : null;
}

function renderInline(content: RichTextInline[] | string | undefined, key: string): ReactNode {
  if (typeof content === 'string') return content;
  if (!content) return null;

  return content.map((item, index) => {
    const itemKey = `${key}-${index}`;
    if (item.type === 'delta') {
      const height = typeof item.props?.height === 'string' ? item.props.height : '36px';
      const stroke = typeof item.props?.strokeColor === 'string' ? item.props.strokeColor : '#1e40af';
      return (
        <svg key={itemKey} aria-hidden="true" viewBox="0 0 24 24" fill="none" style={{ height, width: 'auto' }} className="mr-2 inline-block align-middle">
          <path d="M12 3L22 18H2Z" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M2 22H22" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    }

    let node: ReactNode = item.text ?? renderInline(item.content, itemKey);
    for (const [style, tag] of TEXT_STYLE_TAGS) {
      if (item.styles?.[style] === true) {
        const Tag = tag;
        node = <Tag key={`${itemKey}-${style}`}>{node}</Tag>;
      }
    }

    if (item.type === 'link') {
      const href = safeHref(item.props?.url);
      if (href) {
        node = <a key={`${itemKey}-link`} href={href} rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}>{node}</a>;
      }
    }
    return <span key={itemKey}>{node}</span>;
  });
}

function pulseProps(props: Record<string, unknown> | undefined): MarketPulseProps {
  const value = (key: keyof MarketPulseProps): string => {
    const entry = props?.[key];
    return typeof entry === 'string' ? entry : '';
  };

  return {
    medianPrice: value('medianPrice'),
    salesCount: value('salesCount'),
    daysToSell: value('daysToSell'),
    medianLabel: value('medianLabel'),
    salesLabel: value('salesLabel'),
    daysLabel: value('daysLabel'),
    card2Note: value('card2Note'),
    districtLine: value('districtLine'),
    priceNote: value('priceNote'),
    compareLabel: value('compareLabel'),
    comparePrice: value('comparePrice'),
    compareSales: value('compareSales'),
    compareDays: value('compareDays'),
    statPriceLabel: value('statPriceLabel'),
    statSalesLabel: value('statSalesLabel'),
    statDaysLabel: value('statDaysLabel'),
  };
}

function chartAlt(name: string | undefined, snapshot: MarketReportSnapshot, language: MarketReportLanguage): string {
  const metrics = ['medianPrice', 'salesCount', 'daysToSell'] as const;
  const metric = metrics.find((candidate) =>
    name === marketReportChartName(candidate),
  );
  if (!metric) return name ?? '';

  const metricLabel = language === 'zh'
    ? {
        medianPrice: '房屋中位售价',
        salesCount: '房屋成交量',
        daysToSell: '售出天数',
      }[metric]
    : {
        medianPrice: 'median sale price',
        salesCount: 'sales volume',
        daysToSell: 'days to sell',
      }[metric];
  return language === 'zh'
    ? `北岸与奥克兰地区${metricLabel}趋势图，${snapshot.periodLabel}`
    : `North Shore vs Auckland Region ${metricLabel} trend chart, ${snapshot.periodLabel}`;
}

function renderBlock(
  block: RichTextBlock,
  index: number,
  snapshot: MarketReportSnapshot,
  language: MarketReportLanguage,
): ReactNode {
  const key = `${block.type ?? 'block'}-${index}`;
  const alignment = block.props?.textAlignment;
  const contentType = block.type ?? 'paragraph';
  const blockAttributes: Record<string, string> = { 'data-content-type': contentType };
  if (alignment === 'center' || alignment === 'right' || alignment === 'justify') {
    blockAttributes['data-text-alignment'] = alignment;
  }
  if (block.type === 'heading' && typeof block.props?.level === 'number') {
    blockAttributes['data-level'] = String(block.props.level);
  }
  const children = Array.isArray(block.content) || typeof block.content === 'string'
    ? renderInline(block.content, key)
    : null;
  const nested = block.children?.map((child, childIndex) =>
    renderBlock(child, childIndex, snapshot, language),
  );

  let content: ReactNode;
  switch (block.type) {
    case 'heading': {
      const level = Number(block.props?.level);
      if (level === 1) content = <h1 className="bn-inline-content">{children}</h1>;
      else if (level === 2) content = <h2 className="bn-inline-content">{children}</h2>;
      else if (level === 3) content = <h3 className="bn-inline-content">{children}</h3>;
      else content = <h4 className="bn-inline-content">{children}</h4>;
      break;
    }
    case 'paragraph': {
      const empty = inlineText(block.content).trim() === '' && !nested?.length;
      content = (
        <p
          className={`bn-inline-content${empty ? ' market-report-empty-paragraph' : ''}`}
          aria-hidden={empty || undefined}
        >
          {empty ? <br /> : <>{children}{nested}</>}
        </p>
      );
      break;
    }
    case 'bulletListItem':
      content = <ul className="bn-inline-content list-disc pl-6"><li>{children}{nested}</li></ul>;
      break;
    case 'numberedListItem':
      content = <ol className="bn-inline-content list-decimal pl-6"><li>{children}{nested}</li></ol>;
      break;
    case 'checkListItem':
      content = (
        <div key={key} className="flex items-start gap-2">
          <input type="checkbox" checked={block.props?.checked === true} readOnly aria-label={plainText(block.content as RichTextInline[] | string)} />
          <span>{children}{nested}</span>
        </div>
      );
      break;
    case 'quote':
      content = <blockquote className="bn-inline-content">{children}</blockquote>;
      break;
    case 'codeBlock':
      content = <pre className="bn-inline-content"><code>{inlineText(block.content)}</code></pre>;
      break;
    case 'image': {
      const src = block.props?.url;
      if (typeof src !== 'string') return null;
      const name = typeof block.props?.name === 'string' ? block.props.name : undefined;
      const caption = typeof block.props?.caption === 'string' ? block.props.caption : '';
      content = (
        <figure className="bn-inline-content my-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={chartAlt(name, snapshot, language)}
            className="bn-visual-media h-auto max-w-full"
          />
          {caption && <figcaption className="mt-2 text-center text-sm text-slate-600">{caption}</figcaption>}
        </figure>
      );
      break;
    }
    case 'marketPulse':
      content = (
        <div
          className="market-report-pulse my-6"
          style={{ width: '100%', minWidth: 0, boxSizing: 'border-box', fontFamily: 'inherit' }}
          dangerouslySetInnerHTML={{ __html: buildMarketPulseHTML(pulseProps(block.props), false) }}
        />
      );
      break;
    case 'table': {
      const table = block.content as RichTextTable | undefined;
      if (!table?.rows) return null;
      content = (
        <div className="bn-inline-content overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <tbody>
              {table.rows.map((row, rowIndex) => (
                <tr key={`${key}-row-${rowIndex}`}>
                  {(row.cells ?? []).map((cell, cellIndex) => {
                    const cellContent = Array.isArray(cell) ? cell : cell.content;
                    const Cell = rowIndex < (table.headerRows ?? 0) ? 'th' : 'td';
                    const textAlignment = Array.isArray(cell) ? 'left' : cell.props?.textAlignment;
                    return (
                      <Cell
                        key={`${key}-cell-${rowIndex}-${cellIndex}`}
                        className="border border-slate-300 px-3 py-2"
                        style={{
                          textAlign: textAlignment === 'center' || textAlignment === 'right'
                            ? textAlignment
                            : 'left',
                        }}
                      >
                        {renderInline(cellContent, `${key}-cell-${rowIndex}-${cellIndex}`)}
                      </Cell>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      break;
    }
    default: {
      const text = inlineText(block.content);
      content = text ? <p className="bn-inline-content">{text}{nested}</p> : nested;
    }
  }

  return (
    <div key={key} className="bn-block-outer">
      <div className="bn-block">
        <div className="bn-block-content" {...blockAttributes}>
          {content}
        </div>
      </div>
    </div>
  );
}

export default function MarketReportStaticContent({
  content,
  snapshot,
  language,
}: {
  content: ReportEditorContent;
  snapshot: MarketReportSnapshot;
  language: MarketReportLanguage;
}) {
  return (
    <div className="market-report-richtext bn-default-styles">
      {(content as RichTextBlock[]).map((block, index) => renderBlock(block, index, snapshot, language))}
    </div>
  );
}

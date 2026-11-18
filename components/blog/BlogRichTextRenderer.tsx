import type { ReactNode } from 'react';
import '@blocknote/mantine/style.css';
import { trimTrailingEmptyParagraphs } from '@/lib/report-content';
import type { ReportEditorContent } from '@/types/report';

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function safeHref(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const href = value.trim();
  if (/^(https?:|mailto:|tel:)/i.test(href)) return href;
  if (href.startsWith('#') || href.startsWith('?')) return href;
  return href.startsWith('/') && !href.startsWith('//') ? href : null;
}

function safeImageUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const url = value.trim();
  if (/^https?:\/\//i.test(url)) return url;
  return url.startsWith('/') && !url.startsWith('//') ? url : null;
}

function renderInline(value: unknown, key: string): ReactNode {
  if (typeof value === 'string') return value;
  if (!isRecord(value)) return null;

  if (value.type === 'link') {
    const linkProps = isRecord(value.props) ? value.props : {};
    const href = safeHref(value.href ?? linkProps.url);
    const content = renderInlineContent(value.content, key);
    if (!href) return content;
    const external = /^https?:\/\//i.test(href);
    return (
      <a
        key={key}
        href={href}
        className="font-medium text-blue-700 underline decoration-blue-300 underline-offset-2"
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      >
        {content}
      </a>
    );
  }

  if (value.type !== 'text' || typeof value.text !== 'string') return null;
  let node: ReactNode = value.text;
  const styles = isRecord(value.styles) ? value.styles : {};
  if (styles.code === true) node = <code className="rounded bg-slate-100 px-1 py-0.5 text-[0.9em]">{node}</code>;
  if (styles.strike === true) node = <s>{node}</s>;
  if (styles.underline === true) node = <u>{node}</u>;
  if (styles.italic === true) node = <em>{node}</em>;
  if (styles.bold === true) node = <strong>{node}</strong>;
  return <span key={key}>{node}</span>;
}

function renderInlineContent(value: unknown, keyPrefix: string): ReactNode {
  if (typeof value === 'string') return value;
  if (!Array.isArray(value)) return null;
  return value.map((item, index) => renderInline(item, `${keyPrefix}-${index}`));
}

function renderTable(value: unknown, key: string): ReactNode {
  if (!isRecord(value) || !Array.isArray(value.rows)) return null;
  const headerRows = typeof value.headerRows === 'number' ? value.headerRows : 0;
  const headerColumns = typeof value.headerCols === 'number' ? value.headerCols : 0;
  return (
    <div className="bn-inline-content overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <tbody>
          {value.rows.map((row, rowIndex) => {
            const cells = isRecord(row) && Array.isArray(row.cells) ? row.cells : [];
            return (
              <tr key={`${key}-row-${rowIndex}`}>
                {cells.map((cell, cellIndex) => {
                  const cellRecord = isRecord(cell) ? cell : null;
                  const cellProps = cellRecord && isRecord(cellRecord.props) ? cellRecord.props : {};
                  const cellContent = Array.isArray(cell)
                    ? cell
                    : cellRecord?.content;
                  const isHeader = rowIndex < headerRows || cellIndex < headerColumns;
                  const Cell = isHeader ? 'th' : 'td';
                  const textAlignment = cellProps.textAlignment;
                  const positiveSpan = (span: unknown): number | undefined =>
                    typeof span === 'number' && Number.isInteger(span) && span > 0 ? span : undefined;
                  const colSpan = positiveSpan(cellProps.colspan);
                  const rowSpan = positiveSpan(cellProps.rowspan);
                  return (
                    <Cell
                      key={`${key}-cell-${rowIndex}-${cellIndex}`}
                      className="border border-slate-300 px-3 py-2"
                      style={{
                        textAlign: textAlignment === 'center' || textAlignment === 'right'
                          || textAlignment === 'justify' ? textAlignment : 'left',
                      }}
                      {...(isHeader ? { scope: rowIndex < headerRows ? 'col' as const : 'row' as const } : {})}
                      {...(colSpan ? { colSpan } : {})}
                      {...(rowSpan ? { rowSpan } : {})}
                    >
                      {renderInlineContent(cellContent, `${key}-cell-content-${rowIndex}-${cellIndex}`)}
                    </Cell>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function inlineText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (!Array.isArray(value)) return '';
  return value.map((item) => {
    if (typeof item === 'string') return item;
    return isRecord(item)
      ? `${typeof item.text === 'string' ? item.text : ''}${inlineText(item.content)}`
      : '';
  }).join('');
}

function renderBlock(value: unknown, index: number): ReactNode {
  if (!isRecord(value)) return null;
  const key = `blog-block-${index}`;
  const content = value.content;
  const props = isRecord(value.props) ? value.props : {};
  const children = Array.isArray(value.children)
    ? value.children.map((child, childIndex) => renderBlock(child, childIndex))
    : null;
  const blockType = typeof value.type === 'string' ? value.type : 'paragraph';
  const alignment = props.textAlignment;
  const attributes: Record<string, string> = { 'data-content-type': blockType };
  if (blockType === 'bulletListItem') {
    attributes['data-native-list-marker'] = 'true';
  }
  if (alignment === 'center' || alignment === 'right' || alignment === 'justify') {
    attributes['data-text-alignment'] = alignment;
  }
  if (blockType === 'heading' && typeof props.level === 'number') {
    attributes['data-level'] = String(props.level);
  }

  let blockContent: ReactNode;

  switch (blockType) {
    case 'paragraph':
      blockContent = inlineText(content).trim() === '' && !children?.length
        ? <p className="bn-inline-content market-report-empty-paragraph" aria-hidden="true"><br /></p>
        : <p className="bn-inline-content">{renderInlineContent(content, key)}{children}</p>;
      break;
    case 'heading': {
      const level = Number(props.level);
      if (level === 1) {
        blockContent = <h2 className="bn-inline-content market-report-heading-level-1">{renderInlineContent(content, key)}</h2>;
      } else if (level === 2) {
        blockContent = <h2 className="bn-inline-content">{renderInlineContent(content, key)}</h2>;
      } else if (level === 3) {
        blockContent = <h3 className="bn-inline-content">{renderInlineContent(content, key)}</h3>;
      } else {
        blockContent = <h4 className="bn-inline-content">{renderInlineContent(content, key)}</h4>;
      }
      break;
    }
    case 'bulletListItem':
      blockContent = (
        <ul className="bn-inline-content list-disc pl-6">
          <li>{renderInlineContent(content, key)}{children}</li>
        </ul>
      );
      break;
    case 'numberedListItem':
      blockContent = <ol className="bn-inline-content list-decimal pl-6"><li>{renderInlineContent(content, key)}{children}</li></ol>;
      break;
    case 'checkListItem':
      blockContent = (
        <div className="flex items-start gap-2">
          <input type="checkbox" checked={props.checked === true} readOnly aria-label={inlineText(content)} />
          <span>{renderInlineContent(content, key)}{children}</span>
        </div>
      );
      break;
    case 'image': {
      const src = safeImageUrl(props.url);
      if (!src) return null;
      const alt = typeof props.name === 'string' ? props.name : '';
      blockContent = (
        <figure className="bn-inline-content my-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt} className="bn-visual-media h-auto max-w-full" loading="lazy" />
          {typeof props.caption === 'string' && props.caption.trim() && (
            <figcaption className="mt-2 text-center text-sm text-slate-600">{props.caption}</figcaption>
          )}
        </figure>
      );
      break;
    }
    case 'table':
      blockContent = renderTable(content, key);
      break;
    case 'quote':
      blockContent = (
        <blockquote className="bn-inline-content market-report-quote">
          {renderInlineContent(content, key)}
        </blockquote>
      );
      break;
    case 'codeBlock':
      blockContent = <pre className="bn-inline-content"><code>{inlineText(content)}</code></pre>;
      break;
    default:
      blockContent = inlineText(content)
        ? <p className="bn-inline-content">{inlineText(content)}{children}</p>
        : children;
  }

  return (
    <div key={key} className="bn-block-outer">
      <div className="bn-block">
        <div className="bn-block-content" {...attributes}>{blockContent}</div>
      </div>
    </div>
  );
}

export default function BlogRichTextRenderer({ content }: { content: ReportEditorContent }) {
  const blocks = trimTrailingEmptyParagraphs(content);
  return (
    <div className="market-report-richtext blog-public-richtext bn-default-styles">
      {blocks.map((block, index) => renderBlock(block, index))}
    </div>
  );
}

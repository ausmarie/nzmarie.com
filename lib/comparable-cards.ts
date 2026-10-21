export interface ComparableSummaryProps {
  saleTitle: string;
  saleBadge: string;
  saleMedian: string;
  saleMedianLabel: string;
  saleRangeLabel: string;
  saleRange: string;
  saleMeanLabel: string;
  saleMean: string;
  cvTitle: string;
  cvBadge: string;
  cvMedian: string;
  cvMedianLabel: string;
  cvRangeLabel: string;
  cvRange: string;
  cvMeanLabel: string;
  cvMean: string;
}

export const COMPARABLE_SUMMARY_DEFAULTS: ComparableSummaryProps = {
  saleTitle: 'Comparable Sale Price',
  saleBadge: 'Median',
  saleMedian: '\u2014',
  saleMedianLabel: 'Median Sold Price',
  saleRangeLabel: 'Price Range:',
  saleRange: '\u2014',
  saleMeanLabel: 'Mean Average:',
  saleMean: '\u2014',
  cvTitle: 'Comparable Council Valuation',
  cvBadge: 'Median',
  cvMedian: '\u2014',
  cvMedianLabel: 'Median Rating Valuation',
  cvRangeLabel: 'C.V Range:',
  cvRange: '\u2014',
  cvMeanLabel: 'Mean Average:',
  cvMean: '\u2014',
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const EDITABLE_STYLE =
  'border-radius:3px;padding:0 2px;margin:0 -2px;outline:none;cursor:text;min-width:1ch;';

export function buildComparableSummaryHTML(props: ComparableSummaryProps): string {
  const value = (prop: keyof ComparableSummaryProps): string => escapeHtml(String(props[prop] ?? ''));
  const edit = (prop: keyof ComparableSummaryProps): string =>
    `<span data-prop="${prop}" contenteditable="true" spellcheck="false" style="${EDITABLE_STYLE}">${value(prop)}</span>`;

  const footerRow = (labelProp: keyof ComparableSummaryProps, valueProp: keyof ComparableSummaryProps): string => `
        <div style="display:flex;align-items:baseline;justify-content:space-between;gap:16px;font-size:12px;line-height:1.9;">
          <span style="color:#64748b;flex:0 0 auto;">${edit(labelProp)}</span>
          <span style="color:#334155;font-weight:600;text-align:right;min-width:0;">${edit(valueProp)}</span>
        </div>`;

  const card = (
    titleProp: keyof ComparableSummaryProps,
    badgeProp: keyof ComparableSummaryProps,
    medianProp: keyof ComparableSummaryProps,
    medianLabelProp: keyof ComparableSummaryProps,
    rangeLabelProp: keyof ComparableSummaryProps,
    rangeProp: keyof ComparableSummaryProps,
    meanLabelProp: keyof ComparableSummaryProps,
    meanProp: keyof ComparableSummaryProps
  ): string => `
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;flex:1 1 320px;min-width:0;box-sizing:border-box;box-shadow:0 1px 3px rgba(0,0,0,.06);">
        <div style="padding:20px 22px 18px;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px;">
            <span style="font-size:11px;font-weight:700;color:#64748b;letter-spacing:.02em;line-height:1.4;">${edit(titleProp)}</span>
            <span style="font-size:10px;font-weight:600;color:#64748b;background:#f8fafc;border:1px solid #e2e8f0;border-radius:999px;padding:2px 8px;white-space:nowrap;flex:0 0 auto;">${edit(badgeProp)}</span>
          </div>
          <div style="font-size:30px;font-weight:800;color:#0f172a;line-height:1.15;letter-spacing:-.02em;font-variant-numeric:tabular-nums;">${edit(medianProp)}</div>
          <div style="font-size:12px;color:#64748b;margin-top:5px;line-height:1.45;">${edit(medianLabelProp)}</div>
        </div>
        <div style="background:rgba(248,250,252,.8);border-top:1px solid #f1f5f9;padding:12px 22px 14px;">
          ${footerRow(rangeLabelProp, rangeProp)}
          ${footerRow(meanLabelProp, meanProp)}
        </div>
      </div>`;

  return `
    <div style="display:flex;flex-wrap:wrap;align-items:stretch;gap:12px;width:100%;box-sizing:border-box;font-family:inherit;">
      ${card('saleTitle', 'saleBadge', 'saleMedian', 'saleMedianLabel', 'saleRangeLabel', 'saleRange', 'saleMeanLabel', 'saleMean')}
      ${card('cvTitle', 'cvBadge', 'cvMedian', 'cvMedianLabel', 'cvRangeLabel', 'cvRange', 'cvMeanLabel', 'cvMean')}
    </div>`;
}

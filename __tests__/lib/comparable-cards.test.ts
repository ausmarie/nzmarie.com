import { describe, expect, it } from 'vitest';
import {
  buildComparableSummaryHTML,
  COMPARABLE_SUMMARY_DEFAULTS,
  type ComparableSummaryProps,
} from '@/lib/comparable-cards';

const props: ComparableSummaryProps = {
  ...COMPARABLE_SUMMARY_DEFAULTS,
  saleMedian: '$855,000',
  saleRange: '$820,000 \u2013 $1,081,500',
  saleMean: '$916,416',
  cvMedian: '$1,015,000',
  cvRange: '$800,000 \u2013 $1,200,000',
  cvMean: '$1,010,000',
};

describe('comparable summary cards', () => {
  it('renders two editable cards with the comparable values', () => {
    const html = buildComparableSummaryHTML(props);

    expect(html.match(/data-prop=/g)).toHaveLength(16);
    expect(html.match(/contenteditable="true"/g)).toHaveLength(16);
    expect(html).toContain('data-prop="saleTitle"');
    expect(html).toContain('Comparable Sale Price');
    expect(html).toContain('data-prop="saleMedian"');
    expect(html).toContain('$855,000');
    expect(html).toContain('data-prop="saleRange"');
    expect(html).toContain('$820,000 \u2013 $1,081,500');
    expect(html).toContain('data-prop="cvTitle"');
    expect(html).toContain('Comparable Council Valuation');
    expect(html).toContain('data-prop="cvMedian"');
    expect(html).toContain('$1,015,000');
  });

  it('uses the white card style with a shaded footer', () => {
    const html = buildComparableSummaryHTML(props);

    expect(html.match(/flex:1 1 320px/g)).toHaveLength(2);
    expect(html.match(/border:1px solid #e2e8f0/g)?.[0]).toBeTruthy();
    expect(html.match(/background:rgba\(248,250,252,\.8\)/g)).toHaveLength(2);
    expect(html.match(/border-top:1px solid #f1f5f9/g)).toHaveLength(2);
  });

  it('escapes editable text', () => {
    const html = buildComparableSummaryHTML({ ...props, saleTitle: 'Sale <Price> & Value' });

    expect(html).toContain('Sale &lt;Price&gt; &amp; Value');
    expect(html).not.toContain('Sale <Price> & Value');
  });
});

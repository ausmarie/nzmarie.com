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

  it('renders the Median marker as plain text instead of a pill', () => {
    const html = buildComparableSummaryHTML(props);

    // No pill chrome: no rounded badge container around the marker.
    expect(html).not.toContain('border-radius:999px');
    expect(html).not.toMatch(/background:#f8fafc;border:1px solid #e2e8f0;border-radius:999px/);

    // The marker is still present and editable in both cards.
    expect(html.match(/data-prop="saleBadge"/g)).toHaveLength(1);
    expect(html.match(/data-prop="cvBadge"/g)).toHaveLength(1);
    expect(html.match(/>Median</g)).toHaveLength(2);

    // Plain text marker: aligned by line-height only, so copying cannot shift it.
    const markers = html.match(/<span style="[^"]*letter-spacing:\.04em[^"]*">/g) ?? [];
    expect(markers).toHaveLength(2);
    for (const marker of markers) {
      expect(marker).toContain('line-height:1.4');
      expect(marker).not.toContain('border-radius');
      // No box height (only line-height) and no pill background.
      expect(marker).not.toMatch(/[^-]height:/);
      expect(marker).not.toContain('background');
    }
  });

  it('escapes editable text', () => {
    const html = buildComparableSummaryHTML({ ...props, saleTitle: 'Sale <Price> & Value' });

    expect(html).toContain('Sale &lt;Price&gt; &amp; Value');
    expect(html).not.toContain('Sale <Price> & Value');
  });
});

import { describe, it, expect } from 'vitest';
import { extractDaysToSellDescription, filterOutDaysToSellFromIntro, updateIntroMonthYear } from '../../../../../../../app/api/admin/reports/templates/generate/intro-utils';

describe('extractDaysToSellDescription', () => {
  it('returns null for null input', () => {
    expect(extractDaysToSellDescription(null)).toBeNull();
  });

  it('returns null for empty array', () => {
    expect(extractDaysToSellDescription([])).toBeNull();
  });

  it('extracts paragraph with text object content format', () => {
    const blocks = [
      { type: 'heading', props: { level: 3 }, content: [{ type: 'text', text: 'Days to Sell', styles: {} }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'The average Days to Sell of 28 days during 2026 Q2 reflects current market liquidity.', styles: {} }] },
    ];
    expect(extractDaysToSellDescription(blocks)).toBe('The average Days to Sell of 28 days during 2026 Q2 reflects current market liquidity.');
  });

  it('extracts paragraph with old string array content format', () => {
    const blocks = [
      { type: 'heading', props: { level: 3 }, content: ['Days to Sell'] },
      { type: 'paragraph', content: ['The average Days to Sell of 28 days during 2026 Q2 reflects current market liquidity.'] },
    ];
    expect(extractDaysToSellDescription(blocks)).toBe('The average Days to Sell of 28 days during 2026 Q2 reflects current market liquidity.');
  });

  it('extracts paragraph with plain string content', () => {
    const blocks = [
      { type: 'heading', props: { level: 3 }, content: 'Days to Sell' },
      { type: 'paragraph', content: 'The average Days to Sell of 28 days during 2026 Q2 reflects current market liquidity.' },
    ];
    expect(extractDaysToSellDescription(blocks)).toBe('The average Days to Sell of 28 days during 2026 Q2 reflects current market liquidity.');
  });

  it('extracts paragraph with lowercase casing', () => {
    const blocks = [
      { type: 'heading', content: [{ type: 'text', text: 'Days to sell', styles: {} }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'the average days to sell of 28 days during 2026 Q2.', styles: {} }] },
    ];
    expect(extractDaysToSellDescription(blocks)).toBe('the average days to sell of 28 days during 2026 Q2.');
  });

  it('returns null if no paragraph matches', () => {
    const blocks = [
      { type: 'paragraph', content: [{ type: 'text', text: 'Another paragraph', styles: {} }] },
    ];
    expect(extractDaysToSellDescription(blocks)).toBeNull();
  });

  it('skips non-paragraph blocks', () => {
    const blocks = [
      { type: 'heading', content: [{ type: 'text', text: 'The average Days to Sell is 28 days', styles: {} }] },
    ];
    expect(extractDaysToSellDescription(blocks)).toBeNull();
  });

  it('handles content as undefined', () => {
    const blocks = [
      { type: 'paragraph' },
    ];
    expect(extractDaysToSellDescription(blocks)).toBeNull();
  });

  it('handles mixed content types in array where first item is different', () => {
    const blocks = [
      { type: 'paragraph', content: ['Some leading text. ', { type: 'text', text: 'The average Days to Sell of 28 days.', styles: {} }] },
    ];
    // regex requires text to START with "the average days to sell" (case-insensitive)
    expect(extractDaysToSellDescription(blocks)).toBeNull();
  });
});

describe('filterOutDaysToSellFromIntro', () => {
  it('returns null for null input', () => {
    expect(filterOutDaysToSellFromIntro(null)).toBeNull();
  });

  it('returns empty array for empty input', () => {
    expect(filterOutDaysToSellFromIntro([])).toEqual([]);
  });

  it('removes heading with string content containing Days to Sell', () => {
    const blocks = [
      { type: 'heading', props: { level: 3 }, content: 'Days to Sell' },
      { type: 'paragraph', content: 'The average Days to Sell of 28 days.' },
    ];
    expect(filterOutDaysToSellFromIntro(blocks)).toEqual([]);
  });

  it('removes heading with object array content containing Days to Sell', () => {
    const blocks = [
      { type: 'heading', props: { level: 3 }, content: [{ type: 'text', text: 'Days to Sell', styles: {} }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'The average Days to Sell of 28 days.', styles: {} }] },
    ];
    expect(filterOutDaysToSellFromIntro(blocks)).toEqual([]);
  });

  it('removes heading with old string array content containing Days to Sell', () => {
    const blocks = [
      { type: 'heading', props: { level: 3 }, content: ['Days to Sell'] },
      { type: 'paragraph', content: ['The average Days to Sell of 28 days.'] },
    ];
    expect(filterOutDaysToSellFromIntro(blocks)).toEqual([]);
  });

  it('removes blocks with lowercase "days to sell"', () => {
    const blocks = [
      { type: 'heading', props: { level: 3 }, content: 'Days to sell' },
      { type: 'paragraph', content: 'the average days to sell of 28 days.' },
    ];
    expect(filterOutDaysToSellFromIntro(blocks)).toEqual([]);
  });

  it('removes blocks with mixed case "dAys tO sEll"', () => {
    const blocks = [
      { type: 'heading', content: [{ type: 'text', text: 'DAYS TO SELL', styles: {} }] },
      { type: 'paragraph', content: 'The average Days to Sell of 28 days.' },
    ];
    expect(filterOutDaysToSellFromIntro(blocks)).toEqual([]);
  });

  it('keeps unrelated blocks', () => {
    const blocks = [
      { type: 'heading', props: { level: 1 }, content: [{ type: 'text', text: 'Oteha', styles: {} }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'This is a new Oteha introduction.', styles: {} }] },
    ];
    expect(filterOutDaysToSellFromIntro(blocks)).toEqual(blocks);
  });

  it('strips Days to Sell but keeps other blocks', () => {
    const blocks = [
      { type: 'heading', props: { level: 1 }, content: [{ type: 'text', text: 'Oteha', styles: {} }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Some intro text.', styles: {} }] },
      { type: 'heading', props: { level: 3 }, content: 'Days to Sell' },
      { type: 'paragraph', content: 'The average Days to Sell of 28 days.' },
      { type: 'paragraph', content: [{ type: 'text', text: 'More text after.', styles: {} }] },
    ];
    const result = filterOutDaysToSellFromIntro(blocks);
    expect(result).toHaveLength(3);
    expect((result as any[])?.[0]?.content?.[0]?.text || (result as any[])?.[0]?.content?.[0]).toBe('Oteha');
    expect((result as any[])?.[2]?.content?.[0]?.text || (result as any[])?.[2]?.content?.[0]).toBe('More text after.');
  });

  it('removes preceding heading when paragraph with Days to Sell is found', () => {
    const blocks = [
      { type: 'heading', props: { level: 2 }, content: [{ type: 'text', text: 'Market Insights', styles: {} }] },
      { type: 'heading', props: { level: 3 }, content: [{ type: 'text', text: 'Days to Sell', styles: {} }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'The average Days to Sell of 28 days reflects current market liquidity.', styles: {} }] },
    ];
    const result = filterOutDaysToSellFromIntro(blocks);
    expect(result).toHaveLength(1);
    expect((result as any[])?.[0]?.content?.[0]?.text || (result as any[])?.[0]?.content?.[0]).toBe('Market Insights');
  });

  it('handles undefined content gracefully', () => {
    const blocks = [
      { type: 'heading', props: { level: 3 } },
      { type: 'paragraph' },
    ];
    expect(filterOutDaysToSellFromIntro(blocks)).toHaveLength(2);
  });

  it('removes heading only (no matching paragraph)', () => {
    const blocks = [
      { type: 'heading', props: { level: 3 }, content: 'Days to Sell Analysis' },
      { type: 'paragraph', content: 'Some other text about the market.' },
    ];
    const result = filterOutDaysToSellFromIntro(blocks);
    expect(result).toHaveLength(1);
    const remaining = (result as any[])?.[0];
    expect(remaining.type).toBe('paragraph');
    expect(remaining.content).toBe('Some other text about the market.');
  });

  it('handles mixed content types across blocks', () => {
    const blocks = [
      { type: 'heading', props: { level: 1 }, content: 'Oteha' },
      { type: 'paragraph', content: 'Intro paragraph.' },
      { type: 'heading', props: { level: 3 }, content: [{ type: 'text', text: 'Days to Sell', styles: {} }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'The average Days to Sell of 28 days.', styles: {} }] },
    ];
    const result = filterOutDaysToSellFromIntro(blocks);
    expect(result).toHaveLength(2);
  });

  it('processes Oteha the same as any other suburb', () => {
    const blocks = [
      { type: 'heading', props: { level: 3 }, content: 'Days to Sell' },
      { type: 'paragraph', content: 'The average Days to Sell of 28 days.' },
    ];
    expect(filterOutDaysToSellFromIntro(blocks)).toEqual([]);
  });

  it('removes paragraph with "Average days to sell" (lowercase), not just "The average"', () => {
    const blocks = [
      { type: 'heading', content: 'Days to Sell' },
      { type: 'paragraph', content: 'Average days to sell: 28 days.' },
    ];
    expect(filterOutDaysToSellFromIntro(blocks)).toEqual([]);
  });
});

describe('updateIntroMonthYear', () => {
  it('returns null for null input', () => {
    expect(updateIntroMonthYear(null, 2026, 9)).toBeNull();
  });

  it('rewrites the featuring date in a string content block', () => {
    const blocks = [
      { type: 'paragraph', content: 'Spring Market Update (Featuring Latest October 2026 Data)' },
    ];
    const result = updateIntroMonthYear(blocks, 2026, 9) as any[];
    expect(result[0].content).toBe('Spring Market Update (Featuring Latest September 2026 Data)');
  });

  it('rewrites the featuring date in a text object content array', () => {
    const blocks = [
      { type: 'paragraph', content: [{ type: 'text', text: 'Featuring Latest October 2026 Data', styles: {} }] },
    ];
    const result = updateIntroMonthYear(blocks, 2026, 9) as any[];
    expect(result[0].content[0].text).toBe('Featuring Latest September 2026 Data');
    expect(result[0].content[0].styles).toEqual({});
  });

  it('rewrites the featuring date in a string array content', () => {
    const blocks = [
      { type: 'paragraph', content: ['Autumn Insights — ', 'Featuring Latest April 2025 Data'] },
    ];
    const result = updateIntroMonthYear(blocks, 2026, 1) as any[];
    expect(result[0].content[1]).toBe('Featuring Latest January 2026 Data');
    expect(result[0].content[0]).toBe('Autumn Insights — ');
  });

  it('keeps surrounding copy such as the season name untouched', () => {
    const blocks = [
      { type: 'heading', props: { level: 3 }, content: [{ type: 'text', text: 'Spring Market Update', styles: {} }] },
      { type: 'paragraph', content: 'Featuring Latest October 2026 Data' },
    ];
    const result = updateIntroMonthYear(blocks, 2026, 7) as any[];
    expect(result[0].content[0].text).toBe('Spring Market Update');
    expect(result[1].content).toBe('Featuring Latest July 2026 Data');
  });

  it('updates across years', () => {
    const blocks = [
      { type: 'paragraph', content: 'Featuring Latest December 2025 Data' },
    ];
    const result = updateIntroMonthYear(blocks, 2026, 2) as any[];
    expect(result[0].content).toBe('Featuring Latest February 2026 Data');
  });

  it('rewrites the featuring date when it is split across styled text runs', () => {
    const blocks = [
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Spring Market Update (Featuring Latest ', styles: {} },
          { type: 'text', text: 'October 2026', styles: { bold: true } },
          { type: 'text', text: ' Data)', styles: {} },
        ],
      },
    ];
    const result = updateIntroMonthYear(blocks, 2026, 9) as any[];
    const texts = result[0].content.map((c: any) => (typeof c === 'string' ? c : c.text));
    expect(texts.join('')).toBe('Spring Market Update (Featuring Latest September 2026 Data)');
    expect(texts.some((t: string) => t.includes('October'))).toBe(false);
  });

  it('leaves text without the featuring pattern unchanged', () => {
    const blocks = [
      { type: 'paragraph', content: 'Median prices rose across the shore.' },
    ];
    const result = updateIntroMonthYear(blocks, 2026, 9);
    expect((result as any[])[0].content).toBe('Median prices rose across the shore.');
  });

  it('returns the same block object when nothing changes', () => {
    const block = { type: 'paragraph', content: 'No dates here.' };
    const result = updateIntroMonthYear([block], 2026, 9) as any[];
    expect(result[0]).toBe(block);
  });

  it('ignores non-object entries', () => {
    const blocks = [null, 'text-entry', 42];
    const result = updateIntroMonthYear(blocks, 2026, 9);
    expect(result).toEqual([null, 'text-entry', 42]);
  });

  it('ignores entries without a content field', () => {
    const blocks = [{ type: 'paragraph' }];
    const result = updateIntroMonthYear(blocks, 2026, 9);
    expect(result).toEqual([{ type: 'paragraph' }]);
  });
});

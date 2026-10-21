import { describe, it, expect } from 'vitest';
import {
  buildLeadIntroductionBlocks,
  buildLeadIntroductionTitle,
  formatLeadIntroductionDate,
  formatLeadIntroductionMoney,
  parseLeadIntroductionHistory,
  renderLeadIntroductionStatsSvg,
  type LeadIntroductionProperty,
} from '@/lib/lead-introduction';

const property: LeadIntroductionProperty = {
  address: '2/65 Target Road',
  suburb: 'Totara Vale',
  city: 'North Shore City',
  region: 'Auckland',
  bedrooms: '3',
  bathrooms: '1',
  car_spaces: '2',
  floor_size: '140.0',
  land_area: null,
  land_area_numeric: null,
  property_type: 'Residential',
  year_built: '1990',
  capital_value: 940000,
  land_value: 660000,
  improvement_value: 280000,
  estimated_value_low: 800000,
  estimated_value_high: 900000,
  last_sold_price: 360000,
  last_sold_date: '2008-08-25T12:00:00.000Z',
  has_rental_history: true,
  is_currently_rented: false,
  description: 'A well presented home in Totara Vale.\n\nClose to local amenities.',
  property_history: JSON.stringify([
    { date: '26/08/2008', type: 'SOLD', price: '$360,000' },
    { date: '05/09/2005', type: 'SOLD', price: '$345,000' },
    { date: '29/08/1995', type: 'SOLD', price: '$180,000' },
  ]),
};

function blockText(block: unknown): string {
  const content = (block as { content?: unknown }).content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((part) => (typeof part === 'string' ? part : '')).join('');
  }
  return '';
}

function findBlock(blocks: unknown[], type: string, text?: string): Record<string, unknown> | undefined {
  return blocks.find((block) => {
    const row = block as Record<string, unknown>;
    if (row.type !== type) return false;
    return text === undefined || blockText(row).includes(text);
  }) as Record<string, unknown> | undefined;
}

describe('lead introduction', () => {
  it('builds the address heading first followed by the property stats row', () => {
    const blocks = buildLeadIntroductionBlocks(property);

    expect((blocks[0] as { type: string }).type).toBe('heading');
    expect(blockText(blocks[0])).toBe('2/65 Target Road');

    const image = blocks[1] as { type: string; props: { url: string } };
    expect(image.type).toBe('image');
    expect(image.props.url.startsWith('data:image/svg+xml;base64,')).toBe(true);

    const svg = Buffer.from(image.props.url.split(',')[1], 'base64').toString('utf8');
    expect(svg).toContain('140 m²');
    expect(svg).toContain('- m²');
    expect(svg).toContain('BEDS');
    expect(svg).toContain('BATHS');
    expect(svg).toContain('CARS');
  });

  it('adds property information, description, and address history sections', () => {
    const blocks = buildLeadIntroductionBlocks(property);

    expect(findBlock(blocks, 'heading', 'Property Information')).toBeTruthy();
    expect(findBlock(blocks, 'heading', 'Description')).toBeTruthy();
    expect(findBlock(blocks, 'heading', 'Comparable Sales')).toBeTruthy();
    expect(findBlock(blocks, 'heading', 'Address History')).toBeTruthy();

    const comparable = blocks.find((block) => (block as { type: string }).type === 'comparableSummary') as {
      props: Record<string, string>;
    };
    expect(comparable).toBeTruthy();
    expect(comparable.props.saleTitle).toBe('Comparable Sale Price');
    expect(comparable.props.cvTitle).toBe('Comparable Council Valuation');
    expect(comparable.props.saleMedian).toBe('\u2014');

    const tables = blocks.filter((block) => (block as { type: string }).type === 'table');
    expect(tables).toHaveLength(2);

    const infoJson = JSON.stringify(tables[0]);
    expect(infoJson).toContain('Capital value');
    expect(infoJson).toContain('$940,000');
    expect(infoJson).toContain('Estimated value');
    expect(infoJson).toContain('$800,000 – $900,000');
    expect(infoJson).toContain('Last sold');
    expect(infoJson).toContain('26 Aug 2008');

    const paragraphs = blocks.filter((block) => (block as { type: string }).type === 'paragraph').map(blockText);
    expect(paragraphs).toContain('A well presented home in Totara Vale.');
    expect(paragraphs).toContain('Close to local amenities.');

    const historyJson = JSON.stringify(tables[1]);
    expect(historyJson).toContain('26 Aug 2008');
    expect(historyJson).toContain('Sold');
    expect(historyJson).toContain('$360,000');
    expect(historyJson.indexOf('26 Aug 2008')).toBeLessThan(historyJson.indexOf('5 Sep 2005'));
  });

  it('falls back to placeholders when property data is missing', () => {
    const blocks = buildLeadIntroductionBlocks({ address: '1 Example Street' });

    const svg = renderLeadIntroductionStatsSvg({ address: '1 Example Street' });
    expect(svg).toContain('BEDS');
    expect(svg).toContain('- m²');

    expect(JSON.stringify(blocks)).toContain('No additional property details are available.');
    expect(JSON.stringify(blocks)).toContain('No description is available for this property.');
    expect(JSON.stringify(blocks)).toContain('No address history is available for this property.');
  });

  it('formats titles, money, dates, and history records', () => {
    expect(buildLeadIntroductionTitle(' 2/65 Target Road ')).toBe('2/65 Target Road Introduction');
    expect(formatLeadIntroductionMoney('940000')).toBe('$940,000');
    expect(formatLeadIntroductionMoney(null)).toBe('');
    expect(formatLeadIntroductionDate('26/08/2008')).toBe('26 Aug 2008');
    expect(formatLeadIntroductionDate('2008-08-25T12:00:00.000Z')).toBe('26 Aug 2008');

    const history = parseLeadIntroductionHistory(property.property_history);
    expect(history).toHaveLength(3);
    expect(history[0]).toEqual({ date: '26/08/2008', event: 'Sold', price: '$360,000' });
    expect(parseLeadIntroductionHistory('not json')).toEqual([]);
    expect(parseLeadIntroductionHistory(null)).toEqual([]);
  });
});

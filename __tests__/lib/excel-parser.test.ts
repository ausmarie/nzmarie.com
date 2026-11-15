import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { parseREINZExcel } from '@/lib/excel-parser';

describe('parseREINZExcel', () => {
  it('normalizes Auckland aggregate data to Auckland Region', () => {
    const sheet = XLSX.utils.json_to_sheet([{
      Location: 'Auckland',
      Period: '2025-01-01',
      'Median Sale Price': 1100000,
      'No of Sales': 500,
    }]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Market Data');
    const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });

    const parsed = parseREINZExcel(buffer);

    expect(parsed).toMatchObject({
      suburb_name: 'Auckland Region',
      city: 'Auckland',
      region_type: 'district',
      count: 1,
    });
    expect(parsed.rows[0]).toMatchObject({
      region_name: 'Auckland Region',
      city: 'Auckland',
      period_month: '2025-01-01',
      median_price: 1100000,
      sales_count: 500,
    });
  });
});

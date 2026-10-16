import { describe, it, expect } from 'vitest';
import {
  MONTH_NAMES,
  monthLabel,
  monthName,
  shiftMonth,
  formatMillions,
  pctChange,
  formatPct,
  formatDaysDiff,
  statDirection,
  computeMarketPulse,
  buildMarketPulseHTML,
} from '@/lib/market-pulse';
import type { MonthlyDataPoint, SuburbDetail } from '@/lib/market-data-aggregator';

function detail(median: number | null, sales: number, days: number | null): SuburbDetail {
  return { median, sales, days };
}

function point(
  period: string,
  suburb: SuburbDetail | null,
  district: SuburbDetail | null
): MonthlyDataPoint {
  const suburbs: Record<string, SuburbDetail> = {};
  if (suburb) suburbs.Torbay = suburb;
  return {
    period,
    periodRaw: `${period}-01`,
    cityMedian: district?.median ?? null,
    citySales: district?.sales ?? 0,
    cityDays: district?.days ?? null,
    cityDetail: district,
    suburbs,
  };
}

describe('MONTH_NAMES / monthLabel / monthName', () => {
  it('has 12 English month names in order', () => {
    expect(MONTH_NAMES).toHaveLength(12);
    expect(MONTH_NAMES[0]).toBe('January');
    expect(MONTH_NAMES[11]).toBe('December');
  });

  it('monthLabel formats month and year', () => {
    expect(monthLabel(2026, 9)).toBe('September 2026');
    expect(monthLabel(2025, 1)).toBe('January 2025');
    expect(monthLabel(2026, 12)).toBe('December 2026');
  });

  it('monthName returns the English month name', () => {
    expect(monthName(6)).toBe('June');
    expect(monthName(12)).toBe('December');
  });
});

describe('shiftMonth', () => {
  it('shifts backwards within the same year', () => {
    expect(shiftMonth(2026, 9, -1)).toEqual({ year: 2026, month: 8 });
    expect(shiftMonth(2026, 3, -1)).toEqual({ year: 2026, month: 2 });
  });

  it('crosses the year boundary backwards', () => {
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
  });

  it('crosses the year boundary forwards', () => {
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
  });

  it('defaults to one month back', () => {
    expect(shiftMonth(2026, 5)).toEqual({ year: 2026, month: 4 });
  });

  it('shifts by multiple months', () => {
    expect(shiftMonth(2026, 2, -3)).toEqual({ year: 2025, month: 11 });
    expect(shiftMonth(2026, 11, 3)).toEqual({ year: 2027, month: 2 });
  });
});

describe('formatMillions', () => {
  it('formats with two decimals and trims trailing zeros', () => {
    expect(formatMillions(1150000)).toBe('$1.15M');
    expect(formatMillions(1200000)).toBe('$1.2M');
    expect(formatMillions(12500000)).toBe('$12.5M');
    expect(formatMillions(1000000)).toBe('$1M');
  });

  it('returns the fallback for null, undefined and NaN', () => {
    expect(formatMillions(null)).toBe('\u2014');
    expect(formatMillions(undefined)).toBe('\u2014');
    expect(formatMillions(Number.NaN)).toBe('\u2014');
    expect(formatMillions(null, '-')).toBe('-');
  });

  it('formats zero without decimals', () => {
    expect(formatMillions(0)).toBe('$0M');
  });

  it('does not trim zeros inside the number', () => {
    expect(formatMillions(1050000)).toBe('$1.05M');
    expect(formatMillions(100500000)).toBe('$100.5M');
  });
});

describe('pctChange', () => {
  it('computes percentage change rounded to two decimals', () => {
    expect(pctChange(1150000, 1250000)).toBe(-8);
    expect(pctChange(150, 100)).toBe(50);
    expect(pctChange(1000, 900)).toBe(11.11);
  });

  it('returns 0 when values are equal', () => {
    expect(pctChange(100, 100)).toBe(0);
  });

  it('returns null when base is zero, null or undefined', () => {
    expect(pctChange(100, 0)).toBeNull();
    expect(pctChange(100, null)).toBeNull();
    expect(pctChange(null, 100)).toBeNull();
    expect(pctChange(100, undefined)).toBeNull();
  });
});

describe('formatPct', () => {
  it('formats positive values with a plus sign and one decimal', () => {
    expect(formatPct(50)).toBe('+50.0%');
    expect(formatPct(0)).toBe('+0.0%');
    expect(formatPct(11.11)).toBe('+11.1%');
  });

  it('formats negative values with one decimal', () => {
    expect(formatPct(-8)).toBe('-8.0%');
    expect(formatPct(-12.37)).toBe('-12.4%');
  });

  it('returns an em dash for null', () => {
    expect(formatPct(null)).toBe('\u2014');
    expect(formatPct(Number.NaN)).toBe('\u2014');
  });
});

describe('formatDaysDiff', () => {
  it('formats signed day differences', () => {
    expect(formatDaysDiff(3)).toBe('+3');
    expect(formatDaysDiff(-5)).toBe('-5');
    expect(formatDaysDiff(0)).toBe('0');
  });

  it('returns an em dash for null', () => {
    expect(formatDaysDiff(null)).toBe('\u2014');
  });
});

describe('statDirection', () => {
  it('detects up from a leading plus', () => {
    expect(statDirection('+10.0%')).toBe('up');
    expect(statDirection('+5')).toBe('up');
  });

  it('detects down from a leading minus', () => {
    expect(statDirection('-8.0%')).toBe('down');
    expect(statDirection('-5')).toBe('down');
  });

  it('returns none for em dash, empty and unsigned values', () => {
    expect(statDirection('\u2014')).toBe('none');
    expect(statDirection('')).toBe('none');
    expect(statDirection('10%')).toBe('none');
  });
});

describe('computeMarketPulse', () => {
  it('computes local suburb values with month-on-month comparisons', () => {
    const monthly = [
      point('2026-08', detail(1250000, 4, 47), detail(1150000, 299, 58)),
      point('2026-09', detail(1150000, 6, 42), detail(1165000, 262, 53)),
    ];

    const result = computeMarketPulse(monthly, 'Torbay', 2026, 9);

    expect(result.hasData).toBe(true);
    expect(result.usedDistrict).toBe(false);
    expect(result.anchor).toEqual({ year: 2026, month: 9 });
    expect(result.previous).toEqual({ year: 2026, month: 8 });
    expect(result.days).toBe(42);

    expect(result.props.medianPrice).toBe('$1.15M');
    expect(result.props.salesCount).toBe('6');
    expect(result.props.daysToSell).toBe('42 Days');
    expect(result.props.medianLabel).toBe('Median Sale Price');
    expect(result.props.salesLabel).toBe('Local Properties Sold');
    expect(result.props.daysLabel).toBe('Local Avg Days to Sell');
    expect(result.props.districtLine).toBe('North Shore Avg: 53 Days');
    expect(result.props.priceNote).toBe('North Shore Price: $1.17M');
    expect(result.props.compareLabel).toBe('Compared to Previous Month (August)');
    expect(result.props.comparePrice).toBe('-8.0%');
    expect(result.props.compareSales).toBe('+50.0%');
    expect(result.props.compareDays).toBe('-5');
    expect(result.props.card2Note).toBe('Boutique market absorption');
  });

  it('falls back to district data with North Shore labels when the suburb row is missing', () => {
    const monthly = [
      point('2026-08', null, detail(1250000, 200, 60)),
      point('2026-09', null, detail(1150000, 300, 53)),
    ];

    const result = computeMarketPulse(monthly, 'Torbay', 2026, 9);

    expect(result.hasData).toBe(true);
    expect(result.usedDistrict).toBe(true);
    expect(result.props.medianPrice).toBe('$1.15M');
    expect(result.props.salesCount).toBe('300');
    expect(result.props.salesLabel).toBe('North Shore Properties Sold');
    expect(result.props.daysLabel).toBe('North Shore Avg Days to Sell');
    expect(result.props.districtLine).toBe('');
    expect(result.props.priceNote).toBe('');
    expect(result.props.compareSales).toBe('+50.0%');
    expect(result.props.compareDays).toBe('-7');
  });

  it('uses the previous month district row when the district fallback is active', () => {
    const monthly = [
      point('2026-08', detail(990000, 3, 40), detail(1250000, 200, 60)),
      point('2026-09', null, detail(1150000, 300, 53)),
    ];

    const result = computeMarketPulse(monthly, 'Torbay', 2026, 9);

    expect(result.usedDistrict).toBe(true);
    expect(result.props.comparePrice).toBe('-8.0%');
    expect(result.props.compareSales).toBe('+50.0%');
  });

  it('shows em dashes for missing metrics while keeping the row available', () => {
    const monthly = [
      point('2026-08', detail(null, 3, null), detail(null, 299, null)),
      point('2026-09', detail(null, 6, null), detail(null, 262, null)),
    ];

    const result = computeMarketPulse(monthly, 'Torbay', 2026, 9);

    expect(result.hasData).toBe(true);
    expect(result.props.medianPrice).toBe('\u2014');
    expect(result.props.salesCount).toBe('6');
    expect(result.props.daysToSell).toBe('\u2014');
    expect(result.props.comparePrice).toBe('\u2014');
    expect(result.props.compareSales).toBe('+100.0%');
    expect(result.props.compareDays).toBe('\u2014');
    expect(result.props.priceNote).toBe('');
  });

  it('reports no data when neither the suburb nor the district has the month', () => {
    const result = computeMarketPulse([], 'Torbay', 2026, 9);

    expect(result.hasData).toBe(false);
    expect(result.usedDistrict).toBe(false);
    expect(result.days).toBeNull();
    expect(result.props.medianPrice).toBe('\u2014');
    expect(result.props.salesCount).toBe('\u2014');
    expect(result.props.daysToSell).toBe('\u2014');
    expect(result.props.priceNote).toBe('');
    expect(result.props.compareLabel).toBe('Compared to Previous Month (August)');
  });

  it('labels a cross-year comparison with the previous year', () => {
    const monthly = [
      point('2025-12', detail(1000000, 5, 50), detail(1100000, 250, 55)),
      point('2026-01', detail(1100000, 8, 45), detail(1150000, 260, 53)),
    ];

    const result = computeMarketPulse(monthly, 'Torbay', 2026, 1);

    expect(result.previous).toEqual({ year: 2025, month: 12 });
    expect(result.props.compareLabel).toBe('Compared to Previous Month (December 2025)');
    expect(result.props.comparePrice).toBe('+10.0%');
    expect(result.props.compareSales).toBe('+60.0%');
    expect(result.props.compareDays).toBe('-5');
  });

  it('falls back to district only when the suburb has no row for the month', () => {
    const monthly = [
      point('2026-09', null, detail(1165000, 262, 53)),
    ];

    const result = computeMarketPulse(monthly, 'Northcross', 2026, 9);

    expect(result.usedDistrict).toBe(true);
    expect(result.hasData).toBe(true);
    expect(result.props.comparePrice).toBe('\u2014');
    expect(result.props.districtLine).toBe('');
    expect(result.props.priceNote).toBe('');
  });

  it('omits the district line when district days are unavailable but keeps the district price note', () => {
    const monthly = [
      point('2026-09', detail(1150000, 6, 42), detail(1165000, 262, null)),
    ];

    const result = computeMarketPulse(monthly, 'Torbay', 2026, 9);

    expect(result.usedDistrict).toBe(false);
    expect(result.props.districtLine).toBe('');
    expect(result.props.priceNote).toBe('North Shore Price: $1.17M');
  });

  it('omits both district notes on a North Shore City district report', () => {
    const monthly: MonthlyDataPoint[] = [
      {
        period: '2026-09',
        periodRaw: '2026-09-01',
        cityMedian: 1165000,
        citySales: 262,
        cityDays: 53,
        cityDetail: detail(1165000, 262, 53),
        suburbs: { 'North Shore City': detail(1165000, 262, 53) },
      },
    ];

    const result = computeMarketPulse(monthly, 'North Shore City', 2026, 9);

    expect(result.usedDistrict).toBe(false);
    expect(result.props.districtLine).toBe('');
    expect(result.props.priceNote).toBe('');
    expect(result.props.medianPrice).toBe('$1.17M');
  });
});

describe('buildMarketPulseHTML', () => {
  const baseProps = {
    medianPrice: '$1.15M',
    salesCount: '6',
    daysToSell: '42 Days',
    medianLabel: 'Median Sale Price',
    salesLabel: 'Local Properties Sold',
    daysLabel: 'Local Avg Days to Sell',
    card2Note: 'Boutique market absorption',
    districtLine: 'North Shore Avg: 53 Days',
    priceNote: 'North Shore Price: $1.17M',
    compareLabel: 'Compared to Previous Month (August)',
    comparePrice: '-8.0%',
    compareSales: '+50.0%',
    compareDays: '-5',
    statPriceLabel: 'Median Price',
    statSalesLabel: 'Sales Count',
    statDaysLabel: 'Days to Sell',
  };

  it('renders an editable span for every prop', () => {
    const html = buildMarketPulseHTML(baseProps);
    const props = Object.keys(baseProps);
    expect(props).toHaveLength(16);
    for (const prop of props) {
      expect(html).toContain(`data-prop="${prop}"`);
      expect(html).toContain('contenteditable="true"');
    }
  });

  it('escapes HTML in editable values', () => {
    const html = buildMarketPulseHTML({ ...baseProps, medianLabel: '<b>oops</b>' });
    expect(html).toContain('&lt;b&gt;oops&lt;/b&gt;');
    expect(html).not.toContain('<b>oops</b>');
  });

  it('renders an up arrow for positive comparison values', () => {
    const html = buildMarketPulseHTML({ ...baseProps, comparePrice: '+8.0%' });
    const match = html.match(/data-arrow="comparePrice"[^>]*>([^<]*)/);
    expect(match).toBeTruthy();
    expect(match![1]).toBe('\u25B2');
    expect(html).toContain('color:#16a34a');
  });

  it('renders a down arrow for negative comparison values', () => {
    const html = buildMarketPulseHTML(baseProps);
    const match = html.match(/data-arrow="comparePrice"[^>]*>([^<]*)/);
    expect(match).toBeTruthy();
    expect(match![1]).toBe('\u25BC');
    expect(html).toContain('color:#dc2626');
  });

  it('renders no arrow for an em dash value', () => {
    const html = buildMarketPulseHTML({ ...baseProps, compareSales: '—' });
    const match = html.match(/data-arrow="compareSales"[^>]*>([^<]*)/);
    expect(match).toBeTruthy();
    expect(match![1]).toBe('');
  });

  it('inverts days to sell semantics so an increase is red and a decrease is green', () => {
    const html = buildMarketPulseHTML(baseProps);
    const daysCol = html.match(/data-value-col="compareDays" style="([^"]*)"/);
    expect(daysCol).toBeTruthy();
    expect(daysCol![1]).toContain('color:#16a34a');
    const daysArrow = html.match(/data-arrow="compareDays"[^>]*>([^<]*)/);
    expect(daysArrow![1]).toBe('▼');
  });

  it('renders a red up arrow when days to sell increase', () => {
    const html = buildMarketPulseHTML({ ...baseProps, compareDays: '+4' });
    const daysCol = html.match(/data-value-col="compareDays" style="([^"]*)"/);
    expect(daysCol![1]).toContain('color:#dc2626');
    const daysArrow = html.match(/data-arrow="compareDays"[^>]*>([^<]*)/);
    expect(daysArrow![1]).toBe('▲');
  });

  it('renders days to sell flat values in dark with no arrow', () => {
    const html = buildMarketPulseHTML({ ...baseProps, compareDays: '0' });
    const daysCol = html.match(/data-value-col="compareDays" style="([^"]*)"/);
    expect(daysCol![1]).toContain('color:#0f172a');
    const daysArrow = html.match(/data-arrow="compareDays"[^>]*>([^<]*)/);
    expect(daysArrow![1]).toBe('');
  });

  it('keeps median price semantics non-inverted so a rise stays green', () => {
    const html = buildMarketPulseHTML({ ...baseProps, comparePrice: '+8.0%' });
    const priceCol = html.match(/data-value-col="comparePrice" style="([^"]*)"/);
    expect(priceCol![1]).toContain('color:#16a34a');
  });

  it('omits the district price note when it is empty but keeps the card two note', () => {
    const withNotes = buildMarketPulseHTML(baseProps);
    const withoutPriceNote = buildMarketPulseHTML({ ...baseProps, priceNote: '' });
    expect(withNotes).toContain('North Shore Price: $1.17M');
    expect(withoutPriceNote).not.toContain('North Shore Price');
    expect(withoutPriceNote).toContain('Boutique market absorption');
  });

  it('omits the district days note when it is empty', () => {
    const withDistrict = buildMarketPulseHTML(baseProps);
    const withoutDistrict = buildMarketPulseHTML({ ...baseProps, districtLine: '' });
    expect(withDistrict).toContain('North Shore Avg: 53 Days');
    expect(withoutDistrict).not.toContain('North Shore Avg');
  });

  it('keeps a plain root so the editor wrapper can stretch the block to full width', () => {
    const container = document.createElement('div');
    container.innerHTML = buildMarketPulseHTML(baseProps);
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute('style')).toBe('font-family:inherit;');
    expect(root.style.flexGrow).toBe('');
    expect(root.style.width).toBe('');
  });

  it('centers all text inside each KPI card', () => {
    const container = document.createElement('div');
    container.innerHTML = buildMarketPulseHTML(baseProps);

    for (const prop of ['medianLabel', 'medianPrice', 'priceNote', 'salesLabel', 'salesCount', 'card2Note', 'daysLabel', 'daysToSell', 'districtLine']) {
      const el = container.querySelector<HTMLElement>(`[data-prop="${prop}"]`);
      expect(el, prop).toBeTruthy();
      expect(el!.parentElement?.style.textAlign, prop).toBe('center');
    }
  });

  it('styles the compare bar with the legacy light blue background', () => {
    const container = document.createElement('div');
    container.innerHTML = buildMarketPulseHTML(baseProps);
    const compareBar = container.querySelector<HTMLElement>('[data-prop="compareLabel"]')?.parentElement?.parentElement as HTMLElement;
    const styleAttr = compareBar.getAttribute('style') ?? '';
    expect(styleAttr).toContain('background:rgba(226,242,254,0.7)');
    expect(styleAttr).toContain('border:1px solid #cbd5e1');
  });

  it('keeps the compare label editable', () => {
    const html = buildMarketPulseHTML(baseProps);
    expect(html).toContain('Compared to Previous Month (August)');
    expect(html).toContain('data-prop="compareLabel"');
  });
});

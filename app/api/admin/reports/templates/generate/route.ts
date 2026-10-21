import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query as marieQuery } from '@/lib/db';
import { isAdmin } from '@/lib/permissions';
import { generateChartImageUrl, generateMetricChartImageUrl, type ChartPeriodType, type LeadChartMetric } from '@/lib/report-charts';
import { getMonthlyData } from '@/lib/market-data-aggregator';
import { computeMarketPulse, computeQuarterlyMarketPulse, formatMillions, monthLabel, quarterLabel, shiftMonth, MONTH_NAMES, type MarketPulseResult } from '@/lib/market-pulse';
import { reportDocumentPeriodKey } from '@/lib/report-period';
import { ensureLeadIntroduction } from '@/lib/lead-introduction-server';
import { extractDaysToSellDescription, filterOutDaysToSellFromIntro, updateIntroMonthYear } from './intro-utils';

interface TrendRow {
  region_name: string;
  region_type: string;
  period_month: string;
  median_price: number | null;
  sales_count: number | null;
  days_to_sell: number | null;
  median_price_1yr_prior: number | null;
  price_diff_1yr_pct: number | null;
  median_valuation: number | null;
  median_list_price: number | null;
  total_volume: number | null;
}

interface LastSoldRow {
  total: number;
  no_data: number;
  bucket_0_3: number;
  bucket_3_5: number;
  bucket_5_10: number;
  bucket_10_15: number;
  bucket_15_plus: number;
}

interface CampaignRow {
  mailed: number;
  downloads: number;
  appraisals: number;
  conversions: number;
}

const fmtM = (v: number | null | undefined): string => formatMillions(v, '-');

function toLocalDateStr(d: unknown): string {
  if (typeof d === 'string') return d;
  if (d instanceof Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }
  return String(d);
}

function getYearMonth(d: unknown): string {
  if (d instanceof Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
  const s = String(d);
  return s.slice(0, 7);
}

function quarterToRange(quarter: string): { start: string; end: string } | null {
  const [yearStr, qStr] = quarter.split('-Q');
  if (!yearStr || !qStr) return null;
  const year = parseInt(yearStr);
  const qNum = parseInt(qStr);
  const startMonth = (qNum - 1) * 3 + 1;
  const startDate = `${year}-${String(startMonth).padStart(2, '0')}-01`;
  const endMonth = startMonth + 3;
  const endYear = endMonth > 12 ? year + 1 : year;
  const endMonthAdjusted = endMonth > 12 ? endMonth - 12 : endMonth;
  const endDate = `${endYear}-${String(endMonthAdjusted).padStart(2, '0')}-01`;
  return { start: startDate, end: endDate };
}

async function fetchMarketTrends(suburbName: string, startDate: string, endDate: string): Promise<TrendRow[] | null> {
  if (!startDate || !endDate) return null;

  const result = await marieQuery<TrendRow>(
    `SELECT region_name, region_type, period_month, median_price, sales_count, days_to_sell,
          median_price_1yr_prior, price_diff_1yr_pct, median_valuation, median_list_price, total_volume
     FROM market_monthly_snapshots
     WHERE (region_name = $1 OR region_name = 'North Shore City')
       AND period_month >= $2::date AND period_month < $3::date
     ORDER BY region_name, period_month ASC`,
     [suburbName, startDate, endDate]
  );
  return result.rows;
}



async function fetchLastSoldData(suburbName: string): Promise<LastSoldRow | null> {
  const result = await marieQuery<LastSoldRow>(
    `SELECT
       COUNT(*) AS total,
       COUNT(*) FILTER (WHERE p.last_sold_date IS NULL) AS no_data,
       COUNT(*) FILTER (WHERE p.last_sold_date IS NOT NULL AND p.last_sold_date >= NOW() - INTERVAL '3 years') AS bucket_0_3,
       COUNT(*) FILTER (WHERE p.last_sold_date IS NOT NULL AND p.last_sold_date >= NOW() - INTERVAL '5 years' AND p.last_sold_date < NOW() - INTERVAL '3 years') AS bucket_3_5,
       COUNT(*) FILTER (WHERE p.last_sold_date IS NOT NULL AND p.last_sold_date >= NOW() - INTERVAL '10 years' AND p.last_sold_date < NOW() - INTERVAL '5 years') AS bucket_5_10,
       COUNT(*) FILTER (WHERE p.last_sold_date IS NOT NULL AND p.last_sold_date >= NOW() - INTERVAL '15 years' AND p.last_sold_date < NOW() - INTERVAL '10 years') AS bucket_10_15,
       COUNT(*) FILTER (WHERE p.last_sold_date IS NOT NULL AND p.last_sold_date < NOW() - INTERVAL '15 years') AS bucket_15_plus
     FROM real_estate re
     LEFT JOIN properties p ON re.address = p.address AND re.suburb = p.suburb
     WHERE re.suburb = $1 AND re.city = 'North Shore City' AND re.status IN ('for sale', 'under offer')`,
    [suburbName]
  );
  return result.rows[0];
}

async function fetchCampaignStats(suburbName: string): Promise<CampaignRow | null> {
  const result = await marieQuery<CampaignRow>(
    `SELECT
       COUNT(DISTINCT da.id) AS mailed,
       COUNT(DISTINCT da.id) FILTER (WHERE da.has_downloaded = TRUE) AS downloads,
       COUNT(DISTINCT da.id) FILTER (WHERE da.has_requested_appraisal = TRUE) AS appraisals,
       COUNT(DISTINCT da.id) FILTER (WHERE da.is_converted = TRUE) AS conversions
     FROM direct_mail_addresses da
     JOIN direct_mail_campaigns dc ON da.campaign_id = dc.id
     WHERE da.suburb = $1`,
    [suburbName]
  );
  return result.rows[0];
}

async function fetchSuburbIntroduction(suburbId: string): Promise<unknown[] | null> {
  const result = await marieQuery<{ content: unknown | null }>(
    `SELECT content
     FROM report_documents
     WHERE suburb_id = $1
       AND doc_type = 'suburb_intro'
       AND status != 'archived'
     ORDER BY updated_at DESC
     LIMIT 1`,
    [suburbId]
  );
  if (result.rows.length === 0) {
    return null;
  }
  const raw = result.rows[0].content;
  if (!raw) {
    return null;
  }
  if (Array.isArray(raw)) {
    return raw;
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

function agg(arr: (number | null)[]): number | null {
  const vals = arr.filter((v): v is number => v != null).map(v => Number(v));
  return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
}

function sum(arr: (number | null)[]): number {
  return arr.filter((v): v is number => v != null).map(v => Number(v)).reduce((a, b) => a + b, 0);
}

function quarterEndYearMonth(quarter: string): { year: number; month: number } {
  const [yearStr, qStr] = (quarter || '').split('-Q');
  const year = Number(yearStr);
  const q = Number(qStr);
  if (!Number.isInteger(year) || !Number.isInteger(q) || q < 1 || q > 4) {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }
  return { year, month: q * 3 };
}

function previousMonthYM(dateStr: string): string {
  const [y, m] = dateStr.slice(0, 7).split('-').map(Number);
  const py = m === 1 ? y - 1 : y;
  const pm = m === 1 ? 12 : m - 1;
  return `${py}-${String(pm).padStart(2, '0')}`;
}

function quarterOfMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  if (!Number.isInteger(y) || !Number.isInteger(m) || m < 1 || m > 12) return '';
  return `${y}-Q${Math.ceil(m / 3)}`;
}

interface MetricChartSection {
  periodType: ChartPeriodType;
  summaryStartYM: string;
  summaryEndYM: string;
  salesUrl: string | null;
  priceUrl: string | null;
  daysUrl: string | null;
}

function buildBlocks(
  suburbName: string,
  quarter: string,
  marketTrends: TrendRow[] | null,
  pulse: MarketPulseResult,
  lastSold: LastSoldRow | null,
  campaign: CampaignRow | null,
  chartImageUrl: string | null,
  suburbIntroContent: unknown[] | null,
  reportYear: number,
  reportMonth: number,
  reportTitle: string,
  pulsePeriodType: 'month' | 'quarter',
  chartSection?: MetricChartSection,
  legacySummary?: { startYM: string; endYM: string }
): unknown[] {
  const blocks: unknown[] = [];
  const displayName = suburbName === 'North Shore City' ? 'North Shore' : suburbName;
  const periodTitle = pulsePeriodType === 'quarter'
    ? quarterLabel(quarter) || monthLabel(reportYear, reportMonth)
    : monthLabel(reportYear, reportMonth);

  // Page 1: Cover
  blocks.push({
    type: 'heading',
    props: { level: 1, textAlignment: 'center' },
    content: [
      { type: 'delta', props: { height: '26px', strokeColor: '#2563eb' } },
      ` ${reportTitle}`,
    ],
  });
  const filteredIntroContent = updateIntroMonthYear(
    filterOutDaysToSellFromIntro(suburbIntroContent),
    reportYear,
    reportMonth,
    pulsePeriodType === 'quarter' ? periodTitle : undefined
  );
  if (filteredIntroContent && filteredIntroContent.length > 0) {
    blocks.push(...filteredIntroContent);
  }

  // Page 2: Market Pulse — custom card block for the report period
  blocks.push({ type: 'heading', props: { level: 2 }, content: [`${displayName} Market Pulse (${periodTitle})`] });

  if (pulse.hasData) {
    blocks.push({ type: 'marketPulse', props: { ...pulse.props } });
    let insight = extractDaysToSellDescription(suburbIntroContent);
    if (pulse.days != null) {
      if (insight) {
        insight = insight.replace(/The average Days to Sell of \d+ days/i, `The average Days to Sell of ${pulse.days} days`);
        if (pulsePeriodType === 'quarter') {
          const monthYearPattern = new RegExp(`\\b(${MONTH_NAMES.join('|')})\\s+\\d{4}\\b`);
          insight = insight.replace(monthYearPattern, periodTitle);
        }
      } else {
        insight = `The average Days to Sell of ${pulse.days} days during ${periodTitle} reflects current market liquidity.`;
      }
      blocks.push({ type: 'paragraph', content: [insight] });
    }
  } else {
    const unavailableNoun = pulsePeriodType === 'quarter' ? 'Quarterly' : 'Monthly';
    blocks.push({ type: 'paragraph', content: [`${unavailableNoun} data is not yet available for ${periodTitle}.`] });
  }

  // Page 3: REINZ Market Trends
  blocks.push({ type: 'heading', props: { level: 2 }, content: ['REINZ Market Trends'] });

  if (chartSection) {
    const periodWord = chartSection.periodType === 'month' ? 'Monthly' : 'Quarterly';
    const periodLabel = chartSection.periodType === 'month' ? 'Month' : 'Quarter';
    blocks.push({ type: 'paragraph', content: [`${periodWord} market data for ${displayName} compared with North Shore.`] });

    if (chartSection.salesUrl) {
      blocks.push({ type: 'image', props: { url: chartSection.salesUrl, caption: '', name: 'Number of sales chart', showPreview: true, previewWidth: 700, textAlignment: 'left', backgroundColor: 'default' } });
      blocks.push({ type: 'paragraph', content: [`Chart: Number of Sales/${periodLabel} — ${displayName} vs North Shore.`] });
    }
    if (chartSection.priceUrl) {
      blocks.push({ type: 'image', props: { url: chartSection.priceUrl, caption: '', name: 'Median sale price chart', showPreview: true, previewWidth: 700, textAlignment: 'left', backgroundColor: 'default' } });
      blocks.push({ type: 'paragraph', content: [`Chart: Median Sale Price — ${displayName} vs North Shore.`] });
    }
    blocks.push({ type: 'paragraph', content: ['Number of Listings per month will be added once REINZ listing data is available for this report.'] });
    if (chartSection.daysUrl) {
      blocks.push({ type: 'image', props: { url: chartSection.daysUrl, caption: '', name: 'Median days to sell chart', showPreview: true, previewWidth: 700, textAlignment: 'left', backgroundColor: 'default' } });
      blocks.push({ type: 'paragraph', content: [`Chart: Median Days to Sell — ${displayName} vs North Shore.`] });
    }
    if (chartSection.salesUrl || chartSection.priceUrl || chartSection.daysUrl) {
      blocks.push({ type: 'paragraph', content: ['Source: REINZ.'] });
    }
  } else {
    blocks.push({ type: 'paragraph', content: [`Quarterly market data for ${displayName} compared with North Shore.`] });
    if (chartImageUrl) {
      blocks.push({ type: 'image', props: { url: chartImageUrl, caption: '', name: 'Median price trend chart', showPreview: true, previewWidth: 700, textAlignment: 'left', backgroundColor: 'default' } });
      blocks.push({ type: 'paragraph', content: ['Chart: Median price trend — quarterly comparison.'] });
    }
  }

  if (marketTrends && marketTrends.length > 0) {
    const suburbData = marketTrends.filter((r) => r.region_name === suburbName);
    const districtData = marketTrends.filter((r) => r.region_name === 'North Shore City' && r.region_name !== suburbName);

    let summaryStartYM: string;
    let summaryEndYM: string;
    let summaryHeading: string;
    if (chartSection) {
      summaryStartYM = chartSection.summaryStartYM;
      summaryEndYM = chartSection.summaryEndYM;
      summaryHeading = chartSection.periodType === 'month' ? 'Period Summary' : 'Quarterly Summary';
    } else if (legacySummary) {
      summaryStartYM = legacySummary.startYM;
      summaryEndYM = legacySummary.endYM;
      summaryHeading = 'Quarterly Summary';
    } else {
      const [qYear, qStr] = (quarter || '').split('-Q');
      const qNum = parseInt(qStr);
      const firstMonth = !isNaN(qNum) ? ((qNum - 1) * 3 + 1) : 1;
      summaryStartYM = `${qYear}-${String(firstMonth).padStart(2, '0')}`;
      const lastMonth = firstMonth + 2;
      summaryEndYM = `${Number(qYear) + (lastMonth > 12 ? 1 : 0)}-${String(lastMonth > 12 ? lastMonth - 12 : lastMonth).padStart(2, '0')}`;
      summaryHeading = 'Quarterly Summary';
    }
    const summaryData = suburbData.filter(r => {
      const ym = getYearMonth(r.period_month);
      return ym >= summaryStartYM && ym <= summaryEndYM;
    });
    const summaryDist = districtData.filter(r => {
      const ym = getYearMonth(r.period_month);
      return ym >= summaryStartYM && ym <= summaryEndYM;
    });

    const subMedian = agg(summaryData.map(r => r.median_price));
    const subSales = sum(summaryData.map(r => r.sales_count));
    const subDays = agg(summaryData.map(r => r.days_to_sell));
    const distMedian = agg(summaryDist.map(r => r.median_price));
    const distSales = sum(summaryDist.map(r => r.sales_count));
    const distDays = agg(summaryDist.map(r => r.days_to_sell));

    blocks.push({ type: 'heading', props: { level: 3 }, content: [summaryHeading] });
    const qRows = [
      { cells: [
        ['Metric'],
        [displayName],
        ['North Shore'],
      ]},
      { cells: [
        ['Median Price'],
        [fmtM(subMedian)],
        [fmtM(distMedian)],
      ]},
      { cells: [
        ['Sales Count'],
        [String(subSales)],
        [String(distSales)],
      ]},
    ];
    if (subDays != null) {
      qRows.push({ cells: [
        ['Avg Days to Sell'],
        [String(subDays)],
        [distDays != null ? String(distDays) : '-'],
      ]});
    }
    blocks.push({ type: 'table', props: { width: 1 }, content: { type: 'tableContent', rows: qRows, headerRows: 1, columnWidths: [] } });

    const monthStr = (d: unknown) => toLocalDateStr(d);
    const months = [...new Set(marketTrends.map((r) => monthStr(r.period_month)))].sort();
    blocks.push({ type: 'heading', props: { level: 3 }, content: ['Monthly Breakdown'] });

    const mRows = [
      { cells: [
        ['Month'],
        [`${displayName} Median`],
        [`${displayName} Sales`],
        ['District Median'],
      ]},
    ];

    for (const month of months) {
      const sub = suburbData.find((r) => monthStr(r.period_month) === month);
      const dist = districtData.find((r) => monthStr(r.period_month) === month);
      const dsp = (d: string) => new Date(d).toLocaleDateString('en-NZ', { month: 'short', year: 'numeric' });
      mRows.push({
        cells: [
          [dsp(month)],
          [fmtM(sub?.median_price)],
          [sub ? String(sub.sales_count ?? 0) : '-'],
          [fmtM(dist?.median_price)],
        ]
      });
    }
    blocks.push({ type: 'table', props: { width: 1 }, content: { type: 'tableContent', rows: mRows, headerRows: 1, columnWidths: [] } });

    const lastSub = suburbData[suburbData.length - 1];
    if (lastSub && lastSub.price_diff_1yr_pct != null) {
      blocks.push({ type: 'paragraph', content: [`${displayName} median price is ${lastSub.price_diff_1yr_pct >= 0 ? 'up' : 'down'} ${Math.abs(lastSub.price_diff_1yr_pct).toFixed(1)}% year-on-year, with a median of ${fmtM(subMedian)}.`] });
      if (lastSub.days_to_sell != null) {
        blocks.push({ type: 'paragraph', content: [`Average days to sell: ${lastSub.days_to_sell} days.`] });
      }
    }
  } else {
    blocks.push({ type: 'paragraph', content: ['Market trend data is not yet available for this suburb. Upload REINZ data via the Analytics page to populate this section.'] });
  }

  // Page 3: Sales Analysis
  blocks.push({ type: 'heading', props: { level: 2 }, content: ['Sales Analysis'] });

  if (lastSold) {
    blocks.push({ type: 'heading', props: { level: 3 }, content: ['Last Sold Data For Sale'] });
    blocks.push({ type: 'paragraph', content: [`Active listings in ${displayName}: ${lastSold.total} properties`] });
    const lsRows = [
      { cells: [
        ['Period'],
        ['Count'],
        ['%'],
      ]},
      { cells: [
        ['0-3 years'],
        [String(lastSold.bucket_0_3 ?? 0)],
        [lastSold.total > 0 ? `${((lastSold.bucket_0_3 ?? 0) / lastSold.total * 100).toFixed(1)}%` : '0%'],
      ]},
      { cells: [
        ['3-5 years'],
        [String(lastSold.bucket_3_5 ?? 0)],
        [lastSold.total > 0 ? `${((lastSold.bucket_3_5 ?? 0) / lastSold.total * 100).toFixed(1)}%` : '0%'],
      ]},
      { cells: [
        ['5-10 years'],
        [String(lastSold.bucket_5_10 ?? 0)],
        [lastSold.total > 0 ? `${((lastSold.bucket_5_10 ?? 0) / lastSold.total * 100).toFixed(1)}%` : '0%'],
      ]},
      { cells: [
        ['10-15 years'],
        [String(lastSold.bucket_10_15 ?? 0)],
        [lastSold.total > 0 ? `${((lastSold.bucket_10_15 ?? 0) / lastSold.total * 100).toFixed(1)}%` : '0%'],
      ]},
      { cells: [
        ['15+ years'],
        [String(lastSold.bucket_15_plus ?? 0)],
        [lastSold.total > 0 ? `${((lastSold.bucket_15_plus ?? 0) / lastSold.total * 100).toFixed(1)}%` : '0%'],
      ]},
      { cells: [
        ['No data'],
        [String(lastSold.no_data ?? 0)],
        [lastSold.total > 0 ? `${((lastSold.no_data ?? 0) / lastSold.total * 100).toFixed(1)}%` : '0%'],
      ]},
    ];
    blocks.push({ type: 'table', props: { width: 1 }, content: { type: 'tableContent', rows: lsRows, headerRows: 1, columnWidths: [] } });
  } else {
    blocks.push({ type: 'paragraph', content: ['Last sold data is not yet available for this suburb.'] });
  }

  if (campaign) {
    blocks.push({ type: 'heading', props: { level: 3 }, content: ['Direct Mail Campaign Stats'] });
    blocks.push({ type: 'paragraph', content: [`Properties mailed: ${campaign.mailed ?? 0}`] });
    blocks.push({ type: 'paragraph', content: [`Downloads: ${campaign.downloads ?? 0} | Appraisals: ${campaign.appraisals ?? 0} | Conversions: ${campaign.conversions ?? 0}`] });
  }

  return blocks;
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { suburb_id, quarter, start_quarter, end_quarter, report_year, report_month, period_type, start_month, end_month, lead_id, report_name } = body;

    const hasPeriodType = period_type === 'quarter' || period_type === 'month';
    const periodType: ChartPeriodType = period_type === 'month' ? 'month' : 'quarter';
    const pulsePeriodType: 'month' | 'quarter' = hasPeriodType && periodType === 'quarter' ? 'quarter' : 'month';
    const isLeadReport = typeof lead_id === 'string' && lead_id.length > 0;
    const useMetricCharts = isLeadReport && hasPeriodType;

    if (!suburb_id || (periodType === 'quarter' && !quarter)) {
      return NextResponse.json({ success: false, error: 'suburb_id and quarter are required' }, { status: 400 });
    }

    let reportQuarter: string = quarter ?? '';
    let dataStartDate = '';
    let dataEndDate = '';
    let monthEndYM = '';
    let legacyStartQuarter = '';
    let legacyEndQuarter = '';

    if (periodType === 'month') {
      const sm = typeof start_month === 'string' ? start_month : '';
      const em = typeof end_month === 'string' && end_month ? end_month : sm;
      const ymPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
      if (!ymPattern.test(sm) || !ymPattern.test(em)) {
        return NextResponse.json({ success: false, error: 'start_month and end_month are required (YYYY-MM)' }, { status: 400 });
      }
      if (em < sm) {
        return NextResponse.json({ success: false, error: 'start_month must not be after end_month' }, { status: 400 });
      }
      dataStartDate = `${sm}-01`;
      const [endY, endM] = em.split('-').map(Number);
      const nextY = endM === 12 ? endY + 1 : endY;
      const nextM = endM === 12 ? 1 : endM + 1;
      dataEndDate = `${nextY}-${String(nextM).padStart(2, '0')}-01`;
      monthEndYM = em;
      if (!reportQuarter) reportQuarter = `${endY}-Q${Math.ceil(endM / 3)}`;
      legacyStartQuarter = quarterOfMonth(sm);
      legacyEndQuarter = quarterOfMonth(em);
    } else {
      const dataStart = start_quarter || quarter;
      const dataEnd = end_quarter || quarter;
      const startRange = quarterToRange(dataStart);
      if (startRange) {
        dataStartDate = startRange.start;
        dataEndDate = dataEnd && dataEnd !== dataStart
          ? (quarterToRange(dataEnd)?.end ?? startRange.end)
          : startRange.end;
      }
      legacyStartQuarter = dataStart;
      legacyEndQuarter = dataEnd;
    }

    const legacyStartRange = legacyStartQuarter ? quarterToRange(legacyStartQuarter) : null;
    const legacyEndRange = legacyEndQuarter ? quarterToRange(legacyEndQuarter) : null;
    const legacySummary = legacyStartRange && legacyEndRange
      ? {
          startYM: legacyStartRange.start.slice(0, 7),
          endYM: previousMonthYM(legacyEndRange.end),
        }
      : null;

    let reportYear = Number(report_year);
    let reportMonth = Number(report_month);
    if (!Number.isInteger(reportYear) || reportYear < 1990 || reportYear > 2100 ||
        !Number.isInteger(reportMonth) || reportMonth < 1 || reportMonth > 12) {
      if (periodType === 'month' && monthEndYM) {
        const [derivedY, derivedM] = monthEndYM.split('-').map(Number);
        reportYear = derivedY;
        reportMonth = derivedM;
      } else {
        const derived = quarterEndYearMonth(reportQuarter);
        reportYear = derived.year;
        reportMonth = derived.month;
      }
    }

    const storedQuarter = reportDocumentPeriodKey(pulsePeriodType, reportYear, reportMonth, reportQuarter);

    const suburbResult = await marieQuery<{ id: string; name: string }>(
      `SELECT id, name FROM report_suburbs WHERE id = $1`,
      [suburb_id]
    );
    if (suburbResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Suburb not found' }, { status: 404 });
    }
    let suburb = suburbResult.rows[0];
    // North Shore data is stored as 'North Shore City' in market_monthly_snapshots
    if (suburb.name === 'North Shore') {
      suburb = { ...suburb, name: 'North Shore City' };
    }
    const displayName = suburb.name === 'North Shore City' ? 'North Shore' : suburb.name;

    const adminResult = await marieQuery<{ id: string }>(
      `SELECT id FROM admin_users WHERE email = $1 LIMIT 1`,
      [session.user.email]
    );
    const userId = adminResult.rows[0].id;

    // Cover the report period plus its comparison period in one unified data fetch
    const prevMonth = shiftMonth(reportYear, reportMonth, -1);
    let monthlyRangeStart = `${prevMonth.year}-${String(prevMonth.month).padStart(2, '0')}-01`;
    let monthlyRangeEnd = `${reportYear}-${String(reportMonth).padStart(2, '0')}-01`;
    if (pulsePeriodType === 'quarter') {
      const quarterRange = quarterToRange(reportQuarter);
      if (quarterRange) {
        const [rangeStartY, rangeStartM] = quarterRange.start.split('-').map(Number);
        const windowStart = shiftMonth(rangeStartY, rangeStartM, -3);
        monthlyRangeStart = `${windowStart.year}-${String(windowStart.month).padStart(2, '0')}-01`;
        const [rangeEndY, rangeEndM] = quarterRange.end.split('-').map(Number);
        const windowEnd = shiftMonth(rangeEndY, rangeEndM, -1);
        monthlyRangeEnd = `${windowEnd.year}-${String(windowEnd.month).padStart(2, '0')}-01`;
      }
    }

    const metricChartPromise: Promise<(string | null)[]> = useMetricCharts
      ? Promise.all(
          (['sales', 'median_price', 'days_to_sell'] as LeadChartMetric[]).map((metric) =>
            generateMetricChartImageUrl(suburb.name, metric, periodType, dataStartDate, dataEndDate).catch(() => null)
          )
        )
      : Promise.resolve([null, null, null]);

    const legacyChartPromise: Promise<string | null> = useMetricCharts || !legacyStartQuarter || !legacyEndQuarter
      ? Promise.resolve(null)
      : generateChartImageUrl(suburb.name, legacyEndQuarter, legacyStartQuarter, legacyEndQuarter).catch(() => null);

    const trendsStart = useMetricCharts ? dataStartDate : (legacyStartRange?.start ?? dataStartDate);
    const trendsEnd = useMetricCharts ? dataEndDate : (legacyEndRange?.end ?? dataEndDate);

    const [monthlyRaw, marketTrends, lastSold, campaign, chartImageUrl, suburbIntroContent, metricChartUrls] = await Promise.all([
      getMonthlyData([suburb.name], 'North Shore City', monthlyRangeStart, monthlyRangeEnd),
      fetchMarketTrends(suburb.name, trendsStart, trendsEnd),
      fetchLastSoldData(suburb.name),
      fetchCampaignStats(suburb.name),
      legacyChartPromise,
      fetchSuburbIntroduction(suburb_id),
      metricChartPromise,
    ]);

    const chartSection: MetricChartSection | undefined = useMetricCharts
      ? {
          periodType,
          summaryStartYM: dataStartDate.slice(0, 7),
          summaryEndYM: dataEndDate ? previousMonthYM(dataEndDate) : '',
          salesUrl: metricChartUrls[0],
          priceUrl: metricChartUrls[1],
          daysUrl: metricChartUrls[2],
        }
      : undefined;

    const pulse = pulsePeriodType === 'quarter'
      ? computeQuarterlyMarketPulse(monthlyRaw, suburb.name, reportQuarter)
      : computeMarketPulse(monthlyRaw, suburb.name, reportYear, reportMonth);
    const customName = typeof report_name === 'string' ? report_name.trim() : '';
    const title = customName || `${displayName} ${reportYear} Market Report`;
    const legacySummaryForBlocks = hasPeriodType && !useMetricCharts ? legacySummary ?? undefined : undefined;
    const content = buildBlocks(suburb.name, reportQuarter, marketTrends, pulse, lastSold, campaign, chartImageUrl, suburbIntroContent, reportYear, reportMonth, title, pulsePeriodType, chartSection, legacySummaryForBlocks);

    const result = await marieQuery<{ id: string }>(
      `INSERT INTO report_documents (user_id, doc_type, suburb_id, quarter, title, content, lead_id)
       VALUES ($1, 'report', $2, $3, $4, $5, $6) RETURNING id`,
      [userId, suburb_id, storedQuarter, title, JSON.stringify(content), lead_id ?? null]
    );

    if (isLeadReport) {
      try {
        await ensureLeadIntroduction(lead_id, userId);
      } catch (error) {
        console.error('Failed to create lead introduction:', error);
      }
    }

    return NextResponse.json({ success: true, id: result.rows[0].id });
  } catch (error) {
    console.error('Error generating report:', error);
    return NextResponse.json({ success: false, error: 'Failed to generate report' }, { status: 500 });
  }
}

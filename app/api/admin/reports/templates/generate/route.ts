import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query as marieQuery } from '@/lib/db';
import { isAdmin } from '@/lib/permissions';
import { generateChartImageUrl } from '@/lib/report-charts';
import { getMonthlyData } from '@/lib/market-data-aggregator';
import { computeMarketPulse, formatMillions, monthLabel, shiftMonth, type MarketPulseResult } from '@/lib/market-pulse';
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

async function fetchMarketTrends(suburbName: string, startQuarter: string, endQuarter?: string): Promise<TrendRow[] | null> {
  const start = quarterToRange(startQuarter);
  if (!start) return null;
  const startDate = start.start;
  const endDate = endQuarter && endQuarter !== startQuarter
    ? (quarterToRange(endQuarter)?.end ?? start.end)
    : start.end;

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
  reportMonth: number
): unknown[] {
  const blocks: unknown[] = [];
  const displayName = suburbName === 'North Shore City' ? 'North Shore' : suburbName;
  const monthTitle = monthLabel(reportYear, reportMonth);

  // Page 1: Cover
  blocks.push({
    type: 'heading',
    props: { level: 1, textAlignment: 'center' },
    content: [
      { type: 'delta', props: { height: '26px', strokeColor: '#2563eb' } },
      ` ${displayName} ${reportYear} Market Report`,
    ],
  });
  const filteredIntroContent = updateIntroMonthYear(
    filterOutDaysToSellFromIntro(suburbIntroContent),
    reportYear,
    reportMonth
  );
  if (filteredIntroContent && filteredIntroContent.length > 0) {
    blocks.push(...filteredIntroContent);
  }

  // Page 2: Market Pulse — custom monthly card block
  blocks.push({ type: 'heading', props: { level: 2 }, content: [`${displayName} Market Pulse (${monthTitle})`] });

  if (pulse.hasData) {
    blocks.push({ type: 'marketPulse', props: { ...pulse.props } });
    let insight = extractDaysToSellDescription(suburbIntroContent);
    if (pulse.days != null) {
      if (insight) {
        insight = insight.replace(/The average Days to Sell of \d+ days/i, `The average Days to Sell of ${pulse.days} days`);
      } else {
        insight = `The average Days to Sell of ${pulse.days} days during ${monthTitle} reflects current market liquidity.`;
      }
      blocks.push({ type: 'paragraph', content: [insight] });
    }
  } else {
    blocks.push({ type: 'paragraph', content: [`Monthly data is not yet available for ${monthTitle}.`] });
  }

  // Page 3: REINZ Market Trends
  blocks.push({ type: 'heading', props: { level: 2 }, content: ['REINZ Market Trends'] });
  blocks.push({ type: 'paragraph', content: [`Quarterly market data for ${displayName} compared with North Shore.`] });

  if (chartImageUrl) {
    blocks.push({ type: 'image', props: { url: chartImageUrl, caption: '', name: 'Median price trend chart', showPreview: true, previewWidth: 700, textAlignment: 'left', backgroundColor: 'default' } });
    blocks.push({ type: 'paragraph', content: ['Chart: Median price trend — quarterly comparison.'] });
  }

  if (marketTrends && marketTrends.length > 0) {
    const suburbData = marketTrends.filter((r) => r.region_name === suburbName);
    const districtData = marketTrends.filter((r) => r.region_name === 'North Shore City' && r.region_name !== suburbName);

    const [qYear, qStr] = (quarter || '').split('-Q');
    const qNum = parseInt(qStr);
    const firstMonth = !isNaN(qNum) ? ((qNum - 1) * 3 + 1) : 1;
    const qStartYM = `${qYear}-${String(firstMonth).padStart(2, '0')}`;
    const lastMonth = firstMonth + 2;
    const qEndYM = `${Number(qYear) + (lastMonth > 12 ? 1 : 0)}-${String(lastMonth > 12 ? lastMonth - 12 : lastMonth).padStart(2, '0')}`;
    const summaryData = suburbData.filter(r => {
      const ym = getYearMonth(r.period_month);
      return ym >= qStartYM && ym <= qEndYM;
    });
    const summaryDist = districtData.filter(r => {
      const ym = getYearMonth(r.period_month);
      return ym >= qStartYM && ym <= qEndYM;
    });

    const subMedian = agg(summaryData.map(r => r.median_price));
    const subSales = sum(summaryData.map(r => r.sales_count));
    const subDays = agg(summaryData.map(r => r.days_to_sell));
    const distMedian = agg(summaryDist.map(r => r.median_price));
    const distSales = sum(summaryDist.map(r => r.sales_count));
    const distDays = agg(summaryDist.map(r => r.days_to_sell));

    blocks.push({ type: 'heading', props: { level: 3 }, content: ['Quarterly Summary'] });
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
    const { suburb_id, quarter, start_quarter, end_quarter, report_year, report_month } = body;

    const reportQuarter = quarter; // stored on the report row, drives the REINZ quarter range
    const dataStart = start_quarter || quarter; // data query range start
    const dataEnd = end_quarter || quarter; // data query range end

    if (!suburb_id || !reportQuarter) {
      return NextResponse.json({ success: false, error: 'suburb_id and quarter are required' }, { status: 400 });
    }

    let reportYear = Number(report_year);
    let reportMonth = Number(report_month);
    if (!Number.isInteger(reportYear) || reportYear < 1990 || reportYear > 2100 ||
        !Number.isInteger(reportMonth) || reportMonth < 1 || reportMonth > 12) {
      const derived = quarterEndYearMonth(reportQuarter);
      reportYear = derived.year;
      reportMonth = derived.month;
    }

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

    // Cover both report month and previous month in one unified data fetch
    const prevMonth = shiftMonth(reportYear, reportMonth, -1);
    const monthlyRangeStart = `${prevMonth.year}-${String(prevMonth.month).padStart(2, '0')}-01`;
    const monthlyRangeEnd = `${reportYear}-${String(reportMonth).padStart(2, '0')}-01`;

    const [monthlyRaw, marketTrends, lastSold, campaign, chartImageUrl, suburbIntroContent] = await Promise.all([
      getMonthlyData([suburb.name], 'North Shore City', monthlyRangeStart, monthlyRangeEnd),
      fetchMarketTrends(suburb.name, dataStart, dataEnd),
      fetchLastSoldData(suburb.name),
      fetchCampaignStats(suburb.name),
      generateChartImageUrl(suburb.name, reportQuarter, dataStart, dataEnd).catch(() => null),
      fetchSuburbIntroduction(suburb_id),
    ]);

    const pulse = computeMarketPulse(monthlyRaw, suburb.name, reportYear, reportMonth);
    const title = `${displayName} ${reportYear} Market Report`;
    const content = buildBlocks(suburb.name, reportQuarter, marketTrends, pulse, lastSold, campaign, chartImageUrl, suburbIntroContent, reportYear, reportMonth);

    const result = await marieQuery<{ id: string }>(
      `INSERT INTO report_documents (user_id, doc_type, suburb_id, quarter, title, content)
       VALUES ($1, 'report', $2, $3, $4, $5) RETURNING id`,
      [userId, suburb_id, reportQuarter, title, JSON.stringify(content)]
    );

    return NextResponse.json({ success: true, id: result.rows[0].id });
  } catch (error) {
    console.error('Error generating report:', error);
    return NextResponse.json({ success: false, error: 'Failed to generate report' }, { status: 500 });
  }
}

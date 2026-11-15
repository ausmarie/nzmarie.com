import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  query: vi.fn(),
  isSuperAdmin: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ auth: mocks.auth }));
vi.mock('@/lib/db', () => ({ query: mocks.query }));
vi.mock('@/lib/permissions', () => ({ isSuperAdmin: mocks.isSuperAdmin }));
vi.mock('@/components/market/MarketReportArticle', () => ({
  default: (props: unknown) => props,
}));

import { GET, POST } from '@/app/api/admin/market-reports/route';
import { DELETE as deleteMarketReport, PUT } from '@/app/api/admin/market-reports/[id]/route';
import { POST as publishReport } from '@/app/api/admin/market-reports/[id]/publish/route';
import { POST as regenerateReport } from '@/app/api/admin/market-reports/[id]/regenerate/route';
import { POST as withdrawReport } from '@/app/api/admin/market-reports/[id]/withdraw/route';
import { GET as getPublicMarketReports } from '@/app/api/market-reports/route';
import MarketReportPreviewPage from '@/app/market-reports/preview/[id]/page';

const reportId = '11111111-1111-4111-8111-111111111111';
const validContent = [{ type: 'paragraph', content: [{ type: 'text', text: 'North Shore market commentary', styles: {} }] }];

function request(body: unknown, method = 'POST'): Request {
  return new Request('http://localhost/api/admin/market-reports', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function context(id = reportId) {
  return { params: Promise.resolve({ id }) };
}

describe('Market reports API', () => {
  beforeEach(() => {
    mocks.auth.mockReset();
    mocks.query.mockReset();
    mocks.isSuperAdmin.mockReset();
    mocks.auth.mockResolvedValue({ user: { email: 'admin@example.com' } });
    mocks.isSuperAdmin.mockReturnValue(true);
  });

  it('does not expose the report list to unauthorized users', async () => {
    mocks.isSuperAdmin.mockReturnValue(false);

    const response = await GET();

    expect(response.status).toBe(403);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it('rejects invalid monthly and quarterly period keys before database access', async () => {
    const monthly = await POST(request({ periodType: 'monthly', periodKey: '2026-13' }));
    const quarterly = await POST(request({ periodType: 'quarterly', periodKey: '2026-Q5' }));

    expect(monthly.status).toBe(400);
    expect(quarterly.status).toBe(400);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it('rejects a reversed chart data range', async () => {
    const response = await POST(request({
      periodType: 'quarterly',
      periodKey: '2026-Q2',
      dataStartKey: '2026-Q4',
      dataEndKey: '2026-Q2',
    }));

    expect(response.status).toBe(400);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it('supports separate monthly charts for a quarterly KPI report', async () => {
    mocks.query
      .mockResolvedValueOnce({
        rows: [
          { region_name: 'North Shore City', period_month: '2025-12-01', median_price: '1100000', sales_count: '30', days_to_sell: '50' },
          { region_name: 'North Shore City', period_month: '2026-01-01', median_price: '1000000', sales_count: '10', days_to_sell: '40' },
          { region_name: 'Auckland Region', period_month: '2025-12-01', median_price: '1300000', sales_count: '45', days_to_sell: '55' },
          { region_name: 'Auckland Region', period_month: '2026-01-01', median_price: '1400000', sales_count: '50', days_to_sell: '52' },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: reportId }] });

    const response = await POST(request({
      periodType: 'quarterly',
      periodKey: '2026-Q1',
      chartPeriodType: 'monthly',
      dataStartKey: '2025-12',
      dataEndKey: '2026-01',
    }));
    const body = await response.json();
    const savedContent = JSON.parse(mocks.query.mock.calls[2][1][3]);

    expect(response.status).toBe(201);
    expect(body.snapshot.periodType).toBe('quarterly');
    expect(body.snapshot.chartPeriodType).toBe('monthly');
    expect(body.snapshot.charts.salesCount).toHaveLength(2);
    expect(mocks.query.mock.calls[0][1]).toEqual([
      ['North Shore City'],
      ['Auckland Region', 'Auckland'],
      'House',
      '2025-10-01',
      '2026-04-01',
    ]);
    expect(savedContent.filter((block: { type: string }) => block.type === 'marketPulse')).toHaveLength(1);
    const charts = savedContent.filter((block: { type: string }) => block.type === 'image');
    expect(charts).toHaveLength(3);
    const expectedTitles = [
      'Median Price - North Shore vs Auckland Region',
      'Number of Sales - North Shore vs Auckland Region',
      'Days to Sell - North Shore vs Auckland Region',
    ];
    expect(charts.map((chart: { props: { caption: string } }) => chart.props.caption)).toEqual(expectedTitles);
    const northShoreColors = ['#2348c5', '#059669', '#d97706'];
    for (const [index, chart] of charts.entries()) {
      const svg = decodeURIComponent(chart.props.url.replace('data:image/svg+xml,', ''));
      expect(svg).toContain(expectedTitles[index]);
      expect(svg).toContain(' C ');
      expect(svg).toContain(`stroke="${northShoreColors[index]}"`);
      expect(svg).toContain('stroke="#94a3b8"');
      expect(svg).toContain('stroke-dasharray="8 7"');
      expect(svg).toContain('Auckland Region');
    }
    const pulse = savedContent.find((block: { type: string }) => block.type === 'marketPulse');
    expect(pulse.props.compareLabel).toBe('Compared to Previous Quarter (Q4 2025)');
    expect(pulse.props.priceNote).toBe('Auckland Region Price: $1.4M');
    expect(pulse.props.card2Note).toBe('Auckland Region Sold: 50');
    expect(pulse.props.districtLine).toBe('Auckland Region Avg: 52 Days');
  });

  it('generates and stores a monthly data snapshot from North Shore Analytics', async () => {
    mocks.query
      .mockResolvedValueOnce({
        rows: [
          { period_month: '2026-09-01', median_price: '1158000', sales_count: '285', days_to_sell: '50' },
          { period_month: '2026-10-01', median_price: '1130000', sales_count: '260', days_to_sell: '43' },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: reportId }] });

    const response = await POST(request({ periodType: 'monthly', periodKey: '2026-10' }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.snapshot.metrics).toEqual({ medianPrice: 1130000, salesCount: 260, daysToSell: 43 });
    expect(body.snapshot.comparison).toEqual({
      label: 'Compared to September',
      medianPriceChange: '-2.4%',
      salesCountChange: '-8.8%',
      daysToSellChange: '-7',
    });
    expect(body.snapshot.charts.medianPrice).toHaveLength(12);
    expect(body.snapshot.charts.salesCount).toHaveLength(12);
    expect(body.snapshot.charts.daysToSell).toHaveLength(12);
    expect(mocks.query.mock.calls[0][1]).toEqual([
      ['North Shore City'],
      ['Auckland Region', 'Auckland'],
      'House',
      '2025-11-01',
      '2026-11-01',
    ]);
    expect(mocks.query.mock.calls[2][1][0]).toBe('monthly');
  });

  it('refreshes an existing period while preserving its editorial content and published revision', async () => {
    mocks.query
      .mockResolvedValueOnce({
        rows: [
          { period_month: '2026-09-01', median_price: '1000000', sales_count: '285', days_to_sell: '50' },
          { period_month: '2026-10-01', median_price: '1130000', sales_count: '260', days_to_sell: '43' },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{
          id: reportId,
          title: 'Marie’s October market update',
          content: validContent,
          status: 'published',
        }],
      })
      .mockResolvedValueOnce({ rows: [{ id: reportId }] });

    const response = await POST(request({ periodType: 'monthly', periodKey: '2026-10' }));
    const body = await response.json();
    const updatedContent = JSON.parse(mocks.query.mock.calls[2][1][2]);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ success: true, id: reportId, reused: true });
    expect(body.snapshot.comparison.label).toBe('Compared to September');
    expect(mocks.query.mock.calls[1][1]).toEqual(['monthly', '2026-10']);
    expect(mocks.query.mock.calls[2][0]).toContain("has_unpublished_changes = CASE WHEN status = 'draft' THEN FALSE ELSE TRUE END");
    expect(mocks.query.mock.calls[2][0]).not.toContain('published_content =');
    expect(mocks.query.mock.calls[2][1][1]).toBe('Marie’s October market update');
    expect(updatedContent.some((block: { content?: Array<{ text?: string }> }) =>
      block.content?.some((item) => item.text === 'North Shore market commentary'),
    )).toBe(true);
    expect(updatedContent.find((block: { type: string }) => block.type === 'marketPulse').props.compareLabel)
      .toBe('Compared to September');
  });

  it('generates a report using the selected data range and report name', async () => {
    mocks.query
      .mockResolvedValueOnce({
        rows: [
          { period_month: '2025-01-01', median_price: '1000000', sales_count: '20', days_to_sell: '40' },
          { period_month: '2026-10-01', median_price: '1130000', sales_count: '260', days_to_sell: '43' },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: reportId }] });

    const response = await POST(request({
      title: 'North Shore Market Report — October 2026',
      periodType: 'monthly',
      periodKey: '2026-10',
      dataStartKey: '2025-01',
      dataEndKey: '2026-10',
    }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.snapshot.dataRange).toEqual({ startPeriodKey: '2025-01', endPeriodKey: '2026-10' });
    expect(body.snapshot.charts.salesCount).toHaveLength(22);
    expect(mocks.query.mock.calls[0][1]).toEqual([
      ['North Shore City'],
      ['Auckland Region', 'Auckland'],
      'House',
      '2025-01-01',
      '2026-11-01',
    ]);
    expect(mocks.query.mock.calls[2][1][2]).toBe('North Shore Market Report — October 2026');
  });

  it('keeps the saved chart range when regenerating Analytics data', async () => {
    mocks.query
      .mockResolvedValueOnce({
        rows: [{
          period_type: 'monthly',
          period_key: '2026-10',
          data_snapshot: { dataRange: { startPeriodKey: '2025-01', endPeriodKey: '2026-10' } },
          content: validContent,
        }],
      })
      .mockResolvedValueOnce({
        rows: [
          { region_name: 'North Shore City', period_month: '2025-01-01', median_price: '1000000', sales_count: '20', days_to_sell: '40' },
          { region_name: 'North Shore City', period_month: '2026-10-01', median_price: '1130000', sales_count: '260', days_to_sell: '43' },
          { region_name: 'Auckland Region', period_month: '2025-01-01', median_price: '1400000', sales_count: '30', days_to_sell: '45' },
          { region_name: 'Auckland Region', period_month: '2026-10-01', median_price: '1600000', sales_count: '50', days_to_sell: '42' },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ updated_at: '2026-11-14T01:00:00Z', status: 'draft', has_unpublished_changes: false }],
      });

    const response = await regenerateReport(new Request('http://localhost'), context());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.snapshot.dataRange).toEqual({ startPeriodKey: '2025-01', endPeriodKey: '2026-10' });
    expect(mocks.query.mock.calls[1][1]).toEqual([
      ['North Shore City'],
      ['Auckland Region', 'Auckland'],
      'House',
      '2025-01-01',
      '2026-11-01',
    ]);
    expect(mocks.query.mock.calls[0][0]).toContain('content');
    expect(mocks.query.mock.calls[2][0]).toContain('content = $3::jsonb');
    expect(mocks.query.mock.calls[2][1][3]).toBe('admin@example.com');
    const updatedContent = JSON.parse(mocks.query.mock.calls[2][1][2]);
    const charts = updatedContent.filter((block: { type: string }) => block.type === 'image');
    expect(charts).toHaveLength(3);
    for (const chart of charts) {
      const svg = decodeURIComponent(chart.props.url.replace('data:image/svg+xml,', ''));
      expect(svg).toContain('stroke="#94a3b8"');
      expect(svg).toContain('stroke-dasharray="8 7"');
      expect(svg).toContain('Auckland Region');
    }
    expect(updatedContent.some((block: { content?: Array<{ text?: string }> }) =>
      block.content?.some((item) => item.text === 'North Shore market commentary'),
    )).toBe(true);
    const pulse = updatedContent.find((block: { type: string }) => block.type === 'marketPulse');
    expect(pulse.props.priceNote).toBe('Auckland Region Price: $1.6M');
    expect(pulse.props.card2Note).toBe('Auckland Region Sold: 50');
    expect(pulse.props.districtLine).toBe('Auckland Region Avg: 42 Days');
  });

  it('does not create a report when Analytics has no data for the selected period', async () => {
    mocks.query.mockResolvedValueOnce({ rows: [] });

    const response = await POST(request({ periodType: 'monthly', periodKey: '2026-11' }));
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.error).toContain('No North Shore house market data');
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });

  it('requires rich-text blocks when saving a draft', async () => {
    const response = await PUT(request({ title: 'October report', summary: 'Summary', content: 'not blocks' }, 'PUT'), context());

    expect(response.status).toBe(400);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it('saves edits to the draft while preserving the previous published revision', async () => {
    mocks.query.mockResolvedValueOnce({
      rows: [{ status: 'published', has_unpublished_changes: true, updated_at: '2026-11-14T00:00:00Z' }],
    });

    const response = await PUT(request({
      title: 'Updated report',
      summary: 'Updated summary',
      content: validContent,
    }, 'PUT'), context());

    expect(response.status).toBe(200);
    const [sql] = mocks.query.mock.calls[0];
    expect(sql).toContain('has_unpublished_changes = CASE WHEN status =');
    expect(sql).not.toContain('published_content =');
  });

  it('deletes a report only for an authorized admin and validates its id', async () => {
    mocks.isSuperAdmin.mockReturnValue(false);
    const forbidden = await deleteMarketReport(new Request('http://localhost'), context());
    expect(forbidden.status).toBe(403);
    expect(mocks.query).not.toHaveBeenCalled();

    mocks.isSuperAdmin.mockReturnValue(true);
    const invalid = await deleteMarketReport(new Request('http://localhost'), context('not-a-uuid'));
    expect(invalid.status).toBe(400);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it('deletes the selected Market report and returns not found for a missing report', async () => {
    mocks.query.mockResolvedValueOnce({ rows: [{ id: reportId }] });

    const response = await deleteMarketReport(new Request('http://localhost'), context());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(mocks.query.mock.calls[0][0]).toContain('DELETE FROM north_shore_market_reports WHERE id = $1');
    expect(mocks.query.mock.calls[0][1]).toEqual([reportId]);

    mocks.query.mockResolvedValueOnce({ rows: [] });
    const missing = await deleteMarketReport(new Request('http://localhost'), context());
    expect(missing.status).toBe(404);
  });

  it('requires both an introduction and editorial text before publishing', async () => {
    mocks.query.mockResolvedValueOnce({
      rows: [{ title: 'October report', summary: '', content: validContent, data_snapshot: {}, updated_at: '2026-11-14T00:00:00Z' }],
    });

    const response = await publishReport(new Request('http://localhost'), context());

    expect(response.status).toBe(400);
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });

  it('publishes the current draft as a separate public revision', async () => {
    mocks.query
      .mockResolvedValueOnce({
        rows: [{
          title: 'October report',
          summary: 'A clear overview.',
          content: validContent,
          data_snapshot: { periodKey: '2026-10' },
          updated_at: '2026-11-14T00:00:00Z',
        }],
      })
      .mockResolvedValueOnce({
        rows: [{ id: reportId, status: 'published', published_at: '2026-11-14T01:00:00Z', updated_at: '2026-11-14T01:00:00Z' }],
      });

    const response = await publishReport(new Request('http://localhost'), context());

    expect(response.status).toBe(200);
    expect(mocks.query.mock.calls[1][0]).toContain('published_content = content');
    expect(mocks.query.mock.calls[1][0]).toContain('published_data_snapshot = data_snapshot');
  });

  it('only withdraws published reports and preserves their saved content', async () => {
    mocks.query.mockResolvedValueOnce({ rows: [] });

    const response = await withdrawReport(new Request('http://localhost'), context());
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toContain('Only a published report');
    expect(mocks.query.mock.calls[0][0]).toContain("WHERE id = $1 AND status = 'published'");
    expect(mocks.query.mock.calls[0][0]).not.toContain('DELETE');
  });

  it('returns the latest published issue and does not expose draft records', async () => {
    mocks.query.mockResolvedValueOnce({
      rows: [
        {
          id: 'october',
          period_type: 'monthly',
          period_key: '2026-10',
          status: 'published',
          title: 'October report',
          summary: 'Public summary',
          content: validContent,
          data_snapshot: { periodKey: '2026-10' },
          published_at: '2026-11-14T00:00:00Z',
        },
        {
          id: 'draft',
          period_type: 'monthly',
          period_key: '2026-11',
          status: 'draft',
          title: 'Private draft',
          summary: '',
          content: [],
          data_snapshot: {},
          published_at: null,
        },
      ],
    });

    const response = await getPublicMarketReports();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.latest.id).toBe('october');
    expect(body.previousReports).toEqual([]);
    expect(body.notice).toBeNull();
    expect(mocks.query.mock.calls[0][0]).toContain("WHERE status IN ('published', 'withdrawn')");
  });

  it('returns a polite notice when the newest published issue was withdrawn', async () => {
    mocks.query.mockResolvedValueOnce({
      rows: [
        {
          id: 'withdrawn',
          period_type: 'monthly',
          period_key: '2026-10',
          status: 'withdrawn',
          title: 'Withdrawn title',
          summary: 'Private withdrawn summary',
          content: validContent,
          data_snapshot: { periodKey: '2026-10' },
          published_at: '2026-11-14T00:00:00Z',
        },
        {
          id: 'previous',
          period_type: 'monthly',
          period_key: '2026-09',
          status: 'published',
          title: 'September report',
          summary: 'Older public summary',
          content: validContent,
          data_snapshot: { periodKey: '2026-09' },
          published_at: '2026-10-14T00:00:00Z',
        },
      ],
    });

    const body = await (await getPublicMarketReports()).json();

    expect(body.latest).toBeNull();
    expect(body.notice.reason).toBe('withdrawn');
    expect(body.notice.zh).toContain('欢迎稍后再来查看');
    expect(body.previousReports.map((report: { id: string }) => report.id)).toEqual(['previous']);
    expect(JSON.stringify(body)).not.toContain('Private withdrawn summary');
  });

  it('renders the authenticated preview from the dedicated North Shore report table', async () => {
    mocks.query.mockResolvedValueOnce({
      rows: [{
        title: 'October preview',
        summary: 'Preview summary',
        content: validContent,
        data_snapshot: { periodKey: '2026-10' },
        published_at: null,
      }],
    });

    const page = await MarketReportPreviewPage({ params: Promise.resolve({ id: reportId }) });

    expect(page.props.report.title).toBe('October preview');
    expect(mocks.query.mock.calls[0][0]).toContain('FROM north_shore_market_reports');
  });
});

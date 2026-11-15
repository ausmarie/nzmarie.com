import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  query: vi.fn(),
  downloadFromR2: vi.fn(),
  uploadToR2: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ auth: mocks.auth }));
vi.mock('@/lib/db', () => ({ query: mocks.query }));
vi.mock('@/lib/permissions', () => ({ isAdmin: () => true }));
vi.mock('@/lib/r2-storage', () => ({
  downloadFromR2: mocks.downloadFromR2,
  isR2Mock: false,
  R2_PUBLIC_DOMAIN: 'https://reports.nzmarie.com',
  uploadToR2: mocks.uploadToR2,
}));

import { POST } from '../../../app/api/admin/reports/documents/[id]/refresh-chart-title/route';

const legacySvg = '<svg><path d="M1 2"/><text x="350" y="22" text-anchor="middle">Browns Bay vs North Shore - Median Price</text></svg>';

describe('POST /api/admin/reports/documents/[id]/refresh-chart-title', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { email: 'admin@example.com' } });
  });

  it('updates the stored SVG and existing report content without creating a report', async () => {
    mocks.query
      .mockResolvedValueOnce({
        rows: [{
          doc_type: 'report',
          lead_id: null,
          suburb_name: 'Browns Bay',
          content: [{
            type: 'image',
            props: {
              name: 'Browns Bay vs North Shore - Median Price',
              url: 'https://reports.nzmarie.com/charts/browns-bay-2025-Q1-2026-Q4-median-trend.svg?v=old',
            },
          }],
        }],
      })
      .mockResolvedValueOnce({ rows: [{ id: 'report-1' }] });
    mocks.downloadFromR2.mockResolvedValue(Buffer.from(legacySvg));
    mocks.uploadToR2.mockResolvedValue('charts/browns-bay-2025-Q1-2026-Q4-median-trend.svg');

    const response = await POST(new Request('http://localhost'), {
      params: Promise.resolve({ id: 'report-1' }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ success: true, updated: 1 });
    expect(mocks.downloadFromR2).toHaveBeenCalledWith(
      'charts/browns-bay-2025-Q1-2026-Q4-median-trend.svg',
    );
    expect(mocks.uploadToR2).toHaveBeenCalledWith(
      'charts/browns-bay-2025-Q1-2026-Q4-median-trend.svg',
      expect.any(Buffer),
      'image/svg+xml',
      'public, max-age=0, must-revalidate',
    );
    const [updateSql, updateParams] = mocks.query.mock.calls[1] as [string, unknown[]];
    expect(updateSql).toContain('UPDATE report_documents');
    expect(updateSql).not.toContain('INSERT');
    const savedContent = JSON.parse(updateParams[1] as string);
    expect(savedContent[0].props.name).toBe('Median Price - Browns Bay vs North Shore');
    expect(savedContent[0].props.url).toContain('?v=');
  });

  it('refuses lead documents without touching chart storage', async () => {
    mocks.query.mockResolvedValueOnce({
      rows: [{
        doc_type: 'report',
        lead_id: 'lead-1',
        suburb_name: 'Browns Bay',
        content: [],
      }],
    });

    const response = await POST(new Request('http://localhost'), {
      params: Promise.resolve({ id: 'lead-report-1' }),
    });

    expect(response.status).toBe(400);
    expect(mocks.downloadFromR2).not.toHaveBeenCalled();
    expect(mocks.uploadToR2).not.toHaveBeenCalled();
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });

  it('updates median-price metric charts as well as legacy trend charts', async () => {
    const key = 'charts/browns-bay-median_price-quarter-2025-01-01-to-2026-01-01.svg';
    mocks.query
      .mockResolvedValueOnce({
        rows: [{
          doc_type: 'report',
          lead_id: null,
          suburb_name: 'Browns Bay',
          content: [{
            type: 'image',
            props: {
              name: 'Median sale price chart',
              url: `https://reports.nzmarie.com/${key}?v=old`,
            },
          }],
        }],
      })
      .mockResolvedValueOnce({ rows: [{ id: 'report-2' }] });
    mocks.downloadFromR2.mockResolvedValue(
      Buffer.from('<svg><text x="350" y="26">Browns Bay vs North Shore - Median Price</text></svg>'),
    );

    const response = await POST(new Request('http://localhost'), {
      params: Promise.resolve({ id: 'report-2' }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ success: true, updated: 1 });
    expect(mocks.downloadFromR2).toHaveBeenCalledWith(key);
    expect(mocks.uploadToR2).toHaveBeenCalledWith(
      key,
      expect.any(Buffer),
      'image/svg+xml',
      'public, max-age=0, must-revalidate',
    );
  });
});

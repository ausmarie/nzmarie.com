import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getMarketReportAdminEmail, isUuid } from '@/lib/market-report-access';

export const dynamic = 'force-dynamic';

function hasWrittenParagraph(content: unknown): boolean {
  if (!Array.isArray(content)) return false;
  const collectText = (value: unknown): string => {
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return value.map(collectText).join(' ');
    if (value && typeof value === 'object') {
      const item = value as Record<string, unknown>;
      return `${collectText(item.text)} ${collectText(item.content)} ${collectText(item.children)}`;
    }
    return '';
  };
  return content.some((block) =>
    block
    && typeof block === 'object'
    && (block as Record<string, unknown>).type === 'paragraph'
    && collectText((block as Record<string, unknown>).content).trim().length > 0,
  );
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const email = await getMarketReportAdminEmail();
  if (!email) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ success: false, error: 'Invalid report id.' }, { status: 400 });

  try {
    const existing = await query(
      `SELECT title, content, footer, data_snapshot, updated_at::text AS updated_at
       FROM north_shore_market_reports
       WHERE id = $1`,
      [id]
    );
    const report = existing.rows[0];
    if (!report) return NextResponse.json({ success: false, error: 'Report not found.' }, { status: 404 });
    if (!String(report.title || '').trim()) {
      return NextResponse.json({
        success: false,
        error: 'A report title is required before publishing.',
      }, { status: 400 });
    }
    if (!hasWrittenParagraph(report.content)) {
      return NextResponse.json({
        success: false,
        error: 'Add at least one paragraph of report text before publishing.',
      }, { status: 400 });
    }

    const published = await query(
      `UPDATE north_shore_market_reports
       SET status = 'published',
           has_unpublished_changes = FALSE,
           published_title = title,
           published_summary = summary,
           published_content = content,
           published_footer = footer,
           published_data_snapshot = data_snapshot,
           published_at = NOW(),
           withdrawn_at = NULL,
           updated_by = $3,
           updated_at = NOW()
       WHERE id = $1 AND updated_at = $2
       RETURNING id, status, published_at, updated_at`,
      [id, report.updated_at, email]
    );
    if (published.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'The report changed while publishing. Reload and try again.' }, { status: 409 });
    }
    return NextResponse.json({ success: true, ...published.rows[0] });
  } catch (error) {
    console.error('Failed to publish Market report:', error);
    return NextResponse.json({ success: false, error: 'Failed to publish Market report.' }, { status: 500 });
  }
}

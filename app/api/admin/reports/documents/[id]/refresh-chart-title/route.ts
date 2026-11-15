import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query as marieQuery } from '@/lib/db';
import { isAdmin } from '@/lib/permissions';
import {
  legacyMedianPriceChartTitle,
  updateLegacyMedianPriceChartTitle,
} from '@/lib/report-charts';
import {
  downloadFromR2,
  isR2Mock,
  R2_PUBLIC_DOMAIN,
  uploadToR2,
} from '@/lib/r2-storage';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

function getLegacyChartKey(imageUrl: string): string | null {
  try {
    const url = new URL(imageUrl);
    const publicDomain = new URL(R2_PUBLIC_DOMAIN);
    if (url.origin !== publicDomain.origin) return null;

    let path = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
    const domainPath = decodeURIComponent(publicDomain.pathname.replace(/^\/+|\/+$/g, ''));
    if (domainPath && path.startsWith(`${domainPath}/`)) path = path.slice(domainPath.length + 1);

    const isLegacyTrend = path.endsWith('-median-trend.svg');
    const isMedianMetric = /-median_price-(?:quarter|month)-.+\.svg$/.test(path);
    return path.startsWith('charts/') && (isLegacyTrend || isMedianMetric) ? path : null;
  } catch {
    return null;
  }
}

export async function POST(_request: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (isR2Mock) {
    return NextResponse.json({ success: false, error: 'Chart storage is not configured.' }, { status: 503 });
  }

  const { id } = await params;
  try {
    const result = await marieQuery<{
      doc_type: string;
      lead_id: string | null;
      content: unknown;
      suburb_name: string | null;
    }>(
      `SELECT rd.doc_type, rd.lead_id, rd.content, rs.name AS suburb_name
       FROM report_documents rd
       LEFT JOIN report_suburbs rs ON rd.suburb_id = rs.id
       WHERE rd.id = $1`,
      [id]
    );
    const document = result.rows[0];
    if (!document) return NextResponse.json({ success: false, error: 'Report not found.' }, { status: 404 });
    if (document.doc_type !== 'report' || document.lead_id || !document.suburb_name) {
      return NextResponse.json({ success: false, error: 'This document does not support this chart update.' }, { status: 400 });
    }

    const content = typeof document.content === 'string'
      ? JSON.parse(document.content) as unknown
      : document.content;
    if (!Array.isArray(content)) {
      return NextResponse.json({ success: false, error: 'Report content is not a valid block list.' }, { status: 422 });
    }

    const updatedContent: unknown[] = content.slice();
    let foundChart = false;
    let updated = 0;
    for (const [index, item] of content.entries()) {
      if (!item || typeof item !== 'object') continue;
      const block = item as Record<string, unknown>;
      if (block.type !== 'image' || !block.props || typeof block.props !== 'object') continue;
      const props = block.props as Record<string, unknown>;
      if (typeof props.url !== 'string') continue;
      const key = getLegacyChartKey(props.url);
      if (!key) continue;
      foundChart = true;

      const svg = (await downloadFromR2(key)).toString('utf8');
      const nextSvg = updateLegacyMedianPriceChartTitle(svg, document.suburb_name);
      if (nextSvg === svg) continue;

      await uploadToR2(
        key,
        Buffer.from(nextSvg, 'utf8'),
        'image/svg+xml',
        'public, max-age=0, must-revalidate',
      );
      const newTitle = legacyMedianPriceChartTitle(document.suburb_name);
      updatedContent[index] = {
        ...block,
        props: {
          ...props,
          url: `${R2_PUBLIC_DOMAIN.replace(/\/+$/, '')}/${key}?v=${Date.now()}`,
          name: newTitle,
        },
      };
      updated++;
    }

    if (!foundChart) {
      return NextResponse.json({ success: false, error: 'No saved median-price trend chart was found.' }, { status: 409 });
    }
    if (updated === 0) {
      return NextResponse.json({ success: true, updated: 0, message: 'The chart title is already updated.' });
    }

    const saved = await marieQuery(
      `UPDATE report_documents SET content = $2, updated_at = NOW() WHERE id = $1 RETURNING id`,
      [id, JSON.stringify(updatedContent)]
    );
    if (saved.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Report not found.' }, { status: 404 });
    }
    return NextResponse.json({ success: true, updated });
  } catch (error) {
    console.error('Failed to update saved report chart title:', error);
    return NextResponse.json({ success: false, error: 'Failed to update the saved chart title.' }, { status: 500 });
  }
}

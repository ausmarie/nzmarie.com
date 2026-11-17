import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { isUuid } from '@/lib/uuid';
import { marketReportUrl, parseMarketReportSlug } from '@/lib/market-report-url';
import { isValidBlogSlug } from '@/lib/blog-data';

export const dynamic = 'force-dynamic';

type PageViewPayload =
  | {
    eventId: string;
    pageType: 'home';
    language: 'en' | 'zh';
  }
  | {
    eventId: string;
    pageType: 'market_report';
    language: 'en' | 'zh';
    slug: string;
  }
  | {
    eventId: string;
    pageType: 'blog_article';
    language: 'en' | 'zh';
    slug: string;
  };

function isPageViewPayload(value: unknown): value is PageViewPayload {
  if (!value || typeof value !== 'object') return false;
  const body = value as Record<string, unknown>;
  if (!isUuid(typeof body.eventId === 'string' ? body.eventId : '')
    || (body.language !== 'en' && body.language !== 'zh')) return false;
  if (body.pageType === 'home') return body.slug === undefined;
  return (body.pageType === 'market_report' || body.pageType === 'blog_article')
    && typeof body.slug === 'string';
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'A valid JSON request body is required.' }, { status: 400 });
  }
  if (!isPageViewPayload(body)) {
    return NextResponse.json({ success: false, error: 'Invalid page-view event.' }, { status: 400 });
  }

  try {
    if (body.pageType === 'home') {
      const pagePath = body.language === 'zh' ? '/cn' : '/';
      await query(
        `INSERT INTO page_view_events (event_id, page_type, report_id, language, page_path)
         VALUES ($1::uuid, 'home', NULL, $2, $3)
         ON CONFLICT (event_id) DO NOTHING`,
        [body.eventId, body.language, pagePath],
      );
      return new NextResponse(null, { status: 204 });
    }

    if (body.pageType === 'blog_article') {
      if (!isValidBlogSlug(body.slug)) {
        return NextResponse.json({ success: false, error: 'Invalid Blog article.' }, { status: 400 });
      }
      const pagePath = `/blog/${body.slug}`;
      await query(
        `INSERT INTO page_view_events (event_id, page_type, report_id, blog_post_id, language, page_path)
         SELECT $1::uuid, 'blog_article', NULL, id, $3, $4
         FROM blog_posts
         WHERE published_slug = $2 AND status = 'published'
         ON CONFLICT (event_id) DO NOTHING`,
        [body.eventId, body.slug, body.language, pagePath],
      );
      return new NextResponse(null, { status: 204 });
    }

    const period = parseMarketReportSlug(body.slug);
    if (!period) {
      return NextResponse.json({ success: false, error: 'Invalid Market report.' }, { status: 400 });
    }
    const pagePath = marketReportUrl({
      period_type: period.periodType,
      period_key: period.periodKey,
      status: 'published',
      language: body.language,
    });
    await query(
      `INSERT INTO page_view_events (event_id, page_type, report_id, language, page_path)
       SELECT $1::uuid, 'market_report', id, $4, $5
       FROM north_shore_market_reports
       WHERE period_type = $2 AND period_key = $3
         AND language = $4 AND status = 'published'
       ON CONFLICT (event_id) DO NOTHING`,
      [body.eventId, period.periodType, period.periodKey, body.language, pagePath],
    );
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Failed to record page view:', error);
    return NextResponse.json({ success: false, error: 'Failed to record page view.' }, { status: 500 });
  }
}

import type { Redis } from '@upstash/redis';
import { query } from '@/lib/db';
import { blogArticlePath, isValidBlogSlug } from '@/lib/blog-data';
import { marketReportUrl, parseMarketReportSlug } from '@/lib/market-report-url';
import { isUuid } from '@/lib/uuid';
import { redis } from '@/lib/redis';

const PAGE_VIEW_STREAM = 'page-view-events';
const PAGE_VIEW_GROUP = 'page-view-database-writer';
const PAGE_VIEW_CONSUMER = 'vercel-cron';
const PAGE_VIEW_BATCH_SIZE = 100;

export type PageViewPayload =
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

interface QueuedPageView {
  id: string;
  payload: unknown;
}

interface NormalizedPageView {
  eventId: string;
  pageType: PageViewPayload['pageType'];
  language: PageViewPayload['language'];
  pagePath: string;
  slug?: string;
  periodType?: string;
  periodKey?: string;
}

function getRedis(): Redis {
  if (!redis) throw new Error('Redis is not configured for page-view events.');
  return redis;
}

export function isPageViewPayload(value: unknown): value is PageViewPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const body = value as Record<string, unknown>;
  if (!isUuid(typeof body.eventId === 'string' ? body.eventId : '')
    || (body.language !== 'en' && body.language !== 'zh')) return false;

  if (body.pageType === 'home') return body.slug === undefined;
  if (body.pageType === 'blog_article') {
    return typeof body.slug === 'string' && isValidBlogSlug(body.slug);
  }
  if (body.pageType === 'market_report' && typeof body.slug === 'string') {
    return parseMarketReportSlug(body.slug) !== null;
  }
  return false;
}

export async function enqueuePageViewEvent(event: PageViewPayload): Promise<void> {
  await getRedis().xadd(PAGE_VIEW_STREAM, '*', { payload: JSON.stringify(event) });
}

function readStreamMessages(result: unknown): QueuedPageView[] {
  if (result === null) return [];
  if (!Array.isArray(result)) throw new Error('Unexpected Redis page-view stream response.');

  const messages: QueuedPageView[] = [];
  for (const stream of result) {
    if (!Array.isArray(stream) || stream[0] !== PAGE_VIEW_STREAM || !Array.isArray(stream[1])) {
      throw new Error('Unexpected Redis page-view stream response.');
    }

    for (const entry of stream[1]) {
      if (!Array.isArray(entry) || typeof entry[0] !== 'string' || !Array.isArray(entry[1])) {
        throw new Error('Unexpected Redis page-view stream entry.');
      }

      let payload: unknown = null;
      const fields = entry[1] as unknown[];
      for (let index = 0; index + 1 < fields.length; index += 2) {
        const key = fields[index];
        if (key === 'payload') {
          payload = fields[index + 1];
          break;
        }
      }
      messages.push({ id: entry[0], payload });
    }
  }
  return messages;
}

function normalizeEvent(event: PageViewPayload): NormalizedPageView {
  if (event.pageType === 'home') {
    return {
      eventId: event.eventId,
      pageType: event.pageType,
      language: event.language,
      pagePath: event.language === 'zh' ? '/cn' : '/',
    };
  }

  if (event.pageType === 'blog_article') {
    return {
      eventId: event.eventId,
      pageType: event.pageType,
      language: event.language,
      pagePath: blogArticlePath(event.slug, event.language === 'zh' ? 'cn' : 'en'),
      slug: event.slug,
    };
  }

  const period = parseMarketReportSlug(event.slug);
  if (!period) throw new Error('Invalid Market report slug in queued page-view event.');
  return {
    eventId: event.eventId,
    pageType: event.pageType,
    language: event.language,
    pagePath: marketReportUrl({
      period_type: period.periodType,
      period_key: period.periodKey,
      status: 'published',
      language: event.language,
    }),
    periodType: period.periodType,
    periodKey: period.periodKey,
  };
}

function valuesClause(rowCount: number, casts: string[]): string {
  return Array.from({ length: rowCount }, (_, row) => {
    const values = casts.map((cast, column) => `$${row * casts.length + column + 1}${cast}`);
    return `(${values.join(', ')})`;
  }).join(', ');
}

function dailyRollupInsert(insertSql: string): string {
  return `WITH inserted AS (${insertSql}),
          daily_counts AS (
            SELECT (created_at AT TIME ZONE 'Pacific/Auckland')::DATE AS view_date,
                   page_type,
                   COALESCE(report_id::STRING, blog_post_id::STRING, 'home') AS content_key,
                   language,
                   COUNT(*)::INT8 AS view_count
            FROM inserted
            GROUP BY 1, 2, 3, 4
          )
          INSERT INTO page_view_daily_stats (view_date, page_type, content_key, language, view_count)
          SELECT view_date, page_type, content_key, language, view_count
          FROM daily_counts
          ON CONFLICT (view_date, page_type, content_key, language)
          DO UPDATE SET view_count = page_view_daily_stats.view_count + excluded.view_count`;
}

async function persistPageViews(events: NormalizedPageView[]): Promise<void> {
  const homeEvents = events.filter((event) => event.pageType === 'home');
  if (homeEvents.length > 0) {
    const values = valuesClause(homeEvents.length, ['::uuid', '::varchar', '::varchar']);
    await query(
      dailyRollupInsert(
        `INSERT INTO page_view_events (event_id, page_type, report_id, blog_post_id, language, page_path)
         SELECT event_id, 'home', NULL, NULL, language, page_path
         FROM (VALUES ${values}) AS events(event_id, language, page_path)
         ON CONFLICT (event_id) DO NOTHING
         RETURNING created_at, page_type, report_id, blog_post_id, language`,
      ),
      homeEvents.flatMap((event) => [event.eventId, event.language, event.pagePath]),
    );
  }

  const marketEvents = events.filter((event) => event.pageType === 'market_report');
  if (marketEvents.length > 0) {
    const values = valuesClause(marketEvents.length, [
      '::uuid',
      '::varchar',
      '::varchar',
      '::varchar',
      '::varchar',
    ]);
    await query(
      dailyRollupInsert(
        `INSERT INTO page_view_events (event_id, page_type, report_id, blog_post_id, language, page_path)
         SELECT events.event_id, 'market_report', reports.id, NULL, events.language, events.page_path
         FROM (VALUES ${values}) AS events(event_id, period_type, period_key, language, page_path)
         JOIN north_shore_market_reports reports
           ON reports.period_type = events.period_type
          AND reports.period_key = events.period_key
          AND reports.language = events.language
          AND reports.status = 'published'
         ON CONFLICT (event_id) DO NOTHING
         RETURNING created_at, page_type, report_id, blog_post_id, language`,
      ),
      marketEvents.flatMap((event) => [
        event.eventId,
        event.periodType,
        event.periodKey,
        event.language,
        event.pagePath,
      ]),
    );
  }

  const blogEvents = events.filter((event) => event.pageType === 'blog_article');
  if (blogEvents.length > 0) {
    const values = valuesClause(blogEvents.length, ['::uuid', '::varchar', '::varchar', '::varchar']);
    await query(
      dailyRollupInsert(
        `INSERT INTO page_view_events (event_id, page_type, report_id, blog_post_id, language, page_path)
         SELECT events.event_id, 'blog_article', NULL, posts.id, events.language, events.page_path
         FROM (VALUES ${values}) AS events(event_id, slug, language, page_path)
         JOIN blog_posts posts
           ON posts.published_slug = events.slug
          AND posts.status = 'published'
          AND posts.language = CASE events.language WHEN 'zh' THEN 'cn' ELSE 'en' END
         ON CONFLICT (event_id) DO NOTHING
         RETURNING created_at, page_type, report_id, blog_post_id, language`,
      ),
      blogEvents.flatMap((event) => [
        event.eventId,
        event.slug,
        event.language,
        event.pagePath,
      ]),
    );
  }
}

async function ensureConsumerGroup(client: Redis): Promise<void> {
  try {
    await client.xgroup(PAGE_VIEW_STREAM, {
      type: 'CREATE',
      group: PAGE_VIEW_GROUP,
      id: '0',
      options: { MKSTREAM: true },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('BUSYGROUP')) return;
    throw error;
  }
}

async function readMessages(client: Redis, id: '0' | '>'): Promise<QueuedPageView[]> {
  const result = await client.xreadgroup(
    PAGE_VIEW_GROUP,
    PAGE_VIEW_CONSUMER,
    PAGE_VIEW_STREAM,
    id,
    { count: PAGE_VIEW_BATCH_SIZE },
  );
  return readStreamMessages(result);
}

export async function processPageViewQueueBatch(): Promise<number> {
  const client = getRedis();
  await ensureConsumerGroup(client);

  const messages = await readMessages(client, '0');
  const batch = messages.length > 0 ? messages : await readMessages(client, '>');
  if (batch.length === 0) return 0;

  const validMessages: Array<{ id: string; event: NormalizedPageView }> = [];
  for (const message of batch) {
    let payload: unknown;
    try {
      payload = typeof message.payload === 'string'
        ? JSON.parse(message.payload)
        : message.payload;
    } catch {
      payload = null;
    }

    if (!isPageViewPayload(payload)) {
      console.error(`Discarding invalid queued page-view event ${message.id}.`);
      continue;
    }
    validMessages.push({ id: message.id, event: normalizeEvent(payload) });
  }

  await persistPageViews(validMessages.map(({ event }) => event));
  const messageIds = batch.map(({ id }) => id);
  await client.xack(PAGE_VIEW_STREAM, PAGE_VIEW_GROUP, messageIds);
  try {
    await client.xdel(PAGE_VIEW_STREAM, messageIds);
  } catch (error) {
    console.error('Failed to remove acknowledged page-view events from Redis:', error);
  }
  return batch.length;
}

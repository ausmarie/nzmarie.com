import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getBlogAdminEmail, isUuid } from '@/lib/blog-access';
import { createBlogArticleSlug, isValidBlogMonth } from '@/lib/blog-data';
import { revalidatePublishedBlogArticle } from '@/lib/blog-public-cache';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const email = await getBlogAdminEmail();
  if (!email) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ success: false, error: 'Invalid article id.' }, { status: 400 });

  try {
    const result = await query(
      `SELECT p.*, TO_CHAR(p.article_month, 'YYYY-MM-DD') AS article_month,
              c.name AS category_name
       FROM blog_posts p
       LEFT JOIN blog_categories c ON c.id = p.category_id
       WHERE p.id = $1`,
      [id]
    );
    if (!result.rows[0]) return NextResponse.json({ success: false, error: 'Blog article not found.' }, { status: 404 });
    const post = result.rows[0];
    return NextResponse.json({
      success: true,
      post: {
        ...post,
        reading_minutes: Number(post.reading_minutes),
        published_reading_minutes: post.published_reading_minutes === null
          ? null
          : Number(post.published_reading_minutes),
      },
    });
  } catch (error) {
    console.error('Failed to load Blog article:', error);
    return NextResponse.json({ success: false, error: 'Failed to load Blog article.' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: RouteContext) {
  const email = await getBlogAdminEmail();
  if (!email) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ success: false, error: 'Invalid article id.' }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, error: 'A valid JSON request body is required.' }, { status: 400 });
  }

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const slug = createBlogArticleSlug(title);
  const summary = typeof body.summary === 'string' ? body.summary.trim() : '';
  const author = typeof body.author === 'string' ? body.author.trim() : '';
  const articleMonth = typeof body.articleMonth === 'string' ? body.articleMonth : '';
  const readingMinutes = body.readingMinutes;
  const categoryId = body.categoryId === null ? null : typeof body.categoryId === 'string' ? body.categoryId : '';
  if (!title || title.length > 255) {
    return NextResponse.json({ success: false, error: 'Title is required and must be 255 characters or fewer.' }, { status: 400 });
  }
  if (!Number.isInteger(readingMinutes) || Number(readingMinutes) < 1 || Number(readingMinutes) > 120) {
    return NextResponse.json({ success: false, error: 'Reading time must be between 1 and 120 minutes.' }, { status: 400 });
  }
  if (summary.length > 4000) {
    return NextResponse.json({ success: false, error: 'Summary must be 4,000 characters or fewer.' }, { status: 400 });
  }
  if (!author || author.length > 160) {
    return NextResponse.json({ success: false, error: 'Author is required and must be 160 characters or fewer.' }, { status: 400 });
  }
  if (!isValidBlogMonth(articleMonth)) {
    return NextResponse.json({ success: false, error: 'Select a valid article month.' }, { status: 400 });
  }
  if (categoryId !== null && (typeof categoryId !== 'string' || !isUuid(categoryId))) {
    return NextResponse.json({ success: false, error: 'Select a valid category.' }, { status: 400 });
  }
  if (!Array.isArray(body.content)) {
    return NextResponse.json({ success: false, error: 'Article content must be a rich-text block array.' }, { status: 400 });
  }

  try {
    const result = await query(
      `WITH target AS (
         SELECT translation_group_id, language, slug
         FROM blog_posts
         WHERE id = $1
       ),
       resolved AS (
         SELECT translation_group_id,
                CASE
                  WHEN language = 'en' THEN $2
                  ELSE COALESCE(
                    (SELECT sibling.slug
                     FROM blog_posts sibling
                     WHERE sibling.translation_group_id = target.translation_group_id
                       AND sibling.language = 'en'
                     LIMIT 1),
                    slug
                  )
                END AS slug
         FROM target
       )
       UPDATE blog_posts AS post
       SET slug = resolved.slug,
           title = CASE WHEN post.id = $1 THEN $3 ELSE post.title END,
           summary = CASE WHEN post.id = $1 THEN $4 ELSE post.summary END,
           content = CASE WHEN post.id = $1 THEN $5::jsonb ELSE post.content END,
           category_id = CASE WHEN post.id = $1 THEN $6 ELSE post.category_id END,
           author = CASE WHEN post.id = $1 THEN $7 ELSE post.author END,
           article_month = CASE WHEN post.id = $1 THEN $8::date ELSE post.article_month END,
           reading_minutes = CASE WHEN post.id = $1 THEN $9 ELSE post.reading_minutes END,
           has_unpublished_changes = CASE
             WHEN post.id = $1 AND post.status = 'draft' THEN FALSE
             WHEN post.id = $1 THEN TRUE
             WHEN post.status = 'published' AND post.slug IS DISTINCT FROM resolved.slug THEN TRUE
             ELSE post.has_unpublished_changes
           END,
           updated_by = CASE
             WHEN post.id = $1 OR post.slug IS DISTINCT FROM resolved.slug THEN $10
             ELSE post.updated_by
           END,
           updated_at = CASE
             WHEN post.id = $1 OR post.slug IS DISTINCT FROM resolved.slug THEN NOW()
             ELSE post.updated_at
           END
       FROM resolved
       WHERE post.translation_group_id = resolved.translation_group_id
       RETURNING post.id, post.status, post.has_unpublished_changes, post.updated_at`,
      [id, slug, title, summary, JSON.stringify(body.content), categoryId, author, `${articleMonth}-01`, readingMinutes, email]
    );
    const updatedPost = result.rows.find((post) => post.id === id);
    if (!updatedPost) return NextResponse.json({ success: false, error: 'Blog article not found.' }, { status: 404 });
    return NextResponse.json({ success: true, ...updatedPost });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      return NextResponse.json({ success: false, error: 'An article with this URL slug already exists.' }, { status: 409 });
    }
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23503') {
      return NextResponse.json({ success: false, error: 'The selected category no longer exists.' }, { status: 409 });
    }
    console.error('Failed to save Blog article:', error);
    return NextResponse.json({ success: false, error: 'Failed to save Blog article.' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const email = await getBlogAdminEmail();
  if (!email) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ success: false, error: 'Invalid article id.' }, { status: 400 });

  try {
    const existing = await query<{
      slug: string;
      published_slug: string | null;
      language: 'en' | 'cn';
      translation_group_id: string;
    }>(
      `SELECT slug, published_slug, language, translation_group_id
       FROM blog_posts
       WHERE id = $1`,
      [id],
    );
    const post = existing.rows[0];
    if (!post) return NextResponse.json({ success: false, error: 'Blog article not found.' }, { status: 404 });
    const siblingResult = post.published_slug
      ? await query<{ language: 'en' | 'cn'; published_slug: string }>(
        `SELECT language, published_slug
         FROM blog_posts
         WHERE translation_group_id = $1
           AND id <> $2
           AND status = 'published'
           AND published_slug IS NOT NULL
         LIMIT 1`,
        [post.translation_group_id, id],
      )
      : { rows: [] };
    const result = await query<{ id: string }>(
      `WITH deleted_post AS (
         DELETE FROM blog_posts
         WHERE id = $1
         RETURNING id
       ),
       deleted_stats AS (
         DELETE FROM page_view_daily_stats
         WHERE page_type = 'blog_article'
           AND content_key IN (SELECT id::STRING FROM deleted_post)
         RETURNING content_key
       )
       SELECT deleted_post.id
       FROM deleted_post
       CROSS JOIN (SELECT COUNT(*) FROM deleted_stats) AS cleanup`,
      [id],
    );
    if (!result.rows[0]) return NextResponse.json({ success: false, error: 'Blog article not found.' }, { status: 404 });
    if (post.published_slug) {
      revalidatePublishedBlogArticle(
        post.language,
        post.published_slug,
        siblingResult.rows[0]
          ? { language: siblingResult.rows[0].language, slug: siblingResult.rows[0].published_slug }
          : null,
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete Blog article:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete Blog article.' }, { status: 500 });
  }
}

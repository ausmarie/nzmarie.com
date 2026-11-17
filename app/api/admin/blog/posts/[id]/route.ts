import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getBlogAdminEmail, isUuid } from '@/lib/blog-access';
import { createBlogArticleSlug, isValidBlogMonth } from '@/lib/blog-data';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const email = await getBlogAdminEmail();
  if (!email) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ success: false, error: 'Invalid article id.' }, { status: 400 });

  try {
    const result = await query(
      `SELECT p.*, c.name AS category_name
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
      `UPDATE blog_posts
       SET slug = $2,
           title = $3,
           summary = $4,
           content = $5::jsonb,
           category_id = $6,
           author = $7,
           article_month = $8::date,
           reading_minutes = $9,
           has_unpublished_changes = CASE WHEN status = 'draft' THEN FALSE ELSE TRUE END,
           updated_by = $10,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, status, has_unpublished_changes, updated_at`,
      [id, slug, title, summary, JSON.stringify(body.content), categoryId, author, `${articleMonth}-01`, readingMinutes, email]
    );
    if (!result.rows[0]) return NextResponse.json({ success: false, error: 'Blog article not found.' }, { status: 404 });
    return NextResponse.json({ success: true, ...result.rows[0] });
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
    const result = await query(`DELETE FROM blog_posts WHERE id = $1 RETURNING id`, [id]);
    if (!result.rows[0]) return NextResponse.json({ success: false, error: 'Blog article not found.' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete Blog article:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete Blog article.' }, { status: 500 });
  }
}

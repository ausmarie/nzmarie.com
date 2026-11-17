import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getBlogAdminEmail, isUuid } from '@/lib/blog-access';
import { hasBlogArticleText, isValidBlogSlug } from '@/lib/blog-data';

export const dynamic = 'force-dynamic';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const email = await getBlogAdminEmail();
  if (!email) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ success: false, error: 'Invalid article id.' }, { status: 400 });

  try {
    const existing = await query(
      `SELECT slug, title, summary, content, category_id, author, article_month, reading_minutes,
              updated_at::text AS updated_at
       FROM blog_posts
       WHERE id = $1`,
      [id]
    );
    const post = existing.rows[0];
    if (!post) return NextResponse.json({ success: false, error: 'Blog article not found.' }, { status: 404 });
    if (!String(post.title || '').trim()) {
      return NextResponse.json({ success: false, error: 'An article title is required before publishing.' }, { status: 400 });
    }
    if (!isValidBlogSlug(String(post.slug || ''))) {
      return NextResponse.json({ success: false, error: 'A valid URL slug is required before publishing.' }, { status: 400 });
    }
    if (!String(post.summary || '').trim()) {
      return NextResponse.json({ success: false, error: 'An article summary is required before publishing.' }, { status: 400 });
    }
    if (!String(post.author || '').trim()) {
      return NextResponse.json({ success: false, error: 'An article author is required before publishing.' }, { status: 400 });
    }
    if (!post.category_id) {
      return NextResponse.json({ success: false, error: 'Select an article category before publishing.' }, { status: 400 });
    }
    if (!hasBlogArticleText(post.content)) {
      return NextResponse.json({ success: false, error: 'Add article text before publishing.' }, { status: 400 });
    }

    const published = await query(
      `UPDATE blog_posts
       SET status = 'published',
           has_unpublished_changes = FALSE,
           published_slug = slug,
           published_title = title,
           published_summary = summary,
           published_content = content,
           published_category_id = category_id,
           published_author = author,
           published_month = article_month,
           published_reading_minutes = reading_minutes,
           published_at = NOW(),
           updated_by = $3,
           updated_at = NOW()
       WHERE id = $1 AND updated_at = $2
       RETURNING id, status, published_at, updated_at`,
      [id, post.updated_at, email]
    );
    if (!published.rows[0]) {
      return NextResponse.json({ success: false, error: 'The article changed while publishing. Reload and try again.' }, { status: 409 });
    }
    return NextResponse.json({ success: true, ...published.rows[0] });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      return NextResponse.json({ success: false, error: 'An article with this published URL already exists.' }, { status: 409 });
    }
    console.error('Failed to publish Blog article:', error);
    return NextResponse.json({ success: false, error: 'Failed to publish Blog article.' }, { status: 500 });
  }
}

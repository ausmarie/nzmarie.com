import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getBlogAdminEmail } from '@/lib/blog-access';
import { createBlogArticleSlug, currentBlogMonth } from '@/lib/blog-data';

export const dynamic = 'force-dynamic';

export async function GET() {
  const email = await getBlogAdminEmail();
  if (!email) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const result = await query(
      `SELECT p.id, p.slug, p.title, p.summary, p.category_id, c.name AS category_name,
              p.author, p.article_month, p.reading_minutes, p.status, p.has_unpublished_changes,
              p.published_at, p.updated_at
       FROM blog_posts p
       LEFT JOIN blog_categories c ON c.id = p.category_id
       ORDER BY p.article_month DESC, p.updated_at DESC`
    );
    const posts = result.rows.map((post) => ({
      ...post,
      reading_minutes: Number(post.reading_minutes),
    }));
    return NextResponse.json({ success: true, posts });
  } catch (error) {
    console.error('Failed to load Blog posts:', error);
    return NextResponse.json({ success: false, error: 'Failed to load Blog posts.' }, { status: 500 });
  }
}

export async function POST() {
  const email = await getBlogAdminEmail();
  if (!email) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const slug = createBlogArticleSlug('Untitled article');
    const result = await query(
      `INSERT INTO blog_posts (slug, author, article_month, created_by, updated_by)
       VALUES ($1, 'Marie Nian', $2::date, $3, $3)
       RETURNING id`,
      [slug, `${currentBlogMonth()}-01`, email]
    );
    return NextResponse.json({ success: true, id: result.rows[0].id }, { status: 201 });
  } catch (error) {
    console.error('Failed to create Blog draft:', error);
    return NextResponse.json({ success: false, error: 'Failed to create Blog draft.' }, { status: 500 });
  }
}

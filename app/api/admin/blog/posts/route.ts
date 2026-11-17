import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getBlogAdminEmail } from '@/lib/blog-access';
import { currentBlogMonth, isBlogLanguage } from '@/lib/blog-data';

export const dynamic = 'force-dynamic';

export async function GET() {
  const email = await getBlogAdminEmail();
  if (!email) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const result = await query(
      `SELECT p.id, p.slug, p.title, p.summary, p.category_id, c.name AS category_name,
              p.author, p.language, p.translation_group_id,
              TO_CHAR(p.article_month, 'YYYY-MM-DD') AS article_month,
              p.reading_minutes, p.status, p.has_unpublished_changes,
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

export async function POST(request: Request) {
  const email = await getBlogAdminEmail();
  if (!email) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: Record<string, unknown> = {};
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, error: 'A valid JSON request body is required.' }, { status: 400 });
  }
  const language = body.language === undefined ? 'en' : body.language;
  if (!isBlogLanguage(language)) {
    return NextResponse.json({ success: false, error: 'Select a valid article language.' }, { status: 400 });
  }

  try {
    const id = randomUUID();
    const title = language === 'cn' ? '未命名文章' : 'Untitled article';
    const result = await query(
      `INSERT INTO blog_posts (
         id, slug, language, translation_group_id, title, author, article_month, created_by, updated_by
       )
       VALUES ($1, $2, $3, $1, $4, 'Marie Nian', $5::date, $6, $6)
       RETURNING id, language, translation_group_id`,
      [id, `draft-${id.replace(/-/g, '')}`, language, title, `${currentBlogMonth()}-01`, email]
    );
    return NextResponse.json({ success: true, ...result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('Failed to create Blog draft:', error);
    return NextResponse.json({ success: false, error: 'Failed to create Blog draft.' }, { status: 500 });
  }
}

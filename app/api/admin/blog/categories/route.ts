import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getBlogAdminEmail } from '@/lib/blog-access';
import { parseBlogCategoryInput } from '@/lib/blog-data';

export const dynamic = 'force-dynamic';

export async function GET() {
  const email = await getBlogAdminEmail();
  if (!email) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const result = await query(
      `SELECT c.id, c.name, c.name_cn, c.slug, c.description, c.sort_order,
              COUNT(p.id)::int AS post_count
       FROM blog_categories c
       LEFT JOIN blog_posts p ON p.category_id = c.id
       GROUP BY c.id
       ORDER BY c.sort_order, c.name`
    );
    return NextResponse.json({ success: true, categories: result.rows });
  } catch (error) {
    console.error('Failed to load Blog categories:', error);
    return NextResponse.json({ success: false, error: 'Failed to load Blog categories.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const email = await getBlogAdminEmail();
  if (!email) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'A valid JSON request body is required.' }, { status: 400 });
  }
  const category = parseBlogCategoryInput(body);
  if (!category) {
    return NextResponse.json({ success: false, error: 'Enter English and Chinese category names, a valid slug, and a description up to 500 characters.' }, { status: 400 });
  }

  try {
    const result = await query(
      `INSERT INTO blog_categories (name, name_cn, slug, description, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $5)
       RETURNING id, name, name_cn, slug, description, sort_order`,
      [category.name, category.nameCn, category.slug, category.description, email]
    );
    return NextResponse.json({ success: true, category: result.rows[0] }, { status: 201 });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      return NextResponse.json({ success: false, error: 'A category with this name or slug already exists.' }, { status: 409 });
    }
    console.error('Failed to create Blog category:', error);
    return NextResponse.json({ success: false, error: 'Failed to create Blog category.' }, { status: 500 });
  }
}

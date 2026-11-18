import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getBlogAdminEmail, isUuid } from '@/lib/blog-access';
import { parseBlogCategoryInput } from '@/lib/blog-data';
import { revalidatePublishedBlogCategory } from '@/lib/blog-public-cache';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: RouteContext) {
  const email = await getBlogAdminEmail();
  if (!email) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ success: false, error: 'Invalid category id.' }, { status: 400 });

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
      `UPDATE blog_categories
       SET name = $2, name_cn = $3, slug = $4, description = $5, updated_by = $6, updated_at = NOW()
       WHERE id = $1
       RETURNING id, name, name_cn, slug, description, sort_order`,
      [id, category.name, category.nameCn, category.slug, category.description, email]
    );
    if (!result.rows[0]) return NextResponse.json({ success: false, error: 'Blog category not found.' }, { status: 404 });
    revalidatePublishedBlogCategory();
    return NextResponse.json({ success: true, category: result.rows[0] });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      return NextResponse.json({ success: false, error: 'A category with this name or slug already exists.' }, { status: 409 });
    }
    console.error('Failed to update Blog category:', error);
    return NextResponse.json({ success: false, error: 'Failed to update Blog category.' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const email = await getBlogAdminEmail();
  if (!email) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ success: false, error: 'Invalid category id.' }, { status: 400 });

  try {
    const result = await query(
      `DELETE FROM blog_categories c
       WHERE c.id = $1
         AND NOT EXISTS (
           SELECT 1 FROM blog_posts p
           WHERE p.category_id = c.id OR p.published_category_id = c.id
         )
       RETURNING id`,
      [id]
    );
    if (result.rows[0]) {
      revalidatePublishedBlogCategory();
      return NextResponse.json({ success: true });
    }
    const existing = await query(`SELECT id FROM blog_categories WHERE id = $1`, [id]);
    if (existing.rows[0]) {
      return NextResponse.json({ success: false, error: 'This category has articles. Move or delete them before deleting the category.' }, { status: 409 });
    }
    return NextResponse.json({ success: false, error: 'Blog category not found.' }, { status: 404 });
  } catch (error) {
    console.error('Failed to delete Blog category:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete Blog category.' }, { status: 500 });
  }
}

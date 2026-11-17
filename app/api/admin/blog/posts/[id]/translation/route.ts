import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getBlogAdminEmail, isUuid } from '@/lib/blog-access';
import { isBlogLanguage, otherBlogLanguage, type BlogLanguage } from '@/lib/blog-data';
import { query } from '@/lib/db';
import type { QueryResultRow } from 'pg';

export const dynamic = 'force-dynamic';

interface SourcePost extends QueryResultRow {
  slug: string;
  language: BlogLanguage;
  translation_group_id: string;
  category_id: string | null;
  author: string;
  article_month: string;
  reading_minutes: number | string;
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const email = await getBlogAdminEmail();
  if (!email) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ success: false, error: 'Invalid article id.' }, { status: 400 });

  try {
    const sourceResult = await query<SourcePost>(
      `SELECT slug, language, translation_group_id, category_id, author,
              TO_CHAR(article_month, 'YYYY-MM-DD') AS article_month, reading_minutes
       FROM blog_posts
       WHERE id = $1`,
      [id],
    );
    const source = sourceResult.rows[0];
    if (!source) return NextResponse.json({ success: false, error: 'Blog article not found.' }, { status: 404 });
    if (!isBlogLanguage(source.language)) {
      return NextResponse.json({ success: false, error: 'The source article has an invalid language.' }, { status: 409 });
    }

    const language = otherBlogLanguage(source.language);
    const translationId = randomUUID();
    const title = language === 'cn' ? '未命名文章' : 'Untitled article';
    const result = await query(
      `INSERT INTO blog_posts (
         id, slug, language, translation_group_id, title, summary, content,
         category_id, author, article_month, reading_minutes, created_by, updated_by
       )
       VALUES ($1, $2, $3, $4, $5, '', '[]'::jsonb,
               $6, $7, $8::date, $9, $10, $10)
       RETURNING id, language, translation_group_id`,
      [
        translationId,
        source.slug,
        language,
        source.translation_group_id,
        title,
        source.category_id,
        source.author || 'Marie Nian',
        source.article_month,
        Number(source.reading_minutes) || 5,
        email,
      ],
    );
    return NextResponse.json({ success: true, ...result.rows[0] }, { status: 201 });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      return NextResponse.json({ success: false, error: 'A version in the other language already exists.' }, { status: 409 });
    }
    console.error('Failed to create Blog translation:', error);
    return NextResponse.json({ success: false, error: 'Failed to create Blog translation.' }, { status: 500 });
  }
}

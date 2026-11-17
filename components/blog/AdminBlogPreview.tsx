import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import BlogRichTextPreview from '@/components/blog/BlogRichTextPreview';
import BlogArticleFooter from '@/components/blog/BlogArticleFooter';
import { getBlogAdminEmail } from '@/lib/blog-access';
import { initialBlogContent, shortMonthLabel, type BlogLanguage } from '@/lib/blog-data';
import { query } from '@/lib/db';
import type { QueryResultRow } from 'pg';

interface BlogPreviewPost extends QueryResultRow {
  id: string;
  title: string;
  summary: string;
  content: unknown;
  author: string;
  article_month: string;
  reading_minutes: number | string;
  category_name: string | null;
}

export default async function AdminBlogPreview({
  slug,
  language,
}: {
  slug: string;
  language: BlogLanguage;
}) {
  const email = await getBlogAdminEmail();
  if (!email) redirect('/admin/login');

  const result = await query<BlogPreviewPost>(
    `SELECT p.id, p.title, p.summary, p.content, p.author,
            TO_CHAR(p.article_month, 'YYYY-MM-DD') AS article_month, p.reading_minutes,
            c.name AS category_name
     FROM blog_posts p
     LEFT JOIN blog_categories c ON c.id = p.category_id
     WHERE p.slug = $1 AND p.language = $2
     ORDER BY p.updated_at DESC
     LIMIT 1`,
    [slug, language],
  );
  const post = result.rows[0];
  if (!post) notFound();

  const categoryName = typeof post.category_name === 'string' ? post.category_name : '';
  const title = typeof post.title === 'string' ? post.title : '';
  const summary = typeof post.summary === 'string' ? post.summary : '';
  const author = typeof post.author === 'string' ? post.author : '';
  const savedReadingMinutes = Number(post.reading_minutes);
  const readingMinutes = Number.isInteger(savedReadingMinutes) && savedReadingMinutes > 0
    ? savedReadingMinutes
    : 5;

  return (
    <main className="h-full overflow-y-auto overscroll-contain bg-white px-5 py-8 sm:px-8">
      <div className="blog-article-preview mx-auto max-w-4xl">
        <Link href={`/admin/blog/draft/${post.id}`} className="text-sm font-medium text-blue-700 hover:text-blue-900">
          ← Back to editor
        </Link>
        <p className="mt-8 text-xs font-semibold uppercase tracking-wide text-blue-700">Draft preview</p>
        {categoryName && <p className="mt-2 text-sm text-slate-500">{categoryName}</p>}
        <h1 className="mt-3 text-4xl font-bold leading-tight">{title}</h1>
        {summary && <p className="mt-4 text-lg leading-7">{summary}</p>}
        <p className="mt-4 text-sm">By {author}</p>
        <p className="mt-1 text-sm text-slate-500">
          {readingMinutes} min read <span aria-hidden="true">•</span> {shortMonthLabel(post.article_month)}
        </p>
        <div className="mt-8">
          <BlogRichTextPreview content={initialBlogContent(post.content)} />
        </div>
        <BlogArticleFooter language={language} />
      </div>
    </main>
  );
}

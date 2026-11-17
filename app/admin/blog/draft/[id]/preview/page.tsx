import { notFound, redirect } from 'next/navigation';
import { getBlogAdminEmail, isUuid } from '@/lib/blog-access';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function AdminBlogDraftPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const email = await getBlogAdminEmail();
  if (!email) redirect('/admin/login');

  const { id } = await params;
  if (!isUuid(id)) notFound();

  const result = await query(`SELECT slug FROM blog_posts WHERE id = $1`, [id]);
  const slug = result.rows[0]?.slug;
  if (typeof slug !== 'string' || !slug) notFound();
  redirect(`/admin/blog/preview/${encodeURIComponent(slug)}`);
}

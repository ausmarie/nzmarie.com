import { redirect } from 'next/navigation';
import BlogAdminPage from '@/components/blog/BlogAdminPage';
import { getBlogAdminEmail } from '@/lib/blog-access';

export default async function AdminBlogDraftPage({ params }: { params: Promise<{ id: string }> }) {
  const email = await getBlogAdminEmail();
  if (!email) redirect('/admin/login');

  const { id } = await params;
  return <BlogAdminPage key={id} initialPostId={id} />;
}

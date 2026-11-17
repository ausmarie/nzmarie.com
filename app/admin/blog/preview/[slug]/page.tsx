import AdminBlogPreview from '@/components/blog/AdminBlogPreview';

export const dynamic = 'force-dynamic';

export default async function AdminBlogPreviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return AdminBlogPreview({ slug, language: 'en' });
}

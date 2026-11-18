import type { Metadata } from 'next';
import PublishedBlogArticle from '@/components/blog/PublishedBlogArticle';
import { getPublishedBlogArticleMetadata } from '@/lib/blog-public-seo';
import { getPublishedBlogSitemapRows } from '@/lib/blog-public-cache';

export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  return (await getPublishedBlogSitemapRows())
    .filter((article) => article.language === 'cn')
    .map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return getPublishedBlogArticleMetadata(slug, 'cn');
}

export default async function PublishedChineseBlogArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <PublishedBlogArticle slug={slug} language="cn" />;
}

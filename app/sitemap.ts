import type { MetadataRoute } from 'next';
import { getMarketReportSitemap } from '@/lib/market-report-seo';
import { blogArticlePath } from '@/lib/blog-data';
import { getPublishedBlogSitemapRows } from '@/lib/blog-public-cache';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [marketReports, blogArticles] = await Promise.all([
    getMarketReportSitemap(),
    getPublishedBlogSitemapRows(),
  ]);
  const blogUrls: MetadataRoute.Sitemap = [
    { url: 'https://www.nzmarie.com/blog' },
    { url: 'https://www.nzmarie.com/blog/cn' },
    ...blogArticles.map((article) => ({
      url: new URL(blogArticlePath(article.slug, article.language), 'https://www.nzmarie.com').toString(),
      lastModified: new Date(article.published_at),
      ...(article.translation_slug
        ? {
          alternates: {
            languages: {
              [article.language === 'en' ? 'zh' : 'en']: new URL(
                blogArticlePath(article.translation_slug, article.language === 'en' ? 'cn' : 'en'),
                'https://www.nzmarie.com',
              ).toString(),
            },
          },
        }
        : {}),
    })),
  ];
  return [...marketReports, ...blogUrls];
}

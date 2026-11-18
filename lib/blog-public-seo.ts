import type { Metadata } from 'next';
import { blogArticlePath, type BlogLanguage } from '@/lib/blog-data';
import { getPublishedBlogArticle } from '@/lib/blog-public-cache';

const SITE_URL = 'https://www.nzmarie.com';

export async function getPublishedBlogArticleMetadata(
  slug: string,
  language: BlogLanguage,
): Promise<Metadata> {
  const article = await getPublishedBlogArticle(slug, language);
  if (!article) {
    return {
      title: 'Blog | NZ Marie',
      robots: { index: false, follow: false },
    };
  }

  const path = blogArticlePath(article.slug, language);
  const url = new URL(path, SITE_URL).toString();
  const chinese = language === 'cn';
  const translationPath = article.translation_slug
    ? blogArticlePath(article.translation_slug, chinese ? 'en' : 'cn')
    : null;
  const title = `${article.title} | NZ Marie`;
  const description = article.summary || article.title;
  const languageAlternates = translationPath
    ? {
      en: new URL(chinese ? translationPath : path, SITE_URL).toString(),
      zh: new URL(chinese ? path : translationPath, SITE_URL).toString(),
    }
    : undefined;

  return {
    title,
    description,
    alternates: {
      canonical: url,
      ...(languageAlternates ? { languages: languageAlternates } : {}),
    },
    openGraph: {
      title,
      description,
      url,
      siteName: 'NZ Marie',
      locale: chinese ? 'zh_CN' : 'en_NZ',
      type: 'article',
      publishedTime: new Date(article.published_at).toISOString(),
      authors: [article.author],
    },
    twitter: { card: 'summary', title, description },
    robots: { index: true, follow: true },
  };
}

import Link from 'next/link';
import { notFound } from 'next/navigation';
import Header from '@/components/Header';
import BlogArticleFooter from '@/components/blog/BlogArticleFooter';
import BlogRichTextRenderer from '@/components/blog/BlogRichTextRenderer';
import {
  blogArticlePath,
  localizedBlogCategoryName,
  shortMonthLabel,
  type BlogLanguage,
} from '@/lib/blog-data';
import { getPublishedBlogArticle } from '@/lib/blog-public-cache';

function displayMonth(value: string, language: BlogLanguage): string {
  if (language === 'en') return shortMonthLabel(value);
  const match = /^(\d{4})-(\d{2})/.exec(value);
  return match ? `${match[1]}年${Number(match[2])}月` : value;
}

export default async function PublishedBlogArticle({
  slug,
  language,
}: {
  slug: string;
  language: BlogLanguage;
}) {
  const article = await getPublishedBlogArticle(slug, language);
  if (!article) notFound();

  const chinese = language === 'cn';
  const languageHref = article.translation_slug
    ? blogArticlePath(article.translation_slug, chinese ? 'en' : 'cn')
    : chinese ? '/blog' : '/blog/cn';
  const categoryLabel = article.category_slug
    ? localizedBlogCategoryName({
      slug: article.category_slug,
      name: article.category_name || '',
      name_cn: article.category_name_cn || '',
    }, language)
    : null;

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Header lang={chinese ? 'zh' : 'en'} blogLanguageHref={languageHref} />
      <main className="mx-auto max-w-6xl px-4 pt-10 pb-4 sm:px-6 lg:px-8">
        <Link href={chinese ? '/blog/cn' : '/blog'} className="text-sm font-medium text-blue-700 hover:text-blue-900">
          {chinese ? '← 返回博客' : '← Back to Blog'}
        </Link>
        <article className="min-w-0 px-4 pt-6 pb-3 sm:px-8">
          {categoryLabel && <p className="text-sm font-semibold text-blue-700">{categoryLabel}</p>}
          <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">{article.title}</h1>
          {article.summary && <p className="mt-5 text-lg leading-8 text-slate-600">{article.summary}</p>}
          <p className="mt-5 text-sm text-slate-500">
            {chinese ? `作者：${article.author}` : `By ${article.author}`}
            <span aria-hidden="true"> • </span>
            {article.reading_minutes} {chinese ? '分钟阅读' : 'min read'}
            <span aria-hidden="true"> • </span>
            {displayMonth(article.article_month, language)}
          </p>
          <div className="mt-4 pt-4">
            <BlogRichTextRenderer content={article.content} />
          </div>
          <BlogArticleFooter language={language} />
        </article>
      </main>
    </div>
  );
}

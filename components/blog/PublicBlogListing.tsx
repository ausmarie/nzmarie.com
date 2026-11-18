import Link from 'next/link';
import Header from '@/components/Header';
import {
  blogArticlePath,
  localizedBlogCategoryName,
  shortMonthLabel,
  type BlogLanguage,
} from '@/lib/blog-data';
import {
  getPublishedBlogCategories,
  getPublishedBlogListing,
} from '@/lib/blog-public-cache';

function listingPath(language: BlogLanguage): string {
  return language === 'cn' ? '/blog/cn' : '/blog';
}

function listingUrl(language: BlogLanguage, category: string | null, page: number): string {
  const params = new URLSearchParams();
  if (category) params.set('category', category);
  if (page > 1) params.set('page', String(page));
  const query = params.toString();
  return `${listingPath(language)}${query ? `?${query}` : ''}`;
}

function displayMonth(value: string, language: BlogLanguage): string {
  if (language === 'en') return shortMonthLabel(value);
  const match = /^(\d{4})-(\d{2})/.exec(value);
  return match ? `${match[1]}年${Number(match[2])}月` : value;
}

export default async function PublicBlogListing({
  language,
  searchParams,
}: {
  language: BlogLanguage;
  searchParams?: { category?: string | string[]; page?: string | string[] };
}) {
  const categories = await getPublishedBlogCategories(language);
  const rawCategory = Array.isArray(searchParams?.category)
    ? searchParams.category[0]
    : searchParams?.category;
  const categorySlug = categories.some((category) => category.slug === rawCategory)
    ? rawCategory ?? null
    : null;
  const rawPage = Array.isArray(searchParams?.page) ? searchParams.page[0] : searchParams?.page;
  const parsedPage = Number(rawPage);
  const page = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const listing = await getPublishedBlogListing(language, categorySlug, page);
  const chinese = language === 'cn';
  const basePath = listingPath(language);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Header lang={chinese ? 'zh' : 'en'} />
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <header className="mb-10 max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">
            {chinese ? 'NZ Marie 博客' : 'NZ Marie Blog'}
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            {chinese ? '房地产买卖指南与市场洞察' : 'Property Guides & Market Insights'}
          </h1>
          <p className="mt-4 text-lg leading-8 text-slate-600">
            {chinese
              ? '浏览买房、卖房及奥克兰房地产市场相关的实用文章。'
              : 'Explore practical articles on buying, selling, and the Auckland property market.'}
          </p>
        </header>

        <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside aria-label={chinese ? '文章分类' : 'Blog categories'}>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              {chinese ? '分类' : 'Categories'}
            </h2>
            <nav className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible">
              <Link
                href={basePath}
                aria-current={!categorySlug ? 'page' : undefined}
                className={`shrink-0 rounded-lg px-3 py-2 text-sm ${
                  !categorySlug ? 'bg-blue-700 text-white' : 'bg-white text-slate-700 hover:bg-blue-50'
                }`}
              >
                {chinese ? '全部文章' : 'All articles'}
              </Link>
              {categories.map((category) => (
                <Link
                  key={category.id}
                  href={listingUrl(language, category.slug, 1)}
                  aria-current={categorySlug === category.slug ? 'page' : undefined}
                  className={`shrink-0 rounded-lg px-3 py-2 text-sm ${
                    categorySlug === category.slug ? 'bg-blue-700 text-white' : 'bg-white text-slate-700 hover:bg-blue-50'
                  }`}
                >
                  {localizedBlogCategoryName(category, language)}
                  <span className="ml-2 opacity-70">{category.post_count}</span>
                </Link>
              ))}
            </nav>
          </aside>

          <section aria-label={chinese ? '文章列表' : 'Blog articles'}>
            {listing.posts.length ? (
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {listing.posts.map((post, index) => (
                  <article
                    key={post.id}
                    className={`flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm ${
                      page === 1 && !categorySlug && index === 0 ? 'md:col-span-2 xl:col-span-2' : ''
                    }`}
                  >
                    {post.category_slug && (
                      <p className="text-sm font-semibold text-blue-700">
                        {localizedBlogCategoryName({
                          name: post.category_name || '',
                          name_cn: post.category_name_cn || '',
                          slug: post.category_slug,
                        }, language)}
                      </p>
                    )}
                    <h2 className="mt-3 text-xl font-semibold leading-snug sm:text-2xl">
                      <Link
                        href={blogArticlePath(post.slug, language)}
                        className="hover:text-blue-700"
                      >
                        {post.title}
                      </Link>
                    </h2>
                    {post.summary && <p className="mt-3 flex-1 leading-7 text-slate-600">{post.summary}</p>}
                    <p className="mt-5 text-sm text-slate-500">
                      {post.author} <span aria-hidden="true">•</span> {post.reading_minutes}{' '}
                      {chinese ? '分钟阅读' : 'min read'} <span aria-hidden="true">•</span>{' '}
                      {displayMonth(post.article_month, language)}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-slate-600">
                {chinese ? '此分类暂时没有已发布的文章。' : 'There are no published articles in this category yet.'}
              </p>
            )}

            {listing.pageCount > 1 && (
              <nav className="mt-8 flex items-center justify-between" aria-label={chinese ? '分页' : 'Pagination'}>
                {page > 1 ? (
                  <Link href={listingUrl(language, categorySlug, page - 1)} className="text-sm font-semibold text-blue-700">
                    {chinese ? '← 上一页' : '← Previous'}
                  </Link>
                ) : <span />}
                <span className="text-sm text-slate-500">
                  {chinese ? `${page} / ${listing.pageCount} 页` : `Page ${page} of ${listing.pageCount}`}
                </span>
                {page < listing.pageCount ? (
                  <Link href={listingUrl(language, categorySlug, page + 1)} className="text-sm font-semibold text-blue-700">
                    {chinese ? '下一页 →' : 'Next →'}
                  </Link>
                ) : <span />}
              </nav>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

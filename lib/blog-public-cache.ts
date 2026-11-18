import { revalidatePath, revalidateTag, unstable_cache } from 'next/cache';
import { query } from '@/lib/db';
import { blogArticlePath, initialBlogContent, type BlogLanguage } from '@/lib/blog-data';
import type { ReportEditorContent } from '@/types/report';
import type { QueryResultRow } from 'pg';

const BLOG_CACHE_SECONDS = 3600;
export const BLOG_PAGE_SIZE = 12;

export interface PublishedBlogCategory extends QueryResultRow {
  id: string;
  name: string;
  name_cn: string;
  slug: string;
  sort_order: number;
  post_count: number;
}

export interface PublishedBlogPost {
  id: string;
  slug: string;
  language: BlogLanguage;
  translation_group_id: string;
  title: string;
  summary: string;
  author: string;
  article_month: string;
  reading_minutes: number;
  published_at: string;
  category_id: string | null;
  category_slug: string | null;
  category_name: string | null;
  category_name_cn: string | null;
}

export interface PublishedBlogArticle extends PublishedBlogPost {
  content: ReportEditorContent;
  translation_slug: string | null;
}

export interface PublishedBlogListing {
  posts: PublishedBlogPost[];
  totalCount: number;
  page: number;
  pageCount: number;
}

export interface PublishedBlogSidebarPost extends PublishedBlogPost {
  category_sort_order: number | null;
}

interface PublishedBlogPostRow extends QueryResultRow {
  id: string;
  published_slug: string;
  language: BlogLanguage;
  translation_group_id: string;
  published_title: string;
  published_summary: string;
  published_author: string;
  article_month: string;
  published_reading_minutes: number | string;
  published_at: string | Date;
  category_id: string | null;
  category_slug: string | null;
  category_name: string | null;
  category_name_cn: string | null;
  total_count?: number | string;
}

export function blogListingCacheTag(language: BlogLanguage): string {
  return `published-blog-list:${language}`;
}

export function blogSidebarCacheTag(language: BlogLanguage): string {
  return `published-blog-sidebar:${language}`;
}

export function blogArticleCacheTag(language: BlogLanguage, slug: string): string {
  return `published-blog-article:${language}:${slug.toLowerCase()}`;
}

export function blogCategoryNamesCacheTag(language: BlogLanguage): string {
  return `published-blog-category-names:${language}`;
}

export function revalidatePublishedBlogArticle(
  language: BlogLanguage,
  slug: string,
  translated?: { language: BlogLanguage; slug: string } | null,
  previousSlug?: string | null,
): void {
  const articles = [
    { language, slug },
    ...(previousSlug ? [{ language, slug: previousSlug }] : []),
    ...(translated ? [translated] : []),
  ];
  const uniqueArticles = new Map(
    articles.map((article) => [`${article.language}:${article.slug.toLowerCase()}`, article]),
  );
  revalidateTag(blogListingCacheTag(language));
  revalidateTag(blogSidebarCacheTag(language));
  revalidateTag(blogCategoryNamesCacheTag(language));
  for (const article of uniqueArticles.values()) {
    revalidateTag(blogArticleCacheTag(article.language, article.slug));
    revalidatePath(blogArticlePath(article.slug, article.language), 'page');
  }
  revalidatePath('/blog', 'page');
  revalidatePath('/blog/cn', 'page');
}

export function revalidatePublishedBlogCategory(): void {
  for (const language of ['en', 'cn'] as const) {
    revalidateTag(blogListingCacheTag(language));
    revalidateTag(blogSidebarCacheTag(language));
    revalidateTag(blogCategoryNamesCacheTag(language));
  }
  revalidatePath('/blog', 'page');
  revalidatePath('/blog/cn', 'page');
  revalidatePath('/blog/[slug]', 'page');
  revalidatePath('/blog/[slug]/cn', 'page');
}

export async function getPublishedBlogCategories(
  language: BlogLanguage,
): Promise<PublishedBlogCategory[]> {
  return unstable_cache(
    async () => {
      const result = await query<PublishedBlogCategory>(
        `SELECT c.id, c.name, c.name_cn, c.slug, c.sort_order,
                COUNT(p.id)::int AS post_count
         FROM blog_categories c
         INNER JOIN blog_posts p
           ON p.published_category_id = c.id
          AND p.status = 'published'
          AND p.published_slug IS NOT NULL
          AND p.language = $1
         GROUP BY c.id
         HAVING COUNT(p.id) > 0
         ORDER BY c.sort_order, c.name`,
        [language],
      );
      return result.rows.map((category) => ({
        ...category,
        post_count: Number(category.post_count),
      }));
    },
    ['published-blog-categories', language],
    {
      revalidate: BLOG_CACHE_SECONDS,
      tags: [blogListingCacheTag(language)],
    },
  )();
}

export async function getPublishedBlogListing(
  language: BlogLanguage,
  categorySlug: string | null,
  page: number,
): Promise<PublishedBlogListing> {
  const safePage = Number.isInteger(page) && page > 0 ? page : 1;
  return unstable_cache(
    async () => {
      const offset = (safePage - 1) * BLOG_PAGE_SIZE;
      const result = await query<PublishedBlogPostRow>(
        `SELECT p.id, p.published_slug, p.language, p.translation_group_id,
                p.published_title, p.published_summary, p.published_author,
                TO_CHAR(p.published_month, 'YYYY-MM-DD') AS article_month,
                p.published_reading_minutes, p.published_at,
                c.id AS category_id, c.slug AS category_slug,
                c.name AS category_name, c.name_cn AS category_name_cn,
                COUNT(*) OVER() AS total_count
         FROM blog_posts p
         LEFT JOIN blog_categories c ON c.id = p.published_category_id
         WHERE p.status = 'published'
           AND p.published_slug IS NOT NULL
           AND p.language = $1
           AND ($2::varchar IS NULL OR c.slug = $2)
         ORDER BY p.published_month DESC, p.published_at DESC
         LIMIT $3 OFFSET $4`,
        [language, categorySlug, BLOG_PAGE_SIZE, offset],
      );
      let totalCount = Number(result.rows[0]?.total_count ?? 0);
      if (result.rows.length === 0 && offset > 0) {
        const countResult = await query<{ total_count: number | string }>(
          `SELECT COUNT(*)::int AS total_count
           FROM blog_posts p
           LEFT JOIN blog_categories c ON c.id = p.published_category_id
           WHERE p.status = 'published'
             AND p.published_slug IS NOT NULL
             AND p.language = $1
             AND ($2::varchar IS NULL OR c.slug = $2)`,
          [language, categorySlug],
        );
        totalCount = Number(countResult.rows[0]?.total_count ?? 0);
      }

      const posts = result.rows.map(mapPublishedBlogPost);
      return {
        posts,
        totalCount,
        page: safePage,
        pageCount: Math.ceil(totalCount / BLOG_PAGE_SIZE),
      };
    },
    ['published-blog-list', language, categorySlug ?? 'all', String(safePage)],
    {
      revalidate: BLOG_CACHE_SECONDS,
      tags: [blogListingCacheTag(language)],
    },
  )();
}

export async function getPublishedBlogArticle(
  slug: string,
  language: BlogLanguage,
): Promise<PublishedBlogArticle | null> {
  const normalizedSlug = slug.toLowerCase();
  return unstable_cache(
    async () => {
      const otherLanguage: BlogLanguage = language === 'en' ? 'cn' : 'en';
      const result = await query<PublishedBlogPostRow & {
        published_content: unknown;
        translation_slug: string | null;
      }>(
        `SELECT p.id, p.published_slug, p.language, p.translation_group_id,
                p.published_title, p.published_summary, p.published_author,
                TO_CHAR(p.published_month, 'YYYY-MM-DD') AS article_month,
                p.published_reading_minutes, p.published_at, p.published_content,
                c.id AS category_id, c.slug AS category_slug,
                c.name AS category_name, c.name_cn AS category_name_cn,
                translation.published_slug AS translation_slug
         FROM blog_posts p
         LEFT JOIN blog_categories c ON c.id = p.published_category_id
         LEFT JOIN LATERAL (
           SELECT sibling.published_slug
           FROM blog_posts sibling
           WHERE sibling.translation_group_id = p.translation_group_id
             AND sibling.language = $3
             AND sibling.status = 'published'
             AND sibling.published_slug IS NOT NULL
           LIMIT 1
         ) translation ON TRUE
         WHERE p.status = 'published'
           AND p.published_slug = $1
           AND p.language = $2
         LIMIT 1`,
        [normalizedSlug, language, otherLanguage],
      );
      const row = result.rows[0];
      if (!row) return null;
      return {
        ...mapPublishedBlogPost(row),
        content: initialBlogContent(row.published_content),
        translation_slug: row.translation_slug,
      };
    },
    ['published-blog-article', language, normalizedSlug],
    {
      revalidate: BLOG_CACHE_SECONDS,
      tags: [
        blogArticleCacheTag(language, normalizedSlug),
        blogCategoryNamesCacheTag(language),
      ],
    },
  )();
}

export async function getPublishedBlogSidebarArticles(
  language: BlogLanguage,
): Promise<PublishedBlogSidebarPost[]> {
  return unstable_cache(
    async () => {
      const result = await query<PublishedBlogPostRow & { category_sort_order: number | null }>(
        `WITH ranked_posts AS (
           SELECT p.id, p.published_slug, p.language, p.translation_group_id,
                  p.published_title, p.published_summary, p.published_author,
                  TO_CHAR(p.published_month, 'YYYY-MM-DD') AS article_month,
                  p.published_reading_minutes, p.published_at,
                  c.id AS category_id, c.slug AS category_slug,
                  c.name AS category_name, c.name_cn AS category_name_cn,
                  c.sort_order AS category_sort_order,
                  ROW_NUMBER() OVER (
                    PARTITION BY p.published_category_id
                    ORDER BY p.published_month DESC, p.published_at DESC
                  ) AS category_rank
           FROM blog_posts p
           LEFT JOIN blog_categories c ON c.id = p.published_category_id
           WHERE p.status = 'published'
             AND p.published_slug IS NOT NULL
             AND p.language = $1
         )
         SELECT *
         FROM ranked_posts
         WHERE category_rank <= 4
         ORDER BY category_sort_order NULLS LAST, category_name, category_rank`,
        [language],
      );
      return result.rows.map((row) => ({
        ...mapPublishedBlogPost(row),
        category_sort_order: row.category_sort_order,
      }));
    },
    ['published-blog-sidebar', language],
    {
      revalidate: BLOG_CACHE_SECONDS,
      tags: [blogSidebarCacheTag(language)],
    },
  )();
}

export async function getPublishedBlogSitemapRows(): Promise<Array<{
  slug: string;
  language: BlogLanguage;
  published_at: string | Date;
  translation_slug: string | null;
}>> {
  return unstable_cache(
    async () => {
      const result = await query<{
        slug: string;
        language: BlogLanguage;
        published_at: string | Date;
        translation_slug: string | null;
      }>(
        `SELECT p.published_slug AS slug, p.language, p.published_at,
                translation.published_slug AS translation_slug
         FROM blog_posts p
         LEFT JOIN LATERAL (
           SELECT sibling.published_slug
           FROM blog_posts sibling
           WHERE sibling.translation_group_id = p.translation_group_id
             AND sibling.language = CASE WHEN p.language = 'en' THEN 'cn' ELSE 'en' END
             AND sibling.status = 'published'
             AND sibling.published_slug IS NOT NULL
           LIMIT 1
         ) translation ON TRUE
         WHERE p.status = 'published'
           AND p.published_slug IS NOT NULL
         ORDER BY p.published_at DESC`,
      );
      return result.rows;
    },
    ['published-blog-sitemap'],
    {
      revalidate: BLOG_CACHE_SECONDS,
      tags: [blogListingCacheTag('en'), blogListingCacheTag('cn')],
    },
  )();
}

function mapPublishedBlogPost(row: PublishedBlogPostRow): PublishedBlogPost {
  return {
    id: row.id,
    slug: row.published_slug,
    language: row.language,
    translation_group_id: row.translation_group_id,
    title: row.published_title,
    summary: row.published_summary,
    author: row.published_author,
    article_month: row.article_month,
    reading_minutes: Number(row.published_reading_minutes),
    published_at: row.published_at instanceof Date ? row.published_at.toISOString() : row.published_at,
    category_id: row.category_id,
    category_slug: row.category_slug,
    category_name: row.category_name,
    category_name_cn: row.category_name_cn,
  };
}

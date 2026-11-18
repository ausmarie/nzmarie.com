import type { ReportEditorContent } from '@/types/report';

export type BlogLanguage = 'en' | 'cn';

export interface BlogCategory {
  id: string;
  name: string;
  name_cn: string;
  slug: string;
  description: string;
  post_count?: number;
}

export interface BlogPostSummary {
  id: string;
  slug: string;
  language: BlogLanguage;
  translation_group_id: string;
  title: string;
  summary: string;
  category_id: string | null;
  category_name: string | null;
  author: string;
  article_month: string;
  reading_minutes: number;
  status: 'draft' | 'published';
  has_unpublished_changes: boolean;
  published_at: string | null;
  updated_at: string;
}

export interface BlogPost extends BlogPostSummary {
  content: ReportEditorContent;
  published_reading_minutes: number | null;
}

export interface BlogCategoryInput {
  name: string;
  nameCn: string;
  slug: string;
  description: string;
}

export function isBlogLanguage(value: unknown): value is BlogLanguage {
  return value === 'en' || value === 'cn';
}

export function otherBlogLanguage(language: BlogLanguage): BlogLanguage {
  return language === 'en' ? 'cn' : 'en';
}

export function blogLanguageLabel(language: BlogLanguage): string {
  return language === 'en' ? 'English' : '中文';
}

export function localizedBlogCategoryName(
  category: { name: string; name_cn: string; slug: string },
  language: BlogLanguage,
): string {
  if (language === 'en') return category.name;
  if (category.name_cn.trim()) return category.name_cn;
  if (category.slug === 'buy') return '买房';
  if (category.slug === 'sell') return '卖房';
  return category.name;
}

export function defaultBlogCategoryNameCn(slug: string, name: string): string {
  if (slug === 'buy') return '买房';
  if (slug === 'sell') return '卖房';
  return name;
}

export function blogPreviewPath(slug: string, language: BlogLanguage): string {
  const basePath = `/admin/blog/preview/${encodeURIComponent(slug)}`;
  return language === 'cn' ? `${basePath}/cn` : basePath;
}

export function blogArticlePath(slug: string, language: BlogLanguage): string {
  const path = `/blog/${encodeURIComponent(slug)}`;
  return language === 'cn' ? `${path}/cn` : path;
}

export function slugifyBlogValue(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100)
    .replace(/-+$/g, '');
}

export function createBlogArticleSlug(title: string): string {
  const words = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .match(/[a-zA-Z]+/g)
    ?.slice(0, 6)
    .map((word) => word.toLowerCase());
  return (words?.join('-') || 'article').slice(0, 180).replace(/-+$/g, '');
}

export function parseBlogCategoryInput(body: unknown): BlogCategoryInput | null {
  if (!body || typeof body !== 'object') return null;
  const input = body as Record<string, unknown>;
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const nameCn = typeof input.nameCn === 'string' ? input.nameCn.trim() : '';
  const rawSlug = typeof input.slug === 'string' ? input.slug.trim() : '';
  const slug = slugifyBlogValue(rawSlug || name);
  const description = typeof input.description === 'string' ? input.description.trim() : '';
  if (!name || name.length > 80 || !nameCn || nameCn.length > 80
    || !slug || slug.length > 100 || description.length > 500) return null;
  return { name, nameCn, slug, description };
}

export function isValidBlogSlug(value: string): boolean {
  return value.length > 0
    && value.length <= 180
    && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

export function isValidBlogMonth(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function hasBlogArticleText(content: unknown): boolean {
  const collectText = (value: unknown): string => {
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return value.map(collectText).join(' ');
    if (value && typeof value === 'object') {
      const item = value as Record<string, unknown>;
      return `${collectText(item.text)} ${collectText(item.content)} ${collectText(item.children)}`;
    }
    return '';
  };
  return Array.isArray(content) && content.some((block) =>
    block
    && typeof block === 'object'
    && collectText((block as Record<string, unknown>).content).trim().length > 0,
  );
}

export function initialBlogContent(value: unknown): ReportEditorContent {
  return Array.isArray(value) ? value as ReportEditorContent : [{ type: 'paragraph' }];
}

export function currentBlogMonth(): string {
  const parts = new Intl.DateTimeFormat('en-NZ', {
    month: '2-digit',
    timeZone: 'Pacific/Auckland',
    year: 'numeric',
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  if (!year || !month) throw new Error('Unable to determine the current Blog month.');
  return `${year}-${month}`;
}

export function monthInputValue(value: string): string {
  return value.slice(0, 7);
}

export function monthLabel(value: string): string {
  const month = monthInputValue(value);
  if (!isValidBlogMonth(month)) return month;
  const [year, monthNumber] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('en-NZ', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, monthNumber - 1, 1)));
}

export function shortMonthLabel(value: string | Date): string {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    const year = value.getUTCFullYear();
    const monthName = new Intl.DateTimeFormat('en-NZ', { month: 'short', timeZone: 'UTC' })
      .format(new Date(Date.UTC(year, value.getUTCMonth(), 1)));
    return `${year} ${monthName}`;
  }

  const month = monthInputValue(value);
  if (!isValidBlogMonth(month)) return month;
  const [year, monthNumber] = month.split('-').map(Number);
  const monthName = new Intl.DateTimeFormat('en-NZ', { month: 'short', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, monthNumber - 1, 1)));
  return `${year} ${monthName}`;
}

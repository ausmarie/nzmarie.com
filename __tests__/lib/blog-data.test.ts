import { describe, expect, it } from 'vitest';
import {
  createBlogArticleSlug,
  blogLanguageLabel,
  blogPreviewPath,
  hasBlogArticleText,
  isValidBlogMonth,
  isValidBlogSlug,
  monthLabel,
  otherBlogLanguage,
  shortMonthLabel,
  slugifyBlogValue,
} from '@/lib/blog-data';

describe('Blog content helpers', () => {
  it('creates stable URL slugs from category and article names', () => {
    expect(slugifyBlogValue('  Buying & Selling in Auckland  ')).toBe('buying-selling-in-auckland');
    expect(slugifyBlogValue('Café Homes')).toBe('cafe-homes');
    expect(isValidBlogSlug('north-shore-buying-guide')).toBe(true);
    expect(isValidBlogSlug('Bad Slug')).toBe(false);
  });

  it('creates article slugs from the first six English words in the title', () => {
    expect(createBlogArticleSlug(
      'Selling Your Home in New Zealand: A Step-by-Step Guide for Homeowners',
    )).toBe('selling-your-home-in-new-zealand');
    expect(createBlogArticleSlug('中文标题')).toBe('article');
  });

  it('labels languages and builds language-specific admin preview paths', () => {
    expect(blogLanguageLabel('en')).toBe('English');
    expect(blogLanguageLabel('cn')).toBe('中文');
    expect(otherBlogLanguage('en')).toBe('cn');
    expect(otherBlogLanguage('cn')).toBe('en');
    expect(blogPreviewPath('selling-your-home', 'en')).toBe('/admin/blog/preview/selling-your-home');
    expect(blogPreviewPath('selling-your-home', 'cn')).toBe('/admin/blog/preview/selling-your-home/cn');
  });

  it('validates article month keys and formats month labels', () => {
    expect(isValidBlogMonth('2026-11')).toBe(true);
    expect(isValidBlogMonth('2026-13')).toBe(false);
    expect(monthLabel('2026-11-01')).toBe('November 2026');
    expect(shortMonthLabel('2026-11-01')).toBe('2026 Nov');
    expect(shortMonthLabel(new Date('2026-11-01T00:00:00.000Z'))).toBe('2026 Nov');
  });

  it('requires actual article text before publishing', () => {
    expect(hasBlogArticleText([{ type: 'paragraph', content: [{ type: 'text', text: 'Article content' }] }])).toBe(true);
    expect(hasBlogArticleText([{ type: 'paragraph', content: [] }])).toBe(false);
    expect(hasBlogArticleText(null)).toBe(false);
  });
});

CREATE UNIQUE INDEX IF NOT EXISTS blog_posts_published_slug_language_unique_idx
  ON blog_posts (published_slug, language)
  WHERE published_slug IS NOT NULL;

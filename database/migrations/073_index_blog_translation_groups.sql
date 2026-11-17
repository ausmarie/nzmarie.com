CREATE UNIQUE INDEX IF NOT EXISTS blog_posts_translation_group_language_idx
  ON blog_posts (translation_group_id, language);

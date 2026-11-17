ALTER TABLE blog_posts
  ALTER COLUMN translation_group_id SET NOT NULL,
  DROP CONSTRAINT IF EXISTS blog_posts_language_check,
  ADD CONSTRAINT blog_posts_language_check CHECK (language IN ('en', 'cn'));

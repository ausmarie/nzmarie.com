ALTER TABLE blog_posts
  ADD COLUMN IF NOT EXISTS reading_minutes INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS published_reading_minutes INTEGER,
  DROP CONSTRAINT IF EXISTS blog_posts_slug_key,
  DROP CONSTRAINT IF EXISTS blog_posts_reading_minutes_check,
  ADD CONSTRAINT blog_posts_reading_minutes_check
    CHECK (reading_minutes BETWEEN 1 AND 120);

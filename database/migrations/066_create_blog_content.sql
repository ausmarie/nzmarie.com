CREATE TABLE IF NOT EXISTS blog_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(80) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by VARCHAR(255) NOT NULL,
  updated_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS blog_categories_name_unique_idx
  ON blog_categories (LOWER(name));

CREATE TABLE IF NOT EXISTS blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(180) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL DEFAULT 'Untitled article',
  summary TEXT NOT NULL DEFAULT '',
  content JSONB NOT NULL DEFAULT '[]'::JSONB,
  category_id UUID REFERENCES blog_categories(id) ON DELETE SET NULL,
  author VARCHAR(160) NOT NULL DEFAULT '',
  article_month DATE NOT NULL DEFAULT DATE_TRUNC('month', CURRENT_DATE)::DATE,
  status VARCHAR(12) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published')),
  has_unpublished_changes BOOLEAN NOT NULL DEFAULT FALSE,
  published_slug VARCHAR(180),
  published_title VARCHAR(255),
  published_summary TEXT,
  published_content JSONB,
  published_category_id UUID REFERENCES blog_categories(id) ON DELETE SET NULL,
  published_author VARCHAR(160),
  published_month DATE,
  published_at TIMESTAMPTZ,
  created_by VARCHAR(255) NOT NULL,
  updated_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT blog_posts_article_month_check CHECK (
    EXTRACT(DAY FROM article_month) = 1
  )
);

CREATE INDEX IF NOT EXISTS blog_posts_status_month_idx
  ON blog_posts (status, article_month DESC);

CREATE INDEX IF NOT EXISTS blog_posts_category_month_idx
  ON blog_posts (category_id, article_month DESC);

CREATE INDEX IF NOT EXISTS blog_posts_published_at_idx
  ON blog_posts (published_at DESC)
  WHERE status = 'published';

CREATE UNIQUE INDEX IF NOT EXISTS blog_posts_published_slug_unique_idx
  ON blog_posts (published_slug)
  WHERE published_slug IS NOT NULL;

INSERT INTO blog_categories (name, slug, sort_order, created_by, updated_by)
VALUES
  ('Buy', 'buy', 0, 'system', 'system'),
  ('Sell', 'sell', 1, 'system', 'system')
ON CONFLICT (slug) DO NOTHING;

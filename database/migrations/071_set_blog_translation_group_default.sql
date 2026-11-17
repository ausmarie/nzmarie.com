ALTER TABLE blog_posts
  ALTER COLUMN translation_group_id SET DEFAULT gen_random_uuid();

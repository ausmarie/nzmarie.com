UPDATE blog_posts
SET translation_group_id = id
WHERE translation_group_id IS NULL;

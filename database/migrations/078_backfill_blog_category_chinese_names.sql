UPDATE blog_categories
SET name_cn = CASE slug
  WHEN 'buy' THEN '买房'
  WHEN 'sell' THEN '卖房'
  ELSE name
END
WHERE name_cn = '';

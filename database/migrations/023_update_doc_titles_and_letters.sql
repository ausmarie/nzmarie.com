UPDATE report_documents
SET title = regexp_replace(title, ' Introduction$', '')
WHERE doc_type = 'suburb_intro' AND title LIKE '% Introduction';

INSERT INTO report_documents (user_id, doc_type, suburb_id, title, content, sort_order, status)
SELECT
  (SELECT id FROM admin_users ORDER BY created_at ASC LIMIT 1),
  'letter',
  rs.id,
  rs.name || ' Letter',
  jsonb_build_array(
    jsonb_build_object('type', 'heading', 'props', jsonb_build_object('level', 1), 'content', jsonb_build_array(rs.name || ' Letter')),
    jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array('Dear Homeowner,')),
    jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array('I hope this letter finds you well. As your local real estate specialist for ' || rs.name || ', I wanted to reach out and share some recent market insights with you.')),
    jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array('The ' || rs.name || ' property market continues to show strong activity. Whether you are considering selling, buying, or simply curious about your propertys current value, I am here to help.')),
    jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array('I would love the opportunity to provide you with a free, no-obligation market appraisal of your property.')),
    jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array('Warm regards,')),
    jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array('Marie Leulan')),
    jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array('www.nzmarie.co.nz'))
  ),
  1,
  'draft'
FROM report_suburbs rs
WHERE rs.is_active = TRUE
  AND NOT EXISTS (
    SELECT 1 FROM report_documents rd
    WHERE rd.suburb_id = rs.id AND rd.doc_type = 'letter' AND rd.status != 'archived'
  );

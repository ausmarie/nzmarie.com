INSERT INTO report_documents (user_id, doc_type, suburb_id, title, content, sort_order, status)
SELECT
  (SELECT id FROM admin_users ORDER BY created_at ASC LIMIT 1),
  'suburb_intro',
  rs.id,
  rs.name || ' Introduction',
  jsonb_build_array(
    jsonb_build_object('type', 'heading', 'props', jsonb_build_object('level', 1), 'content', jsonb_build_array(rs.name || ' Introduction')),
    jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array('Welcome to ' || rs.name || '. This page provides an overview of the suburb, including location, amenities, and market insights.')),
    jsonb_build_object('type', 'heading', 'props', jsonb_build_object('level', 2), 'content', jsonb_build_array('Location & Demographics')),
    jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(rs.name || ' is located on the North Shore of Auckland, New Zealand. It offers a mix of residential properties, parks, and convenient access to local amenities.')),
    jsonb_build_object('type', 'heading', 'props', jsonb_build_object('level', 2), 'content', jsonb_build_array('Schools & Education')),
    jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array('Local schools serve the ' || rs.name || ' area, providing quality education options for families.')),
    jsonb_build_object('type', 'heading', 'props', jsonb_build_object('level', 2), 'content', jsonb_build_array('Transport & Access')),
    jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(rs.name || ' is well-connected by road and public transport, with easy access to the Northern Motorway and local bus routes.'))
  ),
  0,
  'draft'
FROM report_suburbs rs
WHERE rs.is_active = TRUE
  AND NOT EXISTS (
    SELECT 1 FROM report_documents rd
    WHERE rd.suburb_id = rs.id AND rd.doc_type = 'suburb_intro' AND rd.status != 'archived'
  );

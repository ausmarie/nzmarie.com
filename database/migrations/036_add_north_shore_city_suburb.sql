-- Add North Shore as a district-level report suburb entity

INSERT INTO report_suburbs (name, region, sort_order, is_active)
SELECT 'North Shore', 'North Shore', 0, TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM report_suburbs WHERE name = 'North Shore'
);

-- Create a suburb_intro document for North Shore
INSERT INTO report_documents (user_id, doc_type, suburb_id, title, content, sort_order, status)
SELECT
  (SELECT id FROM admin_users ORDER BY created_at ASC LIMIT 1),
  'suburb_intro',
  rs.id,
  'North Shore Introduction',
  jsonb_build_array(
    jsonb_build_object('type', 'heading', 'props', jsonb_build_object('level', 1), 'content', jsonb_build_array('North Shore Introduction')),
    jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array('Welcome to North Shore. This page provides an overview of the district, including location, amenities, and market insights.')),
    jsonb_build_object('type', 'heading', 'props', jsonb_build_object('level', 2), 'content', jsonb_build_array('Location & Demographics')),
    jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array('North Shore is located on the North Shore of Auckland, New Zealand. It encompasses a diverse range of suburbs from coastal communities to inland suburbs, offering a mix of residential properties, parks, and convenient access to local amenities.')),
    jsonb_build_object('type', 'heading', 'props', jsonb_build_object('level', 2), 'content', jsonb_build_array('Schools & Education')),
    jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array('North Shore is served by numerous primary and secondary schools, providing quality education options for families across the district.')),
    jsonb_build_object('type', 'heading', 'props', jsonb_build_object('level', 2), 'content', jsonb_build_array('Transport & Access')),
    jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array('North Shore is well-connected by road and public transport, with easy access to the Northern Motorway, local bus routes, and ferry services to Auckland CBD.'))
  ),
  0,
  'draft'
FROM report_suburbs rs
WHERE rs.name = 'North Shore'
  AND NOT EXISTS (
    SELECT 1 FROM report_documents rd
    WHERE rd.suburb_id = rs.id AND rd.doc_type = 'suburb_intro' AND rd.status != 'archived'
  );

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
WHERE rs.name IN ('Bayswater', 'Bayview', 'Beach Haven', 'Belmont', 'Birkdale', 'Devonport', 'Northcote', 'Takapuna', 'Totara Vale')
  AND NOT EXISTS (
    SELECT 1 FROM report_documents rd
    WHERE rd.suburb_id = rs.id AND rd.doc_type = 'suburb_intro' AND rd.status != 'archived'
  );

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
WHERE rs.name IN ('Bayswater', 'Bayview', 'Beach Haven', 'Belmont', 'Birkdale', 'Devonport', 'Northcote', 'Takapuna', 'Totara Vale')
  AND NOT EXISTS (
    SELECT 1 FROM report_documents rd
    WHERE rd.suburb_id = rs.id AND rd.doc_type = 'letter' AND rd.status != 'archived'
  );

INSERT INTO report_documents (user_id, doc_type, suburb_id, quarter, title, content, sort_order, status)
SELECT
  (SELECT id FROM admin_users ORDER BY created_at ASC LIMIT 1),
  'report',
  rs.id,
  '2026-Q2',
  rs.name || ' 2026-Q2 Report',
  jsonb_build_array(
    jsonb_build_object('type', 'heading', 'props', jsonb_build_object('level', 1, 'textAlignment', 'center'), 'content', jsonb_build_array(rs.name)),
    jsonb_build_object('type', 'heading', 'props', jsonb_build_object('level', 2, 'textAlignment', 'center'), 'content', jsonb_build_array('2026-Q2 Report')),
    jsonb_build_object('type', 'paragraph', 'props', jsonb_build_object('textAlignment', 'center'), 'content', jsonb_build_array('Prepared by Marie Leulan — nzmarie.co.nz')),
    jsonb_build_object('type', 'paragraph', 'props', jsonb_build_object('textAlignment', 'center'), 'content', jsonb_build_array('Date: June 2026')),
    jsonb_build_object('type', 'divider'),
    jsonb_build_object('type', 'heading', 'props', jsonb_build_object('level', 2), 'content', jsonb_build_array('Executive Summary')),
    jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array('The ' || rs.name || ' property market in Q2 2026 has shown continued activity with stable demand from buyers. This report provides a detailed analysis of market trends, sales data, and key insights for homeowners and investors.')),
    jsonb_build_object('type', 'divider'),
    jsonb_build_object('type', 'heading', 'props', jsonb_build_object('level', 2), 'content', jsonb_build_array('REINZ Market Trends')),
    jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array('Quarterly market data for ' || rs.name || ' compared with North Shore City district averages.')),
    jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array('Median prices in ' || rs.name || ' have reflected broader North Shore market conditions. Buyer demand remains consistent, with well-presented properties achieving strong results.')),
    jsonb_build_object('type', 'divider'),
    jsonb_build_object('type', 'heading', 'props', jsonb_build_object('level', 2), 'content', jsonb_build_array('Sales Analysis')),
    jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array('An analysis of recent sales activity in ' || rs.name || ' during the second quarter of 2026.')),
    jsonb_build_object('type', 'bulletListItem', 'content', jsonb_build_array('Consistent sales volume across the quarter')),
    jsonb_build_object('type', 'bulletListItem', 'content', jsonb_build_array('Well-maintained homes continue to attract strong buyer interest')),
    jsonb_build_object('type', 'bulletListItem', 'content', jsonb_build_array('Days on market reflect balanced supply and demand dynamics')),
    jsonb_build_object('type', 'divider'),
    jsonb_build_object('type', 'heading', 'props', jsonb_build_object('level', 2), 'content', jsonb_build_array('About Marie Leulan')),
    jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array('Marie Leulan is a dedicated real estate professional serving the North Shore community. With extensive local market knowledge, Marie provides personalised service to buyers and sellers across the North Shore.')),
    jsonb_build_object('type', 'heading', 'props', jsonb_build_object('level', 3), 'content', jsonb_build_array('Services Offered')),
    jsonb_build_object('type', 'bulletListItem', 'content', jsonb_build_array('Free property appraisals and market analysis')),
    jsonb_build_object('type', 'bulletListItem', 'content', jsonb_build_array('Expert negotiation and sales strategy')),
    jsonb_build_object('type', 'bulletListItem', 'content', jsonb_build_array('Comprehensive marketing campaigns')),
    jsonb_build_object('type', 'bulletListItem', 'content', jsonb_build_array('Buyer representation and property search')),
    jsonb_build_object('type', 'bulletListItem', 'content', jsonb_build_array('Investment portfolio advice')),
    jsonb_build_object('type', 'paragraph', 'props', jsonb_build_object('textAlignment', 'center'), 'content', jsonb_build_array('www.nzmarie.co.nz'))
  ),
  2,
  'draft'
FROM report_suburbs rs
WHERE rs.name IN ('Bayswater', 'Bayview', 'Beach Haven', 'Belmont', 'Birkdale', 'Devonport', 'Northcote', 'Takapuna', 'Totara Vale')
  AND NOT EXISTS (
    SELECT 1 FROM report_documents rd
    WHERE rd.suburb_id = rs.id AND rd.quarter = '2026-Q2' AND rd.doc_type = 'report' AND rd.status != 'archived'
  );

-- Sync report_suburbs with SUBURB_PRIORITY_ORDER (lib/suburb-order.ts)
-- North Shore stays first (sort_order 0); suburbs follow the priority order.
-- Also seeds introduction, letter and a quarterly report for the newly added
-- suburbs, following the same pattern as migrations 022/027/044.

INSERT INTO report_suburbs (name, region, sort_order, is_active)
VALUES
  ('North Shore', 'North Shore', 0, TRUE),
  ('Northcross', 'North Shore', 1, TRUE),
  ('Oteha', 'North Shore', 2, TRUE),
  ('Torbay', 'North Shore', 3, TRUE),
  ('Fairview Heights', 'North Shore', 4, TRUE),
  ('Waiake', 'North Shore', 5, TRUE),
  ('Browns Bay', 'North Shore', 6, TRUE),
  ('Long Bay', 'North Shore', 7, TRUE),
  ('Pinehill', 'North Shore', 8, TRUE),
  ('Rothesay Bay', 'North Shore', 9, TRUE),
  ('Murrays Bay', 'North Shore', 10, TRUE),
  ('Albany', 'North Shore', 11, TRUE),
  ('Rosedale', 'North Shore', 12, TRUE),
  ('Mairangi Bay', 'North Shore', 13, TRUE),
  ('Campbells Bay', 'North Shore', 14, TRUE),
  ('Sunnynook', 'North Shore', 15, TRUE),
  ('Unsworth Heights', 'North Shore', 16, TRUE),
  ('Schnapper Rock', 'North Shore', 17, TRUE),
  ('Greenhithe', 'North Shore', 18, TRUE),
  ('Totara Vale', 'North Shore', 19, TRUE),
  ('Castor Bay', 'North Shore', 20, TRUE),
  ('Forrest Hill', 'North Shore', 21, TRUE),
  ('Bayview', 'North Shore', 22, TRUE),
  ('Wairau Valley', 'North Shore', 23, TRUE),
  ('Glenfield', 'North Shore', 24, TRUE),
  ('Milford', 'North Shore', 25, TRUE),
  ('Hillcrest', 'North Shore', 26, TRUE),
  ('Birkdale', 'North Shore', 27, TRUE),
  ('Beach Haven', 'North Shore', 28, TRUE),
  ('Takapuna', 'North Shore', 29, TRUE),
  ('Northcote', 'North Shore', 30, TRUE),
  ('Birkenhead', 'North Shore', 31, TRUE),
  ('Hauraki', 'North Shore', 32, TRUE),
  ('Chatswood', 'North Shore', 33, TRUE),
  ('Northcote Point', 'North Shore', 34, TRUE),
  ('Belmont', 'North Shore', 35, TRUE),
  ('Bayswater', 'North Shore', 36, TRUE),
  ('Devonport', 'North Shore', 37, TRUE),
  ('Stanley Point', 'North Shore', 38, TRUE)
ON CONFLICT (name) DO UPDATE
SET sort_order = EXCLUDED.sort_order,
    region = EXCLUDED.region,
    is_active = TRUE,
    updated_at = NOW();

-- Suburbs outside the priority list (e.g. legacy rows seeded from the
-- properties table) keep their documents but sort after the known list.
WITH extras AS (
  SELECT name, ROW_NUMBER() OVER (ORDER BY name) AS rn
  FROM report_suburbs
  WHERE name NOT IN (
    'North Shore', 'Northcross', 'Oteha', 'Torbay', 'Fairview Heights', 'Waiake',
    'Browns Bay', 'Long Bay', 'Pinehill', 'Rothesay Bay', 'Murrays Bay', 'Albany',
    'Rosedale', 'Mairangi Bay', 'Campbells Bay', 'Sunnynook', 'Unsworth Heights',
    'Schnapper Rock', 'Greenhithe', 'Totara Vale', 'Castor Bay', 'Forrest Hill',
    'Bayview', 'Wairau Valley', 'Glenfield', 'Milford', 'Hillcrest', 'Birkdale',
    'Beach Haven', 'Takapuna', 'Northcote', 'Birkenhead', 'Hauraki', 'Chatswood',
    'Northcote Point', 'Belmont', 'Bayswater', 'Narrow Neck', 'Devonport', 'Stanley Point'
  )
)
UPDATE report_suburbs rs
SET sort_order = 1000 + extras.rn, updated_at = NOW()
FROM extras
WHERE rs.name = extras.name;

-- Deactivate legacy non-priority suburbs so they no longer appear in the
-- reports sidebar or suburb pickers (their documents are kept in the DB).
UPDATE report_suburbs
SET is_active = FALSE, updated_at = NOW()
WHERE name IN ('Albany Heights', 'Howick', 'Lucas Heights', 'Panmure');

-- Suburb introductions for the new suburbs
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
WHERE rs.name IN ('Rosedale', 'Wairau Valley', 'Northcote Point', 'Stanley Point')
  AND NOT EXISTS (
    SELECT 1 FROM report_documents rd
    WHERE rd.suburb_id = rs.id AND rd.doc_type = 'suburb_intro' AND rd.status != 'archived'
  );

-- Letters for the new suburbs
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
WHERE rs.name IN ('Rosedale', 'Wairau Valley', 'Northcote Point', 'Stanley Point')
  AND NOT EXISTS (
    SELECT 1 FROM report_documents rd
    WHERE rd.suburb_id = rs.id AND rd.doc_type = 'letter' AND rd.status != 'archived'
  );

-- Quarterly market reports for the new suburbs (same quarter as migration 044)
INSERT INTO report_documents (user_id, doc_type, suburb_id, quarter, title, content, sort_order, status)
SELECT
  (SELECT id FROM admin_users ORDER BY created_at ASC LIMIT 1),
  'report',
  rs.id,
  '2026-Q2',
  rs.name || ' 2026-Q2 Report',
  jsonb_build_array(
    jsonb_build_object('type', 'heading', 'props', jsonb_build_object('level', 1, 'textAlignment', 'center'), 'content', jsonb_build_array(rs.name)),
    jsonb_build_object('type', 'heading', 'props', jsonb_build_object('level', 2, 'textAlignment', 'center'), 'content', jsonb_build_array('2026-Q2 Market Report')),
    jsonb_build_object('type', 'paragraph', 'props', jsonb_build_object('textAlignment', 'center'), 'content', jsonb_build_array('Prepared by Marie Leulan - nzmarie.co.nz')),
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
WHERE rs.name IN ('Rosedale', 'Wairau Valley', 'Northcote Point', 'Stanley Point')
  AND NOT EXISTS (
    SELECT 1 FROM report_documents rd
    WHERE rd.suburb_id = rs.id AND rd.quarter = '2026-Q2' AND rd.doc_type = 'report' AND rd.status != 'archived' AND rd.lead_id IS NULL
  );

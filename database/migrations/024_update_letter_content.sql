UPDATE report_documents rd
SET content = jsonb_build_array(
    jsonb_build_object('type', 'heading', 'props', jsonb_build_object('level', 1), 'content', jsonb_build_array('Dear Neighbour,')),
    jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array('I hope this note finds you well.')),
    jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(
      'As a local real estate professional with Barfoot & Thompson North Shore, I often walk through our neighbourhood. I always enjoy turning onto ' || (SELECT CASE rs.name
        WHEN 'Northcross' THEN 'Brian Avenue'
        WHEN 'Oteha' THEN 'Oteha Valley Road'
        WHEN 'Torbay' THEN 'Kate Sheppard Avenue'
        WHEN 'Fairview Heights' THEN 'Fairview Avenue'
        WHEN 'Waiake' THEN 'Waiake Road'
        WHEN 'Browns Bay' THEN 'Clyde Road'
        WHEN 'Pinehill' THEN 'Sylvan Avenue'
        WHEN 'Rothesay Bay' THEN 'Rothesay Bay Road'
        WHEN 'Murrays Bay' THEN 'Sunset Road'
        WHEN 'Albany' THEN 'Oteha Valley Road'
        WHEN 'Long Bay' THEN 'Bounty Street'
        WHEN 'Forrest Hill' THEN 'Forrest Hill Road'
        WHEN 'Schnapper Rock' THEN 'Schnapper Rock Road'
        WHEN 'Unsworth Heights' THEN 'Unsworth Drive'
        WHEN 'Sunnynook' THEN 'Sunnynook Road'
        WHEN 'Greenhithe' THEN 'Greenhithe Road'
        WHEN 'Chatswood' THEN 'Chatswood Crescent'
        WHEN 'Mairangi Bay' THEN 'Mairangi Road'
        WHEN 'Campbells Bay' THEN 'Beach Road'
        WHEN 'Castor Bay' THEN 'Castor Bay Road'
        WHEN 'Milford' THEN 'Milford Road'
        WHEN 'Glenfield' THEN 'Glenfield Road'
        WHEN 'Hillcrest' THEN 'Hillcrest Road'
        WHEN 'Birkenhead' THEN 'Birkenhead Avenue'
        WHEN 'Hauraki' THEN 'Hauraki Road'
        ELSE rs.name || ' Avenue'
      END FROM report_suburbs rs WHERE rs.id = rd.suburb_id) || ', the pride of ownership here is clear in the beautifully maintained homes and gardens, which contribute so much to the premium character of our community.'
    )),
    jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(
      'With the 2026 property market adjusting to recent interest rate changes, many ' || (SELECT name FROM report_suburbs WHERE id = rd.suburb_id) || ' homeowners have been asking about the real impact on their property values.'
    )),
    jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(
      'To help with this, I have prepared a 2026 Hyper-Local Market Insight Report, analysing recent sales, buyer demand, and micro-trends for homes of this calibre in our immediate area.'
    )),
    jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(
      'If you would like a complimentary digital copy emailed to you, or if you are simply curious about where your home sits in todays market, please feel free to text, call, or email me anytime.'
    )),
    jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(
      'You can also visit www.nzmarie.com to request your report online and learn more about my local real estate services.'
    )),
    jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array('No sales pitch. Just transparent data to help you track your equity.')),
    jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array('Wishing you and your family a wonderful week ahead.')),
    jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array('Kind regards,')),
    jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array('Marie Nian')),
    jsonb_build_object('type', 'paragraph', 'props', jsonb_build_object('textAlignment', 'center'), 'content', jsonb_build_array('Residential Sales')),
    jsonb_build_object('type', 'paragraph', 'props', jsonb_build_object('textAlignment', 'center'), 'content', jsonb_build_array('Barfoot & Thompson (Licensed REAA 2008)')),
    jsonb_build_object('type', 'paragraph', 'props', jsonb_build_object('textAlignment', 'center'), 'content', jsonb_build_array('📱 021 069 3089')),
    jsonb_build_object('type', 'paragraph', 'props', jsonb_build_object('textAlignment', 'center'), 'content', jsonb_build_array('📧 m.nian@barfoot.co.nz')),
    jsonb_build_object('type', 'paragraph', 'props', jsonb_build_object('textAlignment', 'center'), 'content', jsonb_build_array('🌐 www.nzmarie.com'))
  ),
  title = (SELECT name FROM report_suburbs WHERE id = rd.suburb_id) || ' Letter'
WHERE rd.doc_type = 'letter' AND rd.status != 'archived';

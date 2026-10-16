INSERT INTO report_suburbs (name, region, sort_order, is_active)
VALUES
  ('Bayswater', 'North Shore', 100, TRUE),
  ('Bayview', 'North Shore', 101, TRUE),
  ('Beach Haven', 'North Shore', 102, TRUE),
  ('Belmont', 'North Shore', 103, TRUE),
  ('Birkdale', 'North Shore', 104, TRUE),
  ('Devonport', 'North Shore', 105, TRUE),
  ('Northcote', 'North Shore', 106, TRUE),
  ('Takapuna', 'North Shore', 107, TRUE),
  ('Totara Vale', 'North Shore', 108, TRUE)
ON CONFLICT (name) DO NOTHING;

-- Migration: Copy data from outreach_selected_properties to outreach_properties
-- Run this after 001_create_outreach_properties.sql

-- Copy existing data if old table exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'outreach_selected_properties') THEN
    INSERT INTO outreach_properties (
      louis_property_id,
      property_address,
      suburb,
      city,
      region,
      street,
      property_type,
      campaign,
      status,
      sent_at,
      notes,
      created_at,
      updated_at
    )
    SELECT 
      louis_property_id::VARCHAR(100),
      property_address,
      suburb,
      COALESCE(city, 'Auckland City'),
      'Auckland' as region,
      street,
      NULL as property_type,
      '2026_Q3_Report' as campaign,
      CASE 
        WHEN status = 'PENDING' THEN 'pending'
        WHEN status = 'SENT' THEN 'sent'
        WHEN status = 'COMPLETED' THEN 'converted'
        ELSE 'pending'
      END as status,
      sent_at,
      notes,
      created_at,
      updated_at
    FROM outreach_selected_properties
    ON CONFLICT (property_address, campaign) DO NOTHING;
    
    RAISE NOTICE 'Data migration completed from outreach_selected_properties';
  ELSE
    RAISE NOTICE 'Old table outreach_selected_properties does not exist, skipping data migration';
  END IF;
END $$;

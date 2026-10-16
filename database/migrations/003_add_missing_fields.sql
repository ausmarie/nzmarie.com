-- =====================================================
-- Add Missing Fields and Functions
-- Created: 2026-06-29
-- Purpose: Add phone column and check_download_limit function
-- Note: CockroachDB has limitations, so we only add what's missing
-- =====================================================

-- 1. Add phone column to report_downloads if missing
ALTER TABLE report_downloads
ADD COLUMN IF NOT EXISTS phone VARCHAR(50);

-- 2. Add index on phone (CockroachDB will ignore if exists)
CREATE INDEX IF NOT EXISTS idx_downloads_phone ON report_downloads(phone);

-- 3. Create check_download_limit function (only if it doesn't exist)
-- Note: If function exists, skip this manually
CREATE OR REPLACE FUNCTION check_download_limit(
  p_email VARCHAR(255),
  p_suburb VARCHAR(100)
) RETURNS JSON AS $$
DECLARE
  v_count INT;
  v_can_download BOOLEAN;
  v_message TEXT;
  v_reset_date TIMESTAMPTZ;
BEGIN
  -- Count downloads this month
  SELECT COUNT(*) INTO v_count
  FROM report_downloads
  WHERE email = p_email
  AND suburb = p_suburb
  AND downloaded_at >= date_trunc('month', CURRENT_TIMESTAMP);
  
  -- Check limit (5 per month)
  v_can_download := (v_count < 5);
  v_reset_date := date_trunc('month', CURRENT_TIMESTAMP) + interval '1 month';
  
  IF v_can_download THEN
    v_message := format('You can download %s more times this month', 5 - v_count);
  ELSE
    v_message := 'Download limit reached for this month (5 downloads max)';
  END IF;
  
  RETURN json_build_object(
    'can_download', v_can_download,
    'current_count', v_count,
    'limit', 5,
    'remaining', GREATEST(0, 5 - v_count),
    'message', v_message,
    'reset_date', v_reset_date
  );
END;
$$ LANGUAGE plpgsql;

-- 4. Test the function
SELECT check_download_limit('test@example.com', 'Albany') as test_result;

-- =====================================================
-- Migration Complete
-- Note: Triggers will need to be created separately if needed
-- =====================================================

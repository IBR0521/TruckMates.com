-- Quick check: Verify populate_demo_data_for_company function exists
-- Run this in Supabase SQL Editor to check if the function is there

SELECT 
  routine_name,
  routine_type,
  data_type
FROM information_schema.routines
WHERE routine_schema = 'public' 
  AND routine_name = 'populate_demo_data_for_company';

-- If the above returns nothing, the function doesn't exist!
-- Run supabase/populate_demo_data_function.sql to create it















-- ============================================================================
-- Verify RLS Performance Fixes
-- ============================================================================
-- This query helps identify which policies might still be causing warnings
-- Run this to check if policies are using the optimized helper functions
-- ============================================================================

-- Check if helper functions exist
SELECT 
  'Helper Functions Check' as check_type,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_user_company_id') 
      THEN '✅ get_user_company_id exists'
    ELSE '❌ get_user_company_id MISSING'
  END as status
UNION ALL
SELECT 
  'Helper Functions Check' as check_type,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_user_manager') 
      THEN '✅ is_user_manager exists'
    ELSE '❌ is_user_manager MISSING'
  END as status;

-- Check policies that are still using auth.uid() directly (should use (select auth.uid()))
-- Note: pg_policies doesn't have a 'definition' column, so we query pg_policy directly
SELECT 
  n.nspname as schemaname,
  c.relname as tablename,
  pol.polname as policyname,
  pg_get_expr(pol.polqual, pol.polrelid) as using_expression,
  pg_get_expr(pol.polwithcheck, pol.polrelid) as with_check_expression,
  '⚠️ Uses auth.uid() directly' as issue
FROM pg_policy pol
JOIN pg_class c ON c.oid = pol.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND (
    pg_get_expr(pol.polqual, pol.polrelid) LIKE '%auth.uid()%'
    OR pg_get_expr(pol.polwithcheck, pol.polrelid) LIKE '%auth.uid()%'
  )
  AND (
    pg_get_expr(pol.polqual, pol.polrelid) NOT LIKE '%(select auth.uid())%'
    AND pg_get_expr(pol.polwithcheck, pol.polrelid) NOT LIKE '%(select auth.uid())%'
  )
ORDER BY c.relname, pol.polname;

-- Check policies that might have multiple permissive policies (consolidation needed)
SELECT 
  tablename,
  COUNT(*) as policy_count,
  '⚠️ Multiple policies - may need consolidation' as issue
FROM pg_policies
WHERE schemaname = 'public'
  AND policyname NOT LIKE '%System can%'
  AND policyname NOT LIKE '%Public%'
GROUP BY tablename
HAVING COUNT(*) > 3  -- Tables with more than 3 policies might need consolidation
ORDER BY policy_count DESC;

-- Check if policies are using the helper functions
SELECT 
  n.nspname as schemaname,
  c.relname as tablename,
  pol.polname as policyname,
  CASE 
    WHEN pg_get_expr(pol.polqual, pol.polrelid) LIKE '%get_user_company_id()%' 
      OR pg_get_expr(pol.polwithcheck, pol.polrelid) LIKE '%get_user_company_id()%'
      THEN '✅ Using helper function'
    WHEN pg_get_expr(pol.polqual, pol.polrelid) LIKE '%(select auth.uid())%'
      OR pg_get_expr(pol.polwithcheck, pol.polrelid) LIKE '%(select auth.uid())%'
      THEN '✅ Using optimized auth.uid()'
    ELSE '⚠️ May need optimization'
  END as optimization_status
FROM pg_policy pol
JOIN pg_class c ON c.oid = pol.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND (
    pg_get_expr(pol.polqual, pol.polrelid) LIKE '%company_id%' 
    OR pg_get_expr(pol.polwithcheck, pol.polrelid) LIKE '%company_id%'
    OR pg_get_expr(pol.polqual, pol.polrelid) LIKE '%auth.uid()%'
    OR pg_get_expr(pol.polwithcheck, pol.polrelid) LIKE '%auth.uid()%'
  )
ORDER BY c.relname, pol.polname;


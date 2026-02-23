-- ============================================================================
-- Refresh Supabase Linter Cache
-- ============================================================================
-- Sometimes Supabase linter warnings are cached. This helps refresh them.
-- Run this after applying the RLS performance fixes.
-- ============================================================================

-- Notify PostgREST to reload schema (helps refresh linter cache)
NOTIFY pgrst, 'reload schema';

-- Alternative: Force a schema reload by querying system tables
SELECT pg_notify('pgrst', 'reload schema');

-- Check current policies to verify they're using optimized patterns
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
    WHEN (pg_get_expr(pol.polqual, pol.polrelid) LIKE '%auth.uid()%'
      OR pg_get_expr(pol.polwithcheck, pol.polrelid) LIKE '%auth.uid()%')
      AND (pg_get_expr(pol.polqual, pol.polrelid) NOT LIKE '%(select auth.uid())%'
        AND pg_get_expr(pol.polwithcheck, pol.polrelid) NOT LIKE '%(select auth.uid())%')
      THEN '⚠️ Still using direct auth.uid()'
    ELSE 'ℹ️ No auth.uid() check'
  END as optimization_status,
  CASE pol.polcmd
    WHEN 'r' THEN 'SELECT'
    WHEN 'a' THEN 'INSERT'
    WHEN 'w' THEN 'UPDATE'
    WHEN 'd' THEN 'DELETE'
    WHEN '*' THEN 'ALL'
  END as operation_type
FROM pg_policy pol
JOIN pg_class c ON c.oid = pol.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND (
    pg_get_expr(pol.polqual, pol.polrelid) LIKE '%auth.uid()%' 
    OR pg_get_expr(pol.polwithcheck, pol.polrelid) LIKE '%auth.uid()%'
    OR pg_get_expr(pol.polqual, pol.polrelid) LIKE '%company_id%'
    OR pg_get_expr(pol.polwithcheck, pol.polrelid) LIKE '%company_id%'
  )
ORDER BY 
  CASE 
    WHEN (pg_get_expr(pol.polqual, pol.polrelid) LIKE '%auth.uid()%'
          OR pg_get_expr(pol.polwithcheck, pol.polrelid) LIKE '%auth.uid()%')
      AND (pg_get_expr(pol.polqual, pol.polrelid) NOT LIKE '%(select auth.uid())%'
           AND pg_get_expr(pol.polwithcheck, pol.polrelid) NOT LIKE '%(select auth.uid())%')
      THEN 1
    ELSE 2
  END,
  c.relname,
  pol.polname;


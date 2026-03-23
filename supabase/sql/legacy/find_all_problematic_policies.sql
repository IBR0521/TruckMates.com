-- ============================================================================
-- Find ALL Policies That Still Need Optimization
-- ============================================================================
-- This query finds policies that are still causing warnings
-- Run this to see which policies need to be fixed
-- ============================================================================

-- 1. Find policies using auth.uid() directly (not optimized)
SELECT 
  'auth_rls_initplan warning' as warning_type,
  c.relname as tablename,
  pol.polname as policyname,
  CASE pol.polcmd
    WHEN 'r' THEN 'SELECT'
    WHEN 'a' THEN 'INSERT'
    WHEN 'w' THEN 'UPDATE'
    WHEN 'd' THEN 'DELETE'
    WHEN '*' THEN 'ALL'
  END as operation,
  'Still uses auth.uid() directly - needs (select auth.uid())' as issue,
  COALESCE(pg_get_expr(pol.polqual, pol.polrelid), '') || ' | ' || 
  COALESCE(pg_get_expr(pol.polwithcheck, pol.polrelid), '') as expressions
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
  AND (
    pg_get_expr(pol.polqual, pol.polrelid) NOT LIKE '%SELECT auth.uid()%'
    AND pg_get_expr(pol.polwithcheck, pol.polrelid) NOT LIKE '%SELECT auth.uid()%'
  )
ORDER BY c.relname, pol.polname;

-- 2. Find policies using company_id IN (SELECT...) pattern (not optimized)
SELECT 
  'auth_rls_initplan warning' as warning_type,
  c.relname as tablename,
  pol.polname as policyname,
  CASE pol.polcmd
    WHEN 'r' THEN 'SELECT'
    WHEN 'a' THEN 'INSERT'
    WHEN 'w' THEN 'UPDATE'
    WHEN 'd' THEN 'DELETE'
    WHEN '*' THEN 'ALL'
  END as operation,
  'Uses company_id IN (SELECT...) - should use get_user_company_id()' as issue,
  COALESCE(pg_get_expr(pol.polqual, pol.polrelid), '') || ' | ' || 
  COALESCE(pg_get_expr(pol.polwithcheck, pol.polrelid), '') as expressions
FROM pg_policy pol
JOIN pg_class c ON c.oid = pol.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND (
    pg_get_expr(pol.polqual, pol.polrelid) LIKE '%company_id IN (SELECT%'
    OR pg_get_expr(pol.polwithcheck, pol.polrelid) LIKE '%company_id IN (SELECT%'
  )
  AND (
    pg_get_expr(pol.polqual, pol.polrelid) NOT LIKE '%get_user_company_id()%'
    AND pg_get_expr(pol.polwithcheck, pol.polrelid) NOT LIKE '%get_user_company_id()%'
  )
ORDER BY c.relname, pol.polname;

-- 3. Find tables with multiple permissive policies (consolidation opportunity)
SELECT 
  'multiple_permissive_policies warning' as warning_type,
  tablename,
  cmd as operation,
  COUNT(*) as policy_count,
  STRING_AGG(policyname, ', ' ORDER BY policyname) as policy_names,
  'Multiple policies for same operation - consider consolidating' as issue
FROM pg_policies
WHERE schemaname = 'public'
  AND cmd IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
  AND policyname NOT LIKE '%System can%'
  AND policyname NOT LIKE '%Public%'
GROUP BY tablename, cmd
HAVING COUNT(*) > 2  -- More than 2 policies for same operation
ORDER BY policy_count DESC, tablename, cmd;

-- 4. Summary: Count of problematic policies
SELECT 
  'Summary' as check_type,
  COUNT(*) FILTER (
    WHERE (pg_get_expr(pol.polqual, pol.polrelid) LIKE '%auth.uid()%' 
           OR pg_get_expr(pol.polwithcheck, pol.polrelid) LIKE '%auth.uid()%')
    AND (pg_get_expr(pol.polqual, pol.polrelid) NOT LIKE '%(select auth.uid())%'
         AND pg_get_expr(pol.polwithcheck, pol.polrelid) NOT LIKE '%(select auth.uid())%')
  ) as policies_with_direct_auth_uid,
  COUNT(*) FILTER (
    WHERE (pg_get_expr(pol.polqual, pol.polrelid) LIKE '%company_id IN (SELECT%'
           OR pg_get_expr(pol.polwithcheck, pol.polrelid) LIKE '%company_id IN (SELECT%')
    AND (pg_get_expr(pol.polqual, pol.polrelid) NOT LIKE '%get_user_company_id()%'
         AND pg_get_expr(pol.polwithcheck, pol.polrelid) NOT LIKE '%get_user_company_id()%')
  ) as policies_with_in_subquery,
  COUNT(DISTINCT c.relname) FILTER (
    WHERE pg_get_expr(pol.polqual, pol.polrelid) LIKE '%auth.uid()%' 
       OR pg_get_expr(pol.polwithcheck, pol.polrelid) LIKE '%auth.uid()%'
       OR pg_get_expr(pol.polqual, pol.polrelid) LIKE '%company_id%'
       OR pg_get_expr(pol.polwithcheck, pol.polrelid) LIKE '%company_id%'
  ) as tables_with_rls_policies
FROM pg_policy pol
JOIN pg_class c ON c.oid = pol.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public';


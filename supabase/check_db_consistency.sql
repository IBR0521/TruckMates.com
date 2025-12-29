-- Database Consistency Check
-- This script helps identify inconsistencies between your codebase and Supabase database
-- Run this in Supabase SQL Editor to see what exists

-- ============================================================================
-- CHECK 1: Tables that should exist (based on schema files)
-- ============================================================================

SELECT 
  'Expected Tables' as check_type,
  table_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = t.table_name
    ) THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END as status
FROM (
  VALUES 
    ('users'),
    ('companies'),
    ('drivers'),
    ('trucks'),
    ('routes'),
    ('loads'),
    ('invoices'),
    ('expenses'),
    ('settlements'),
    ('maintenance'),
    ('ifta_reports'),
    ('documents'),
    ('invitation_codes'),
    ('subscription_plans'),
    ('subscriptions'),
    ('payment_methods'),
    ('notification_preferences'),
    ('eld_devices'),
    ('eld_logs'),
    ('eld_locations'),
    ('eld_events'),
    ('load_delivery_points'),
    ('route_stops')
) AS t(table_name)
ORDER BY status, table_name;

-- ============================================================================
-- CHECK 2: RLS Policies Status
-- ============================================================================

SELECT 
  tablename,
  COUNT(*) as policy_count,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ HAS POLICIES'
    ELSE '⚠️ NO POLICIES'
  END as status
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'users', 'companies', 'drivers', 'trucks', 'routes', 'loads',
    'invitation_codes', 'subscriptions', 'eld_devices', 'eld_logs'
  )
GROUP BY tablename
ORDER BY tablename;

-- ============================================================================
-- CHECK 3: Functions that should exist
-- ============================================================================

SELECT 
  'Expected Functions' as check_type,
  routine_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.routines 
      WHERE routine_schema = 'public' 
      AND routine_name = f.routine_name
    ) THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END as status
FROM (
  VALUES 
    ('update_updated_at_column'),
    ('get_user_role_and_company'),
    ('create_company_for_user'),
    ('generate_invitation_code'),
    ('accept_invitation'),
    ('update_subscription_updated_at_column'),
    ('update_eld_updated_at_column')
) AS f(routine_name)
ORDER BY status, routine_name;

-- ============================================================================
-- CHECK 4: Duplicate or potentially outdated policies
-- ============================================================================

-- Find tables with multiple policies of the same type (might indicate duplicates)
SELECT 
  tablename,
  cmd,
  COUNT(*) as policy_count,
  STRING_AGG(policyname, ', ') as policy_names
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename, cmd
HAVING COUNT(*) > 3  -- More than 3 policies of same type might indicate duplicates
ORDER BY tablename, cmd;

-- ============================================================================
-- CHECK 5: Tables with RLS enabled but no policies
-- ============================================================================

SELECT 
  t.table_name,
  '⚠️ RLS ENABLED BUT NO POLICIES' as status
FROM information_schema.tables t
WHERE t.table_schema = 'public'
  AND t.table_type = 'BASE TABLE'
  AND EXISTS (
    SELECT 1 
    FROM pg_tables pt
    JOIN pg_class pc ON pc.relname = pt.tablename
    WHERE pt.schemaname = 'public'
      AND pt.tablename = t.table_name
      AND pc.relrowsecurity = true
  )
  AND NOT EXISTS (
    SELECT 1 
    FROM pg_policies p
    WHERE p.tablename = t.table_name
      AND p.schemaname = 'public'
  )
ORDER BY t.table_name;

-- ============================================================================
-- SUMMARY REPORT
-- ============================================================================

SELECT 
  'SUMMARY' as report_section,
  'Total Tables' as metric,
  COUNT(*)::text as value
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'

UNION ALL

SELECT 
  'SUMMARY',
  'Total Policies',
  COUNT(*)::text
FROM pg_policies
WHERE schemaname = 'public'

UNION ALL

SELECT 
  'SUMMARY',
  'Total Functions',
  COUNT(*)::text
FROM information_schema.routines
WHERE routine_schema = 'public';

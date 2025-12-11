-- Cleanup Outdated Database Objects in Supabase
-- This script identifies and removes outdated policies, functions, and objects
-- that were replaced by newer versions (similar to how you cleaned up outdated files)
--
-- IMPORTANT: Review this script before running. It will DROP objects.
-- Run this in Supabase SQL Editor

-- ============================================================================
-- PART 1: IDENTIFY OUTDATED OBJECTS (Read-only queries)
-- ============================================================================
-- Run these first to see what exists before cleaning up

-- Check for duplicate or outdated policies on companies table
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'companies'
ORDER BY policyname;

-- Check for duplicate or outdated policies on users table
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'users'
ORDER BY policyname;

-- Check for all functions that might be outdated
SELECT 
  routine_name,
  routine_type,
  routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public' 
  AND (
    routine_name LIKE '%company%' OR
    routine_name LIKE '%user%' OR
    routine_name LIKE '%invitation%'
  )
ORDER BY routine_name;

-- ============================================================================
-- PART 2: CLEANUP OUTDATED POLICIES
-- ============================================================================

-- Clean up outdated companies table policies
-- These might have been created by old fix_companies_rls.sql or fix_companies_rls_v2.sql
-- The current version is fix_companies_rls_v3.sql which uses create_company_for_user function

-- Drop any old policies that might conflict (fix_companies_rls_v3.sql will recreate the correct ones)
-- Note: fix_companies_rls_v3.sql already has DROP POLICY IF EXISTS, but this ensures cleanup
DROP POLICY IF EXISTS "Authenticated users can create companies" ON public.companies;
DROP POLICY IF EXISTS "Managers can update their company" ON public.companies;

-- ============================================================================
-- PART 3: CLEANUP OUTDATED FUNCTIONS
-- ============================================================================

-- Check if there are any old company creation functions that should be removed
-- Keep only: create_company_for_user (from fix_companies_rls_v3.sql)
-- If you had other versions, they would be listed here

-- ============================================================================
-- PART 4: VERIFY CURRENT STATE
-- ============================================================================

-- After cleanup, verify what policies exist now
SELECT 
  'Companies Policies' as table_name,
  COUNT(*) as policy_count
FROM pg_policies 
WHERE tablename = 'companies'

UNION ALL

SELECT 
  'Users Policies' as table_name,
  COUNT(*) as policy_count
FROM pg_policies 
WHERE tablename = 'users'

UNION ALL

SELECT 
  'Functions' as table_name,
  COUNT(*) as policy_count
FROM information_schema.routines
WHERE routine_schema = 'public' 
  AND routine_name LIKE '%company%';

-- ============================================================================
-- PART 5: RECOMMENDED: RE-RUN CURRENT SCHEMAS
-- ============================================================================
-- After cleanup, it's recommended to re-run the current schema files to ensure
-- everything is in the correct state:
--
-- 1. fix_companies_rls_v3.sql (if you want to ensure companies policies are correct)
-- 2. employee_management_schema_safe.sql (if you want to ensure employee management is correct)
-- 3. fix_users_rls_recursion.sql (if you want to ensure users policies are correct)
--
-- These files use "IF NOT EXISTS" and "DROP POLICY IF EXISTS" so they're safe to re-run

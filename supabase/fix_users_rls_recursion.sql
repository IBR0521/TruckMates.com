-- Fix infinite recursion in users table RLS policies
-- Run this in Supabase SQL Editor

-- Step 1: Drop all existing policies on users table
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Managers can view employees in their company" ON public.users;
DROP POLICY IF EXISTS "Managers can update employees in their company" ON public.users;
DROP POLICY IF EXISTS "Managers can delete employees from their company" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;

-- Step 2: Create a SECURITY DEFINER function to get user's role and company_id
-- This bypasses RLS to avoid recursion
CREATE OR REPLACE FUNCTION get_user_role_and_company()
RETURNS TABLE(role TEXT, company_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT u.role, u.company_id
  FROM public.users u
  WHERE u.id = auth.uid();
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_user_role_and_company() TO authenticated;

-- Step 3: Recreate policies using the function to avoid recursion

-- Users can always view their own profile (most permissive, checked first)
CREATE POLICY "Users can view their own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

-- Managers can view employees in their company (using function to avoid recursion)
CREATE POLICY "Managers can view employees in their company"
  ON public.users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM get_user_role_and_company() 
      WHERE role = 'manager' 
      AND company_id IS NOT NULL
      AND company_id = users.company_id
    )
  );

-- Users can update their own profile
CREATE POLICY "Users can update their own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Managers can update employees in their company (but not change role to manager)
CREATE POLICY "Managers can update employees in their company"
  ON public.users FOR UPDATE
  USING (
    id != auth.uid() -- Can't update themselves
    AND role != 'manager' -- Can't update other managers
    AND EXISTS (
      SELECT 1 FROM get_user_role_and_company() 
      WHERE role = 'manager' 
      AND company_id IS NOT NULL
      AND company_id = users.company_id
    )
  )
  WITH CHECK (
    role != 'manager' -- Can't change role to manager
    AND EXISTS (
      SELECT 1 FROM get_user_role_and_company() 
      WHERE role = 'manager' 
      AND company_id IS NOT NULL
      AND company_id = users.company_id
    )
  );

-- Managers can delete employees from their company (but not managers)
CREATE POLICY "Managers can delete employees from their company"
  ON public.users FOR DELETE
  USING (
    id != auth.uid() -- Can't delete themselves
    AND role != 'manager' -- Can't delete managers
    AND EXISTS (
      SELECT 1 FROM get_user_role_and_company() 
      WHERE role = 'manager' 
      AND company_id IS NOT NULL
      AND company_id = users.company_id
    )
  );


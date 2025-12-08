-- Comprehensive fix for companies RLS policies
-- This ensures the policies are created correctly

-- First, drop any existing policies that might conflict
DROP POLICY IF EXISTS "Authenticated users can create companies" ON public.companies;
DROP POLICY IF EXISTS "Managers can update their company" ON public.companies;
DROP POLICY IF EXISTS "Users can create companies" ON public.companies;

-- Allow authenticated users to create companies (for registration)
-- This is needed because during registration, the user doesn't have a company_id yet
CREATE POLICY "Authenticated users can create companies"
  ON public.companies FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Allow managers to update their company
CREATE POLICY "Managers can update their company"
  ON public.companies FOR UPDATE
  USING (
    id IN (
      SELECT company_id FROM public.users 
      WHERE id = auth.uid() AND role = 'manager'
    )
  );

-- Also allow checking if company name exists (for validation)
-- This allows SELECT for checking duplicates
-- The existing SELECT policy should handle this, but let's make sure

-- Verify the policies were created
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'companies';


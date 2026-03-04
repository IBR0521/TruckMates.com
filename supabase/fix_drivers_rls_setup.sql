-- Fix RLS policies for drivers and trucks tables to allow super_admin and owner roles during setup
-- This allows users to create drivers and trucks during the account setup wizard

-- ============================================================================
-- DRIVERS TABLE
-- ============================================================================
-- Drop existing insert policy
DROP POLICY IF EXISTS "Managers can insert drivers" ON public.drivers;
DROP POLICY IF EXISTS "Managers can manage drivers" ON public.drivers;

-- Create new policy that allows manager, super_admin, owner, and admin roles
CREATE POLICY "Managers can insert drivers"
  ON public.drivers FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('manager', 'super_admin', 'owner', 'admin')
    )
  );

-- Also update the update/delete policies if they exist with the same restriction
DROP POLICY IF EXISTS "Managers can update drivers" ON public.drivers;
DROP POLICY IF EXISTS "Managers can delete drivers" ON public.drivers;

CREATE POLICY "Managers can update drivers"
  ON public.drivers FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('manager', 'super_admin', 'owner', 'admin')
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('manager', 'super_admin', 'owner', 'admin')
    )
  );

CREATE POLICY "Managers can delete drivers"
  ON public.drivers FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('manager', 'super_admin', 'owner', 'admin')
    )
  );

-- ============================================================================
-- TRUCKS TABLE
-- ============================================================================
-- Drop existing policies
DROP POLICY IF EXISTS "Managers can insert trucks" ON public.trucks;
DROP POLICY IF EXISTS "Managers can manage trucks" ON public.trucks;
DROP POLICY IF EXISTS "Managers can update trucks" ON public.trucks;
DROP POLICY IF EXISTS "Managers can delete trucks" ON public.trucks;

-- Create new policies that allow manager, super_admin, owner, and admin roles
CREATE POLICY "Managers can insert trucks"
  ON public.trucks FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('manager', 'super_admin', 'owner', 'admin')
    )
  );

CREATE POLICY "Managers can update trucks"
  ON public.trucks FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('manager', 'super_admin', 'owner', 'admin')
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('manager', 'super_admin', 'owner', 'admin')
    )
  );

CREATE POLICY "Managers can delete trucks"
  ON public.trucks FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('manager', 'super_admin', 'owner', 'admin')
    )
  );


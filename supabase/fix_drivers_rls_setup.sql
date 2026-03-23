-- Fix RLS policies for drivers and trucks tables to use the actual 6-role system
-- This allows users with manager roles (super_admin, operations_manager) to create drivers and trucks during setup
-- 
-- The 6 roles are:
-- 1. super_admin (isManager: true) - CEO/Owner, full access
-- 2. operations_manager (isManager: true) - Lead dispatcher, manages loads/vehicles/drivers
-- 3. dispatcher (isManager: false) - Real-time execution
-- 4. safety_compliance (isManager: false) - Safety & compliance audits
-- 5. financial_controller (isManager: false) - Accounting & finance
-- 6. driver (isManager: false) - Mobile task completion

-- ============================================================================
-- DRIVERS TABLE
-- ============================================================================
-- Drop existing insert policy
DROP POLICY IF EXISTS "Managers can insert drivers" ON public.drivers;
DROP POLICY IF EXISTS "Managers can manage drivers" ON public.drivers;

-- Create new policy that allows super_admin and operations_manager (the two manager roles)
CREATE POLICY "Managers can insert drivers"
  ON public.drivers FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'operations_manager')
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
      AND role IN ('super_admin', 'operations_manager')
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'operations_manager')
    )
  );

CREATE POLICY "Managers can delete drivers"
  ON public.drivers FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'operations_manager')
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

-- Create new policies that allow super_admin and operations_manager (the two manager roles)
CREATE POLICY "Managers can insert trucks"
  ON public.trucks FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'operations_manager')
    )
  );

CREATE POLICY "Managers can update trucks"
  ON public.trucks FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'operations_manager')
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'operations_manager')
    )
  );

CREATE POLICY "Managers can delete trucks"
  ON public.trucks FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'operations_manager')
    )
  );


-- ============================================================================
-- Fix ELD RLS Policies - Update role check from 'manager' to correct roles
-- ============================================================================
-- The RLS policies currently check for role IN ('super_admin','operations_manager'), but the actual
-- manager roles are 'super_admin' and 'operations_manager'
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Managers can insert ELD devices" ON public.eld_devices;
DROP POLICY IF EXISTS "Managers can update ELD devices" ON public.eld_devices;
DROP POLICY IF EXISTS "Managers can delete ELD devices" ON public.eld_devices;
DROP POLICY IF EXISTS "Managers can update ELD events" ON public.eld_events;

-- Recreate with correct role check
CREATE POLICY "Managers can insert ELD devices"
  ON public.eld_devices FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'operations_manager')
    )
  );

CREATE POLICY "Managers can update ELD devices"
  ON public.eld_devices FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'operations_manager')
    )
  );

CREATE POLICY "Managers can delete ELD devices"
  ON public.eld_devices FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'operations_manager')
    )
  );

CREATE POLICY "Managers can update ELD events"
  ON public.eld_events FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'operations_manager')
    )
  );

-- ============================================================================
-- Verification
-- ============================================================================
-- After running this, managers with 'super_admin' or 'operations_manager'
-- roles should be able to insert, update, and delete ELD devices
-- ============================================================================




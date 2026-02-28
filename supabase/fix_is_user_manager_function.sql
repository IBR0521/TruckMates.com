-- ============================================================================
-- Fix is_user_manager() function to check for correct manager roles
-- ============================================================================
-- The function currently checks for role = 'manager', but the actual
-- manager roles are 'super_admin' and 'operations_manager'
-- ============================================================================

CREATE OR REPLACE FUNCTION is_user_manager()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = (SELECT auth.uid()) 
    AND role IN ('super_admin', 'operations_manager')
    AND company_id IS NOT NULL
  );
$$;

GRANT EXECUTE ON FUNCTION is_user_manager() TO authenticated, anon;

-- ============================================================================
-- Verification
-- ============================================================================
-- After running this, test with:
-- SELECT is_user_manager();
-- Should return true for super_admin and operations_manager roles
-- ============================================================================

